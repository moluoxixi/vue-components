import type { ConfigFormDataSourceHost, ConfigFormValueContext } from '@moluoxixi/config-form-core'
import type { createDesignerLocale, DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { PageGraph, ProjectPage, ProjectSummary } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../adapters'
import type { FlowReferenceField, FlowSourceCatalog } from '../../features/flow'
import type { FlowEventTarget } from '../../flow'
import type { ProjectEditorSessionSnapshot, ProjectRecoveryDraftSummary } from '../../project'
import type { createWorkbenchDesignSession, createWorkbenchExportService, PreviewSession } from '../../session'
import type { StudioLayerEntry } from '../../studio'
import type { createWorkbenchCreationCommands } from '../services/controller-creation'
import type { createWorkbenchPageCommands } from '../services/controller-page-commands'
import type { createWorkbenchPersistenceCommands } from '../services/controller-persistence'
import type { createWorkbenchProjectBinding } from '../services/controller-project-binding'

type CreationCommands = ReturnType<typeof createWorkbenchCreationCommands>
type PageCommands = ReturnType<typeof createWorkbenchPageCommands>
type PersistenceCommands = ReturnType<typeof createWorkbenchPersistenceCommands>
type ProjectBinding = ReturnType<typeof createWorkbenchProjectBinding>

export interface WorkbenchControllerProps {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchRecoveryNotice {
  action?: 'fork' | 'reload' | 'versions'
  actionLabel?: string
  message: string
  secondaryAction?: 'fork' | 'reload' | 'versions'
  secondaryActionLabel?: string
  tertiaryAction?: 'fork' | 'reload' | 'versions'
  tertiaryActionLabel?: string
  tone: 'error' | 'warning'
}

export interface WorkbenchRecoveryDraftSummary extends ProjectRecoveryDraftSummary {
  presence: 'active' | 'inactive' | 'unknown'
}

export interface WorkbenchController extends
  Pick<CreationCommands, 'createFromJsonImport' | 'createPageFromTemplate' | 'createProjectFromTemplate' | 'prepareJsonImport'>,
  Pick<PageCommands, 'handlePageAction' | 'selectPageFromDesigner'>,
  Pick<PersistenceCommands,
    | 'createNamedCheckpoint'
    | 'discardRecoveryDraft'
    | 'inspectProjectVersion'
    | 'listProjectVersions'
    | 'listRecoveryDrafts'
    | 'restoreProjectVersion'
    | 'restoreRecoveryDraft'
    | 'reloadCurrentProject'
    | 'saveProject'
    | 'saveCurrentDraftAsProject'
    | 'setProjectVersionLabel'> {
  projects: Ref<ProjectSummary[]>
  busy: Ref<boolean>
  componentRegistry: ComputedRef<WorkbenchAdapter['componentRegistry']>
  configError: Ref<string>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  currentGraph: ComputedRef<PageGraph | undefined>
  currentPage: ComputedRef<ProjectPage | undefined>
  currentPageId: Ref<string>
  dataTestContext: ComputedRef<ConfigFormValueContext>
  dataSourceHost: ConfigFormDataSourceHost
  modelRevision: ComputedRef<number>
  requestDataSource: NonNullable<ConfigFormDataSourceHost['request']>
  designerFieldNames: ComputedRef<string[]>
  flowEventTargets: ComputedRef<FlowEventTarget[]>
  flowReferenceFields: ComputedRef<FlowReferenceField[]>
  flowSourceCatalog: ComputedRef<FlowSourceCatalog>
  designerLayers: ComputedRef<StudioLayerEntry[]>
  dirty: ComputedRef<boolean>
  executeFlowCommand: ProjectBinding['executeProjectCommand']
  getCurrentAdapterId: () => WorkbenchAdapterId
  initialized: Ref<boolean>
  localeOptions: ComputedRef<DesignerLocaleOptions>
  previewState: ComputedRef<{ label: string, tone: 'error' | 'live' }>
  registry: ComputedRef<WorkbenchAdapter['designerRegistry']>
  repositoryRevision: ComputedRef<number>
  recoveryDrafts: ShallowRef<WorkbenchRecoveryDraftSummary[]>
  requestOpenProject: ProjectBinding['requestOpenProject']
  statusLabel: ComputedRef<string>
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
  workspaceRecoveryNotice: ComputedRef<WorkbenchRecoveryNotice | undefined>
  designSession: ReturnType<typeof createWorkbenchDesignSession>
  exportService: ReturnType<typeof createWorkbenchExportService>
  previewSession: PreviewSession
}
