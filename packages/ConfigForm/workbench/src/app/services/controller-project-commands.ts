import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  ModelJsonObject,
  ProjectCommandAction,
  ProjectEmbeddedResource,
  ProjectEmbeddedResourceWrite,
  ProjectRepository,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProjectEditorSessionSnapshot, ProjectPersistenceSession } from '../../project'
import type { EmbeddedResourceInput, WorkbenchUiStore } from '../types'
import { PROJECT_IMAGE_RESOURCE_SETTING, readProjectImageResourceId } from '@moluoxixi/config-form-model'

import { loadWorkbenchAdapter } from '../../adapters'
import { createProjectEditorSession } from '../../project'

type ExecuteProjectActions = (
  label: string,
  actions: ProjectCommandAction[],
  mergeKey?: string,
  embeddedWrites?: readonly ProjectEmbeddedResourceWrite[],
) => boolean

function nextImageResourceId(): string {
  const token = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `project-image-${token}`
}

function imageExtension(mediaType: string): string {
  return mediaType.toLocaleLowerCase() === 'image/jpeg'
    ? 'jpg'
    : mediaType.toLocaleLowerCase() === 'image/svg+xml'
      ? 'svg'
      : mediaType.toLocaleLowerCase().split('/')[1]?.replace(/[^a-z0-9]+/giu, '') || 'png'
}

