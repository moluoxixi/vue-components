import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { ProjectDocument, ProjectEmbeddedResourceWrite, ProjectRepository } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type {
  ConfigImportTarget,
  PrepareConfigImportResult,
  PreparedConfigImport,
  ProjectEditorSessionSnapshot,
  ProjectTemplateCatalogEntry,
} from '../../project'
import type { WorkbenchUiStore } from '../types'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  analyzeTemplateEligibility,
  createProjectTransferDocument,
  downloadProjectTransfer,
  instantiateTemplateProject,
  instantiateTemplateSurface,
  nextProjectSurfaceId,
  nextProjectSurfaceRoute,
  preflightPreparedProject,
  prepareConfigImport,
} from '../../project'

export function createWorkbenchCreationCommands(options: {
  addPreparedSurface: (
    surface: ProjectDocument['surfacesById'][string],
    adapter: WorkbenchAdapter,
    document: ProjectDocument,
    embeddedWrites?: readonly ProjectEmbeddedResourceWrite[],
  ) => boolean
  busy: Ref<boolean>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  hasUnsavedChanges: ComputedRef<boolean>
  isDisposed: () => boolean
  openProject: (id: string, surfaceId?: string) => Promise<void>
  projectSessionSnapshot: ShallowRef<ProjectEditorSessionSnapshot | undefined>
  refreshProjects: () => Promise<void>
  repository: ShallowRef<ProjectRepository | undefined>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}) {
  const {
    addPreparedSurface,
    busy,
    currentProject,
    hasUnsavedChanges,
    isDisposed,
    openProject,
    projectSessionSnapshot,
    refreshProjects,
    repository,
    ui,
    workbenchLocale,
  } = options

  async function persistPreparedProject(
    project: ProjectDocument,
    adapter: WorkbenchAdapter,
    activeRepository: ProjectRepository,
    embeddedContents: readonly ProjectEmbeddedResourceWrite[] = [],
  ): Promise<boolean> {
    preflightPreparedProject(project, adapter.registrySnapshot)
    await activeRepository.create({ document: project, embeddedContents })
    try {
      await openProject(project.id)
      if (currentProject.value?.id !== project.id)
        throw new TypeError('Created project could not be opened.')
    }
    catch (error) {
      try {
        await activeRepository.delete(project.id)
      }
      catch (compensationError) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} Repository compensation failed: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
        )
      }
      throw error
    }
    try {
      await refreshProjects()
    }
    catch (error) {
      ui.notify(error)
    }
    return true
  }

  async function createProjectFromTemplate(
    template: ProjectTemplateCatalogEntry,
    name = template.manifest.displayName,
  ): Promise<boolean> {
    const activeRepository = repository.value
    const capturedProjectId = currentProject.value?.id
    const capturedContentHash = projectSessionSnapshot.value?.contentHash
    if (!activeRepository || busy.value)
      return false
    if (currentProject.value && hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'template.createProjectBlocked',
        'Save or resolve the current project before creating another project.',
      ))
      return false
    }
    busy.value = true
    ui.clearMessage()
    try {
      const adapter = await loadWorkbenchAdapter(template.manifest.adapter)
      if (
        isDisposed()
        || repository.value !== activeRepository
        || currentProject.value?.id !== capturedProjectId
        || projectSessionSnapshot.value?.contentHash !== capturedContentHash
      ) {
        return false
      }
      const eligibility = analyzeTemplateEligibility(template, {
        registry: adapter.registrySnapshot,
        target: 'project',
      })
      if (!eligibility.eligible)
        throw new TypeError(eligibility.diagnostics[0]?.message ?? 'Template requirements do not match this Registry.')
      const project = instantiateTemplateProject(template, {
        name,
        registryLock: adapter.componentRegistry.lock,
      })
      return await persistPreparedProject(project, adapter, activeRepository)
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function createSurfaceFromTemplate(
    template: ProjectTemplateCatalogEntry,
    name = template.manifest.displayName,
  ): Promise<boolean> {
    const document = currentProject.value
    const capturedContentHash = projectSessionSnapshot.value?.contentHash
    if (!repository.value || !document || busy.value)
      return false
    busy.value = true
    ui.clearMessage()
    try {
      const adapter = await loadWorkbenchAdapter(template.manifest.adapter)
      if (isDisposed() || currentProject.value?.id !== document.id || projectSessionSnapshot.value?.contentHash !== capturedContentHash)
        return false
      const eligibility = analyzeTemplateEligibility(template, {
        registry: adapter.registrySnapshot,
        target: 'surface',
        targetLock: structuredClone(document.registryLock),
      })
      if (!eligibility.eligible)
        throw new TypeError(eligibility.diagnostics[0]?.message ?? 'Template requirements do not match the current project Registry.')
      const id = nextProjectSurfaceId(document, name)
      const surface = instantiateTemplateSurface(template, {
        id,
        name,
        route: nextProjectSurfaceRoute(document, name),
      })
      return addPreparedSurface(surface, adapter, structuredClone(document) as ProjectDocument)
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function prepareJsonImport(
    source: string,
    target: ConfigImportTarget,
  ): Promise<PrepareConfigImportResult> {
    const capturedProjectId = currentProject.value?.id
    const capturedContentHash = projectSessionSnapshot.value?.contentHash
    const result = await prepareConfigImport({
      source,
      target,
      ...(currentProject.value ? { currentProject: structuredClone(currentProject.value) as ProjectDocument } : {}),
    })
    if (
      target === 'surface'
      && (
        currentProject.value?.id !== capturedProjectId
        || projectSessionSnapshot.value?.contentHash !== capturedContentHash
      )
    ) {
      return {
        success: false,
        diagnostics: [{
          code: 'IMPORT_STALE',
          message: 'The active project changed while the Surface import was being analyzed.',
          path: '$',
        }],
      }
    }
    return result
  }

  async function createFromJsonImport(prepared: PreparedConfigImport): Promise<boolean> {
    const activeRepository = repository.value
    const document = currentProject.value
    const capturedProjectId = document?.id
    const capturedContentHash = projectSessionSnapshot.value?.contentHash
    if (!activeRepository || busy.value)
      return false
    if (prepared.target === 'project' && document && hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'import.createProjectBlocked',
        'Save or resolve the current project before importing another project.',
      ))
      return false
    }
    if (prepared.target === 'surface' && !document)
      return false
    if (
      prepared.target === 'surface'
      && (
        prepared.originProjectId !== document?.id
        || prepared.originContentHash !== capturedContentHash
      )
    ) {
      ui.notify(workbenchLocale.value.t(
        'import.stale',
        'The active project changed after analysis. Analyze the JSON again.',
      ))
      return false
    }
    busy.value = true
    ui.clearMessage()
    try {
      const adapter = await loadWorkbenchAdapter(prepared.adapter)
      if (
        isDisposed()
        || repository.value !== activeRepository
        || currentProject.value?.id !== capturedProjectId
        || projectSessionSnapshot.value?.contentHash !== capturedContentHash
      ) {
        return false
      }
      if (prepared.target === 'project')
        return await persistPreparedProject(prepared.document, adapter, activeRepository, prepared.embeddedContents)
      return addPreparedSurface(
        prepared.surface,
        adapter,
        prepared.document,
        prepared.embeddedContents,
      )
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function duplicateProject(projectId: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    if (currentProject.value?.id === projectId && hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'project.duplicateBlocked',
        'Save or resolve the current project before duplicating it.',
      ))
      return false
    }
    busy.value = true
    ui.clearMessage()
    try {
      const source = await activeRepository.get(projectId)
      if (!source)
        throw new TypeError(`Project does not exist: ${projectId}`)
      const document = structuredClone(source.document) as ProjectDocument
      document.name = `${document.name.slice(0, 155)} copy`
      const transfer = await createProjectTransferDocument(
        document,
        input => activeRepository.readEmbedded(input),
      )
      const prepared = await prepareConfigImport({
        source: JSON.stringify(transfer),
        target: 'project',
      })
      if (!prepared.success)
        throw new TypeError(prepared.diagnostics[0]?.message ?? 'Project copy could not be prepared.')
      if (prepared.prepared.target !== 'project')
        throw new TypeError('Project copy preparation returned an invalid target.')
      const adapter = await loadWorkbenchAdapter(prepared.prepared.adapter)
      if (isDisposed() || repository.value !== activeRepository)
        return false
      return await persistPreparedProject(
        prepared.prepared.document,
        adapter,
        activeRepository,
        prepared.prepared.embeddedContents,
      )
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function exportProject(projectId: string): Promise<string | undefined> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return undefined
    busy.value = true
    ui.clearMessage()
    try {
      const project = await activeRepository.get(projectId)
      if (!project)
        throw new TypeError(`Project does not exist: ${projectId}`)
      const filename = await downloadProjectTransfer({
        document: project.document,
        readEmbedded: input => activeRepository.readEmbedded(input),
      })
      ui.notify(workbenchLocale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }))
      return filename
    }
    catch (error) {
      ui.notify(error)
      return undefined
    }
    finally {
      busy.value = false
    }
  }

  return {
    createFromJsonImport,
    duplicateProject,
    exportProject,
    createSurfaceFromTemplate,
    createProjectFromTemplate,
    prepareJsonImport,
  }
}
