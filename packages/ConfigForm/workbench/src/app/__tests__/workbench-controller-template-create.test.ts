// @vitest-environment happy-dom

import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { VueWrapper } from '@vue/test-utils'
import type { WorkbenchController, WorkbenchUiStore } from '..'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createWorkbenchController, createWorkbenchUiStore } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  builtInTemplateCatalogProvider,
  createMemoryProjectRecoveryDraftStore,
  createPageTransferDocument,
  createTemplateCatalogService,
} from '../../project'
import { createBuiltInProjectFixture } from '../../project/__tests__/fixtures'

const mocks = vi.hoisted(() => ({
  createDraftStore: vi.fn(),
  openRepository: vi.fn(),
}))

vi.mock('../../project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../project')>()
  return {
    ...actual,
    createIndexedDBProjectRecoveryDraftStore: mocks.createDraftStore,
    openDefaultProjectRepository: mocks.openRepository,
  }
})

const wrappers: VueWrapper[] = []

function durableRepository(): ProjectRepository {
  const repository = createMemoryProjectRepository()
  Object.defineProperty(repository, 'persistence', { value: 'durable' })
  return repository
}

function durableDraftStore(openError?: Error) {
  const store = createMemoryProjectRecoveryDraftStore()
  Object.defineProperty(store, 'persistence', { value: 'durable' })
  return Object.assign(store, {
    open: vi.fn(async () => {
      if (openError)
        throw openError
    }),
  })
}

async function setup(repository: ProjectRepository): Promise<{
  controller: WorkbenchController
  ui: WorkbenchUiStore
}> {
  mocks.openRepository.mockResolvedValue(repository)
  let controller!: WorkbenchController
  let ui!: WorkbenchUiStore
  wrappers.push(mount(defineComponent({
    setup() {
      ui = createWorkbenchUiStore({})
      controller = createWorkbenchController({}, ui)
      return () => h('div')
    },
  })))
  await flushPromises()
  await vi.waitFor(() => expect(controller.initialized.value).toBe(true), { timeout: 5_000 })
  return { controller, ui }
}

async function elementTemplate() {
  const result = await createTemplateCatalogService([builtInTemplateCatalogProvider]).load()
  return result.templates.find(template => template.manifest.id === 'element-profile')!
}

