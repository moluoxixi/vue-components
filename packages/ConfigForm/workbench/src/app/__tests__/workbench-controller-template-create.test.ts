// @vitest-environment happy-dom

import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { VueWrapper } from '@vue/test-utils'
import type { WorkbenchController } from '../workbench-controller'
import type { WorkbenchUiStore } from '../workbench-ui-store'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  builtInTemplateCatalogProvider,
  createBuiltInProject,
  createMemoryProjectRecoveryDraftStore,
  createTemplateCatalogService,
} from '../../project'
import { createWorkbenchController } from '../workbench-controller'
import { createWorkbenchUiStore } from '../workbench-ui-store'

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
      document: createBuiltInProject('element-profile', {
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
})
