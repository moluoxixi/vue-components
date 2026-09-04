import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { ProjectDocument, ProjectRepository } from '@moluoxixi/config-form-model'
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
  instantiateTemplatePage,
  instantiateTemplateProject,
  nextProjectPageId,
  nextProjectPageRoute,
  preflightPreparedProject,
  prepareConfigImport,
} from '../../project'

export function createWorkbenchCreationCommands(options: {
  addPreparedPage: (page: ProjectDocument['pagesById'][string], adapter: WorkbenchAdapter, document: ProjectDocument) => boolean
  busy: Ref<boolean>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  hasUnsavedChanges: ComputedRef<boolean>
  isDisposed: () => boolean
  openProject: (id: string, pageId?: string) => Promise<void>
  projectSessionSnapshot: ShallowRef<ProjectEditorSessionSnapshot | undefined>
  refreshProjects: () => Promise<void>
  repository: ShallowRef<ProjectRepository | undefined>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}) {
  const {
    addPreparedPage,
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
  ): Promise<boolean> {
    preflightPreparedProject(project, adapter.registrySnapshot)
    await activeRepository.create({ document: project })
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

  async function createPageFromTemplate(
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
        target: 'page',
        targetLock: structuredClone(document.registryLock),
      })
      if (!eligibility.eligible)
        throw new TypeError(eligibility.diagnostics[0]?.message ?? 'Template requirements do not match the current project Registry.')
      const id = nextProjectPageId(document, name)
      const page = instantiateTemplatePage(template, {
        id,
        name,
        route: nextProjectPageRoute(document, name),
      })
      return addPreparedPage(page, adapter, structuredClone(document) as ProjectDocument)
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
      target === 'page'
      && (
        currentProject.value?.id !== capturedProjectId
        || projectSessionSnapshot.value?.contentHash !== capturedContentHash
      )
    ) {
      return {
        success: false,
        diagnostics: [{
          code: 'IMPORT_STALE',
          message: 'The active project changed while the page import was being analyzed.',
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
    if (prepared.target === 'page' && !document)
      return false
    if (
      prepared.target === 'page'
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
        return await persistPreparedProject(prepared.document, adapter, activeRepository)
      return addPreparedPage(prepared.page, adapter, structuredClone(document!) as ProjectDocument)
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  return {
    createFromJsonImport,
    createPageFromTemplate,
    createProjectFromTemplate,
    prepareJsonImport,
  }
}