beforeEach(() => {
  mocks.createDraftStore.mockImplementation(() => durableDraftStore())
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('workbench template project creation transaction', () => {
  it('deletes a persisted project when persistence preparation prevents activation', async () => {
    const repository = durableRepository()
    const deleteProject = vi.spyOn(repository, 'delete')
    const draftStore = durableDraftStore(new Error('recovery store unavailable'))
    const closeDraftStore = vi.spyOn(draftStore, 'close')
    mocks.createDraftStore.mockImplementation(() => draftStore)
    const { controller, ui } = await setup(repository)
    const notify = vi.spyOn(ui, 'notify')

    const created = await controller.createProjectFromTemplate(await elementTemplate(), 'Failed activation')
    const projectId = deleteProject.mock.calls[0]?.[0]

    expect(created).toBe(false)
    expect(projectId).toBeTypeOf('string')
    expect(controller.currentProject.value).toBeUndefined()
    expect(await repository.get(projectId!)).toBeUndefined()
    expect(closeDraftStore).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'recovery store unavailable' }))
  })

  it('reports rollback failure and leaves the unactivated project recoverable', async () => {
    const repository = durableRepository()
    const createProject = vi.spyOn(repository, 'create')
    vi.spyOn(repository, 'delete').mockRejectedValue(new Error('delete failed'))
    mocks.createDraftStore.mockImplementation(() => durableDraftStore(new Error('recovery store unavailable')))
    const { controller, ui } = await setup(repository)
    const notify = vi.spyOn(ui, 'notify')

    const created = await controller.createProjectFromTemplate(await elementTemplate(), 'Rollback failure')
    const projectId = createProject.mock.calls[0]!.at(0)!.document.id

    expect(created).toBe(false)
    expect(controller.currentProject.value).toBeUndefined()
    expect(await repository.get(projectId)).toBeDefined()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Repository compensation failed: delete failed'),
    }))
  })

  it('preserves the active project and adapter when the replacement cannot activate', async () => {
    const repository = durableRepository()
    const adapter = await loadWorkbenchAdapter('element-plus')
    await repository.create({
      document: createBuiltInProjectFixture('element-profile', {
        id: 'existing-project',
        name: 'Existing project',
      }, adapter.componentRegistry.lock),
    })
    const createReplacement = vi.spyOn(repository, 'create')
    const deleteProject = vi.spyOn(repository, 'delete')
    const { controller } = await setup(repository)
    expect(controller.currentProject.value?.id).toBe('existing-project')
    expect(controller.getCurrentAdapterId()).toBe('element-plus')
    expect(controller.configError.value).toBe('')
    mocks.createDraftStore.mockImplementation(() => durableDraftStore(new Error('replacement unavailable')))
    const templates = await createTemplateCatalogService([builtInTemplateCatalogProvider]).load()
    const replacement = templates.templates.find(template => template.manifest.id === 'antd-profile')!

    const created = await controller.createProjectFromTemplate(replacement, 'Replacement')

    expect(created).toBe(false)
    expect(createReplacement).toHaveBeenCalledOnce()
    expect(deleteProject).toHaveBeenCalledOnce()
    expect(controller.currentProject.value?.id).toBe('existing-project')
    expect(controller.getCurrentAdapterId()).toBe('element-plus')
  })

  it('keeps an activated project when the post-open catalog refresh fails', async () => {
    const repository = durableRepository()
    const listProjects = vi.spyOn(repository, 'list')
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('catalog refresh failed'))
    const deleteProject = vi.spyOn(repository, 'delete')
    const { controller, ui } = await setup(repository)
    const notify = vi.spyOn(ui, 'notify')

    const created = await controller.createProjectFromTemplate(await elementTemplate(), 'Refresh failure')
    const projectId = controller.currentProject.value?.id

    expect(created).toBe(true)
    expect(projectId).toBeTypeOf('string')
    expect(await repository.get(projectId!)).toBeDefined()
    expect(deleteProject).not.toHaveBeenCalled()
    expect(listProjects).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'catalog refresh failed' }))
  })

  it('creates an imported page as one undoable project command', async () => {
    const repository = durableRepository()
    const adapter = await loadWorkbenchAdapter('element-plus')
    await repository.create({
      document: createBuiltInProjectFixture('element-profile', {
        id: 'import-host',
        name: 'Import host',
      }, adapter.componentRegistry.lock),
    })
    const { controller } = await setup(repository)
    const project = controller.currentProject.value!
    const source = createPageTransferDocument(project, project.homePageId)
    expect(source).toBeDefined()
    const analyzed = await controller.prepareJsonImport(JSON.stringify(source), 'page')
    expect(analyzed.success).toBe(true)
    if (!analyzed.success)
      return
    const beforeCount = controller.currentProject.value!.pageOrder.length
    const beforeHistory = controller.designSession.historyControl.value.history?.position

    expect(await controller.createFromJsonImport(analyzed.prepared)).toBe(true)
    expect(controller.currentProject.value!.pageOrder).toHaveLength(beforeCount + 1)
    expect(controller.designSession.historyControl.value.history?.position).toBe((beforeHistory ?? 0) + 1)
    expect(controller.designSession.historyControl.value.undo()).toBe(true)
    expect(controller.currentProject.value!.pageOrder).toHaveLength(beforeCount)
  })

  it('rejects a prepared page after the host project changes', async () => {
    const repository = durableRepository()
    const adapter = await loadWorkbenchAdapter('element-plus')
    await repository.create({
      document: createBuiltInProjectFixture('element-profile', {
        id: 'stale-import-host',
        name: 'Stale import host',
      }, adapter.componentRegistry.lock),
    })
    const { controller } = await setup(repository)
    const project = controller.currentProject.value!
    const sourcePage = project.pagesById[project.homePageId]!
    const source = createPageTransferDocument(project, sourcePage.id)
    expect(source).toBeDefined()
    const analyzed = await controller.prepareJsonImport(JSON.stringify(source), 'page')
    expect(analyzed.success).toBe(true)
    if (!analyzed.success)
      return
    await controller.handlePageAction({ type: 'page.rename', pageId: sourcePage.id, name: 'Changed after analysis' })
    const historyPosition = controller.designSession.historyControl.value.history?.position
    const pageId = controller.currentPageId.value

    expect(await controller.createFromJsonImport(analyzed.prepared)).toBe(false)
    expect(controller.currentProject.value!.pageOrder).toHaveLength(1)
    expect(controller.designSession.historyControl.value.history?.position).toBe(historyPosition)
    expect(controller.currentPageId.value).toBe(pageId)
  })

  it('compensates an imported project when activation preparation fails', async () => {
    const repository = durableRepository()
    const adapter = await loadWorkbenchAdapter('element-plus')
    const source = createBuiltInProjectFixture('element-profile', {
      id: 'imported-project-source',
      name: 'Imported project source',
    }, adapter.componentRegistry.lock)
    const deleteProject = vi.spyOn(repository, 'delete')
    mocks.createDraftStore.mockImplementation(() => durableDraftStore(new Error('import activation unavailable')))
    const { controller } = await setup(repository)
    const analyzed = await controller.prepareJsonImport(JSON.stringify(source), 'project')
    expect(analyzed.success).toBe(true)
    if (!analyzed.success)
      return

    expect(await controller.createFromJsonImport(analyzed.prepared)).toBe(false)
    expect(deleteProject).toHaveBeenCalledOnce()
    expect(controller.currentProject.value).toBeUndefined()
    expect(await repository.get(deleteProject.mock.calls[0]![0])).toBeUndefined()
  })

  it('rejects a prepared project when a non-home page fails final compilation', async () => {
    const repository = durableRepository()
    const createProject = vi.spyOn(repository, 'create')
    const adapter = await loadWorkbenchAdapter('element-plus')
    const source = createBuiltInProjectFixture('element-profile', {
      id: 'multi-page-source',
      name: 'Multi-page source',
    }, adapter.componentRegistry.lock)
    const home = source.pagesById[source.homePageId]!
    const secondary = {
      ...structuredClone(home),
      id: 'secondary',
      name: 'Secondary',
      route: '/secondary',
    }
    source.pageOrder.push(secondary.id)
    source.pagesById[secondary.id] = secondary
    const { controller } = await setup(repository)
    const analyzed = await controller.prepareJsonImport(JSON.stringify(source), 'project')
    expect(analyzed.success).toBe(true)
    if (!analyzed.success || analyzed.prepared.target !== 'project')
      return

    const candidate = structuredClone(analyzed.prepared.document)
    const candidateSecondary = candidate.pagesById[candidate.pageOrder[1]!]!
    const nodeId = candidateSecondary.graph.root[0]!.nodeId
    const node = candidateSecondary.graph.nodesById[nodeId]!
    candidateSecondary.graph.nodesById[nodeId] = {
      id: node.id,
      component: node.component,
      kind: 'layout',
      props: structuredClone(node.props),
      events: structuredClone(node.events),
      bindings: structuredClone(node.bindings),
      slots: {},
    }

    expect(await controller.createFromJsonImport({
      ...analyzed.prepared,
      document: candidate,
    })).toBe(false)
    expect(createProject).not.toHaveBeenCalled()
    expect(controller.currentProject.value).toBeUndefined()
  })
})