async function imageContentHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    throw new Error('SHA-256 is unavailable in this runtime.')
  const digest = new Uint8Array(await subtle.digest('SHA-256', new Uint8Array(bytes).buffer))
  return `sha256:${[...digest].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

function imageResourceReferenced(document: ReadonlyProjectDocument, resourceId: string): boolean {
  return Object.values(document.surfacesById).some(surface => Object.values(surface.graph.nodesById).some(node => (
    Object.values(node.resourceBindings ?? {}).some(binding => binding.resourceId === resourceId)
  )))
}

export function createWorkbenchProjectCommands(options: {
  busy: Ref<boolean>
  closeProject: () => Promise<void>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  executeProjectActions: ExecuteProjectActions
  getPersistenceSession: () => ProjectPersistenceSession | undefined
  hasUnsavedChanges: ComputedRef<boolean>
  openProject: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
  repository: ShallowRef<ProjectRepository | undefined>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}) {
  const {
    busy,
    closeProject,
    currentProject,
    executeProjectActions,
    getPersistenceSession,
    hasUnsavedChanges,
    openProject,
    refreshProjects,
    repository,
    ui,
    workbenchLocale,
  } = options
  let commandSequence = 0

  async function renameProject(projectId: string, name: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    busy.value = true
    ui.clearMessage()
    try {
      if (currentProject.value?.id === projectId) {
        const changed = executeProjectActions('Rename project', [{
          type: 'operation.apply',
          operations: [{ type: 'project.rename', name }],
        }])
        if (!changed)
          return false
        const saved = await getPersistenceSession()?.flush()
        if (saved && !saved.success)
          throw new Error(saved.error.message)
      }
      else {
        const persisted = await activeRepository.get(projectId)
        if (!persisted)
          throw new TypeError(`Project does not exist: ${projectId}`)
        const adapterId = persisted.document.registryLock.adapter
        if (adapterId !== 'antd-vue' && adapterId !== 'element-plus')
          throw new TypeError(`Unsupported Workbench adapter: ${adapterId}`)
        const adapter = await loadWorkbenchAdapter(adapterId)
        const session = createProjectEditorSession({
          project: persisted,
          registry: adapter.componentRegistry,
          repository: activeRepository,
        })
        const result = session.execute({
          id: `project-manager-rename-${++commandSequence}`,
          label: 'Rename project',
          actions: [{
            type: 'operation.apply',
            operations: [{ type: 'project.rename', name }],
          }],
        })
        if (!result.changed) {
          const message = result.diagnostics[0]?.message
          if (message)
            throw new TypeError(message)
          return false
        }
        const saved = await session.save({ sealHistoryGroup: true, source: 'manual' })
        if (!saved.success)
          throw new Error(saved.error.message)
      }
      await refreshProjects()
      return true
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function setProjectImage(projectId: string, input: EmbeddedResourceInput): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value || !input.mediaType.trim().toLocaleLowerCase().startsWith('image/'))
      return false
    busy.value = true
    ui.clearMessage()
    try {
      const bytes = new Uint8Array(input.bytes)
      if (bytes.byteLength === 0)
        throw new TypeError('Project image cannot be empty.')
      const document = currentProject.value?.id === projectId
        ? currentProject.value
        : (await activeRepository.get(projectId))?.document
      if (!document)
        throw new TypeError(`Project does not exist: ${projectId}`)
      const currentImageId = readProjectImageResourceId(document.settings)
      const currentImage = currentImageId ? document.resources[currentImageId] : undefined
      const resourceId = currentImage?.id ?? nextImageResourceId()
      const mediaType = input.mediaType.trim().toLocaleLowerCase()
      const fileName = input.fileName.trim() || `project-image.${imageExtension(mediaType)}`
      const normalizedFileName = /\.[a-z0-9]{1,16}$/iu.test(fileName)
        ? fileName
        : `${fileName}.${imageExtension(mediaType)}`
      const resource: ProjectEmbeddedResource = {
        id: resourceId,
        name: input.name.trim() || 'Project image',
        kind: 'embedded',
        fileName: normalizedFileName,
        mediaType,
        byteLength: bytes.byteLength,
        contentHash: await imageContentHash(bytes),
      }
      const settings = structuredClone(document.settings) as ModelJsonObject
      settings[PROJECT_IMAGE_RESOURCE_SETTING] = resourceId
      const operation = currentImage
        ? { type: 'resource.replace' as const, resourceId, resource }
        : { type: 'resource.add' as const, resource }
      const actions: ProjectCommandAction[] = [{
        type: 'operation.apply',
        operations: [operation, { type: 'project.settings', settings }],
      }]
      const embeddedWrites: ProjectEmbeddedResourceWrite[] = [{
        resourceId,
        contentHash: resource.contentHash,
        bytes,
      }]
      if (currentProject.value?.id === projectId) {
        if (!executeProjectActions('Set project image', actions, undefined, embeddedWrites))
          return false
        const saved = await getPersistenceSession()?.flush()
        if (saved && !saved.success)
          throw new Error(saved.error.message)
      }
      else {
        const persisted = await activeRepository.get(projectId)
        if (!persisted)
          throw new TypeError(`Project does not exist: ${projectId}`)
        const adapterId = persisted.document.registryLock.adapter
        if (adapterId !== 'antd-vue' && adapterId !== 'element-plus')
          throw new TypeError(`Unsupported Workbench adapter: ${adapterId}`)
        const adapter = await loadWorkbenchAdapter(adapterId)
        const session = createProjectEditorSession({
          project: persisted,
          registry: adapter.componentRegistry,
          repository: activeRepository,
        })
        const result = session.execute({
          id: `project-manager-image-${++commandSequence}`,
          label: 'Set project image',
          actions,
        }, { embeddedWrites })
        if (!result.changed)
          throw new TypeError(result.diagnostics[0]?.message ?? 'Project image was rejected.')
        const saved = await session.save({ sealHistoryGroup: true, source: 'manual' })
        if (!saved.success)
          throw new Error(saved.error.message)
      }
      await refreshProjects()
      return true
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function removeProjectImage(projectId: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    busy.value = true
    ui.clearMessage()
    try {
      const document = currentProject.value?.id === projectId
        ? currentProject.value
        : (await activeRepository.get(projectId))?.document
      if (!document)
        throw new TypeError(`Project does not exist: ${projectId}`)
      const resourceId = readProjectImageResourceId(document.settings)
      if (!resourceId)
        return false
      const settings = structuredClone(document.settings) as ModelJsonObject
      delete settings[PROJECT_IMAGE_RESOURCE_SETTING]
      const operations: ProjectCommandAction[] = [{
        type: 'operation.apply',
        operations: [
          { type: 'project.settings', settings },
          ...(!imageResourceReferenced(document, resourceId) && document.resources[resourceId]
            ? [{ type: 'resource.remove' as const, resourceId }]
            : []),
        ],
      }]
      if (currentProject.value?.id === projectId) {
        if (!executeProjectActions('Remove project image', operations))
          return false
        const saved = await getPersistenceSession()?.flush()
        if (saved && !saved.success)
          throw new Error(saved.error.message)
      }
      else {
        const persisted = await activeRepository.get(projectId)
        if (!persisted)
          throw new TypeError(`Project does not exist: ${projectId}`)
        const adapterId = persisted.document.registryLock.adapter
        if (adapterId !== 'antd-vue' && adapterId !== 'element-plus')
          throw new TypeError(`Unsupported Workbench adapter: ${adapterId}`)
        const adapter = await loadWorkbenchAdapter(adapterId)
        const session = createProjectEditorSession({
          project: persisted,
          registry: adapter.componentRegistry,
          repository: activeRepository,
        })
        const result = session.execute({
          id: `project-manager-image-${++commandSequence}`,
          label: 'Remove project image',
          actions: operations,
        })
        if (!result.changed)
          throw new TypeError(result.diagnostics[0]?.message ?? 'Project image removal was rejected.')
        const saved = await session.save({ sealHistoryGroup: true, source: 'manual' })
        if (!saved.success)
          throw new Error(saved.error.message)
      }
      await refreshProjects()
      return true
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    const deletingCurrent = currentProject.value?.id === projectId
    if (deletingCurrent && hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'project.deleteBlocked',
        'Save or resolve the current project before deleting it.',
      ))
      return false
    }
    busy.value = true
    ui.clearMessage()
    try {
      if (deletingCurrent)
        await closeProject()
      await activeRepository.delete(projectId)
      await refreshProjects()
      return true
    }
    catch (error) {
      if (deletingCurrent)
        await openProject(projectId).catch(() => undefined)
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  return { deleteProject, removeProjectImage, renameProject, setProjectImage }
}
