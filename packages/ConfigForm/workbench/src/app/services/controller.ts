import type {
  PageGraph,
  ProjectDocument,
  ProjectRepository,
  ProjectSummary,
} from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../adapters'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  ProjectPersistenceSnapshot,
} from '../../project'
import type { StudioLayerEntry } from '../../studio'
import type {
  WorkbenchControllerProps,
  WorkbenchRecoveryDraftSummary,
  WorkbenchRecoveryNotice,
  WorkbenchUiStore,
} from '../types'
import {
  createDesignerLocale,
  findDesignNode,
  walkDesignGraph,
} from '@moluoxixi/config-form-designer'
import { computed, ref, shallowRef } from 'vue'
import { collectFlowEventTargets } from '../../flow'
import {
  createWorkbenchLocaleOptions,
} from '../../locale'

import {
  createWorkbenchDesignSession,
  createWorkbenchExportService,
  createWorkbenchPreviewSession,
} from '../../session'
import { useWorkbenchControllerLifecycle } from '../composables/use-workbench-controller-lifecycle'
import { createWorkbenchCreationCommands } from './controller-creation'
import { createWorkbenchPageCommands } from './controller-page-commands'
import { createWorkbenchPersistenceCommands } from './controller-persistence'
import { createWorkbenchProjectBinding } from './controller-project-binding'

export function createWorkbenchController(
  props: Readonly<WorkbenchControllerProps>,
  ui: WorkbenchUiStore,
) {
  const repository = shallowRef<ProjectRepository>()
  const currentAdapter = shallowRef<WorkbenchAdapter>()
  const projects = ref<ProjectSummary[]>([])
  const projectSession = shallowRef<ProjectEditorSession>()
  const projectSessionSnapshot = shallowRef<ProjectEditorSessionSnapshot>()
  const persistenceSnapshot = shallowRef<ProjectPersistenceSnapshot>()
  const recoveryDrafts = shallowRef<WorkbenchRecoveryDraftSummary[]>([])
  const currentPageId = ref('')
  const configError = ref('')
  const busy = ref(false)
  const initialized = ref(false)
  let disposed = false
  const previewSession = createWorkbenchPreviewSession({
    onNotify: ui.notify,
    onDiagnostic: diagnostic => ui.notify(diagnostic.message),
  })
  const previewProjection = previewSession.projection
  const designSession = createWorkbenchDesignSession({
    getAdapter: () => currentAdapter.value,
    getPageId: () => currentPageId.value,
    getProjectSession: () => projectSession.value,
    getSnapshot: () => projectSessionSnapshot.value,
    setDiagnostic: message => configError.value = message,
  })
  const exportService = createWorkbenchExportService({
    getAdapter: () => currentAdapter.value,
    getSnapshot: () => projectSessionSnapshot.value,
  })
  const localeOptions = computed(() => createWorkbenchLocaleOptions(
    ui.localeId.value,
    currentAdapter.value?.locale,
    props.locale,
  ))
  const workbenchLocale = computed(() => createDesignerLocale(localeOptions.value))
  const currentProject = computed(() => projectSessionSnapshot.value?.document)
  // The session document is an immutable (deep-frozen) Immer snapshot and
  // every consumer is read-only, so the page is exposed without the previous
  // defensive structuredClone; the cast only relaxes the DeepReadonly view.
  const currentPage = computed(() => projectSessionSnapshot.value?.document.pagesById[currentPageId.value] as ProjectDocument['pagesById'][string] | undefined)
  const currentGraph = computed<PageGraph | undefined>(() => currentPage.value?.graph)
  const componentRegistry = computed(() => currentAdapter.value!.componentRegistry)
  const registry = computed(() => currentAdapter.value!.designerRegistry)
  const modelRevision = computed(() => projectSessionSnapshot.value?.editVersion ?? 0)
  const repositoryRevision = computed(() => projectSessionSnapshot.value?.repositoryRevision ?? 0)
  const dirty = computed(() => projectSessionSnapshot.value?.dirty ?? false)
  const designerLayers = computed<StudioLayerEntry[]>(() => {
    const entries: StudioLayerEntry[] = []
    const graph = currentGraph.value
    if (!graph)
      return entries
    walkDesignGraph(graph, ({ node, path }) => {
      const location = findDesignNode(graph, node.id)
      const sequence = location?.sequence ?? []
      const previous = sequence[location ? location.index - 1 : -1]
      const previousNode = previous ? graph.nodesById[previous.nodeId] : undefined
      const previousMaterial = previousNode ? registry.value.getMaterial(previousNode.component) : undefined
      const material = registry.value.getMaterial(node.component)
      const parentLocation = location?.parent ? findDesignNode(graph, location.parent.id) : undefined
      const parentMaterial = location?.parent ? registry.value.getMaterial(location.parent.component) : undefined
      const sourceSlot = parentMaterial?.kind === 'layout'
        ? parentMaterial.slots.find(slot => slot.name === location?.slot)
        : undefined
      const canLeaveParent = sequence.length > (sourceSlot?.min ?? 0)
      const indentSlot = previousMaterial?.kind === 'layout'
        ? previousMaterial.slots.find(slot => (!slot.accepts || slot.accepts.includes(node.kind))
          && (!slot.materials || slot.materials.includes(node.component))
          && (slot.max === undefined || slot.max > 0))
        : undefined
      const outdentParent = parentLocation?.parent
      const outdentMaterial = outdentParent ? registry.value.getMaterial(outdentParent.component) : undefined
      const outdentSlot = outdentMaterial?.kind === 'layout'
        ? outdentMaterial.slots.find(slot => slot.name === parentLocation?.slot)
        : undefined
      const label = node.kind === 'field'
        ? node.label?.trim() || node.field
        : registry.value.getMaterial(node.component)?.title?.trim() || node.component
      entries.push({
        canIndent: canLeaveParent && previousNode?.kind === 'layout' && Boolean(indentSlot
          && (indentSlot.max === undefined || (previousNode.slots[indentSlot.name]?.length ?? 0) < indentSlot.max)
          && (!material?.allowedParents || material.allowedParents.some(parent => parent.material === previousNode.component && parent.slot === indentSlot.name))),
        canMoveAfter: location ? location.index < sequence.length - 1 : false,
        canMoveBefore: location ? location.index > 0 : false,
        canOutdent: canLeaveParent && Boolean(parentLocation)
          && (!material?.allowedParents || material.allowedParents.some(parent => parent.material === outdentParent?.component && parent.slot === parentLocation?.slot))
          && (!outdentParent || Boolean(outdentSlot
            && (!outdentSlot.accepts || outdentSlot.accepts.includes(node.kind))
            && (!outdentSlot.materials || outdentSlot.materials.includes(node.component))
            && (outdentSlot.max === undefined || (outdentParent.slots[outdentSlot.name]?.length ?? 0) < outdentSlot.max))),
        id: node.id,
        label,
        component: node.component,
        depth: path.filter(segment => segment === 'slots').length,
      })
    })
    return entries
  })
  const designerFieldNames = computed<string[]>(() => {
    const fields: string[] = []
    const graph = currentGraph.value
    if (graph) {
      walkDesignGraph(graph, ({ node }) => {
        if (node.kind === 'field')
          fields.push(node.field)
      })
    }
    return [...new Set(fields)]
  })
  const flowEventTargets = computed(() => collectFlowEventTargets(
    currentGraph.value,
    currentAdapter.value?.componentRegistry,
    currentAdapter.value?.designerRegistry,
    { valueChange: workbenchLocale.value.t('flow.trigger.valueChange', 'Value change') },
  ))

  function getCurrentAdapterId(): WorkbenchAdapterId {
    const adapter = currentAdapter.value?.registrySnapshot.adapter
    if (adapter === 'antd-vue' || adapter === 'element-plus')
      return adapter
    throw new TypeError('Workbench adapter is unavailable.')
  }
  const previewState = computed(() => {
    const projection = previewProjection.value
    if (configError.value || projection?.status === 'stale') {
      return {
        label: workbenchLocale.value.t('preview.staleAt', 'Stale at r{revision}', {
          revision: projection?.display?.snapshot.editVersion ?? modelRevision.value,
        }),
        tone: 'error' as const,
      }
    }
    if (!projection || projection.status === 'blocked')
      return { label: workbenchLocale.value.t('preview.blocked', 'Blocked'), tone: 'error' as const }
    return {
      label: dirty.value
        ? workbenchLocale.value.t('preview.liveDraft', 'Live draft')
        : workbenchLocale.value.t('preview.live', 'Live'),
      tone: 'live' as const,
    }
  })
  const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
  const workspaceRecoveryNotice = computed<WorkbenchRecoveryNotice | undefined>(() => {
    if (persistenceSnapshot.value?.status === 'conflict') {
      return {
        action: 'versions',
        actionLabel: workbenchLocale.value.t('recovery.viewLatest', 'View latest'),
        secondaryAction: 'fork',
        secondaryActionLabel: workbenchLocale.value.t('recovery.saveAsProject', 'Save draft as new project'),
        tertiaryAction: 'reload',
        tertiaryActionLabel: workbenchLocale.value.t('recovery.discardAndReload', 'Discard and reload'),
        message: workbenchLocale.value.t(
          'recovery.revisionConflict',
          'This project changed in another session. Your local work is preserved as a recovery draft. Reload the latest revision or save the draft as another project.',
        ),
        tone: 'error',
      }
    }
    if (repository.value?.persistence === 'volatile') {
      return {
        message: workbenchLocale.value.t(
          'recovery.volatile',
          'Persistent browser storage is unavailable. This temporary workspace will be lost when the page is refreshed.',
        ),
        tone: 'warning',
      }
    }
    return undefined
  })
  const statusLabel = computed(() => {
    if (!repository.value)
      return workbenchLocale.value.t('status.loading', 'Loading')
    switch (persistenceSnapshot.value?.status) {
      case 'saving': return workbenchLocale.value.t('status.saving', 'Autosaving')
      case 'pending': return workbenchLocale.value.t('status.pending', 'Changes pending')
      case 'failed': return workbenchLocale.value.t('status.failed', 'Autosave failed')
      case 'conflict': return workbenchLocale.value.t('status.conflict', 'External revision detected')
      case 'volatile': return workbenchLocale.value.t('status.temporary', 'Temporary session')
      case 'saved': return workbenchLocale.value.t('status.savedAuto', 'Autosaved')
      default: return repository.value.persistence === 'durable'
        ? workbenchLocale.value.t('status.savedAuto', 'Autosaved')
        : workbenchLocale.value.t('status.temporary', 'Temporary session')
    }
  })

  let listRecoveryDraftsPort = async (): Promise<WorkbenchRecoveryDraftSummary[]> => []
  const projectBinding = createWorkbenchProjectBinding({
    configError,
    currentAdapter,
    currentPageId,
    currentProject,
    designSession,
    exportService,
    hasUnsavedChanges,
    isDisposed: () => disposed,
    listRecoveryDrafts: () => listRecoveryDraftsPort(),
    persistenceSnapshot,
    previewSession,
    projectSession,
    projectSessionSnapshot,
    projects,
    recoveryDrafts,
    repository,
    ui,
    workbenchLocale,
  })
  const pageCommands = createWorkbenchPageCommands({
    busy,
    currentProject,
    executeProjectActions: projectBinding.executeProjectActions,
    selectCurrentPage: projectBinding.selectCurrentPage,
    ui,
  })
  const creationCommands = createWorkbenchCreationCommands({
    addPreparedPage: pageCommands.addPreparedPage,
    busy,
    currentProject,
    hasUnsavedChanges,
    isDisposed: () => disposed,
    openProject: projectBinding.openProject,
    projectSessionSnapshot,
    refreshProjects: projectBinding.refreshProjects,
    repository,
    ui,
    workbenchLocale,
  })
  const persistenceCommands = createWorkbenchPersistenceCommands({
    busy,
    configError,
    currentPageId,
    currentProject,
    disposeProjectPersistence: projectBinding.disposeProjectPersistence,
    getPersistenceSession: projectBinding.getPersistenceSession,
    openProject: projectBinding.openProject,
    projectSession,
    recoveryDrafts,
    refreshProjects: projectBinding.refreshProjects,
    repository,
    repositoryRevision,
    ui,
    workbenchLocale,
  })
  listRecoveryDraftsPort = persistenceCommands.listRecoveryDrafts

  useWorkbenchControllerLifecycle({
    beforeDispose: () => {
      disposed = true
      projectBinding.invalidateOpenRequests()
      projectBinding.disposeProjectSubscription()
      designSession.dispose()
      exportService.clear()
      previewSession.dispose()
    },
    beforeUnloadRequired: () => persistenceSnapshot.value?.beforeUnloadRequired ?? false,
    dispose: async () => {
      await projectBinding.disposeProjectPersistence()
      repository.value?.close()
    },
    handleVisibilityHidden: () => projectBinding.getPersistenceSession()?.handleVisibilityHidden(),
    initialize: projectBinding.initializeRepository,
    notify: ui.notify,
    setInitialized: value => initialized.value = value,
  })

  return {
    projects,
    busy,
    componentRegistry,
    configError,
    createFromJsonImport: creationCommands.createFromJsonImport,
    createNamedCheckpoint: persistenceCommands.createNamedCheckpoint,
    createPageFromTemplate: creationCommands.createPageFromTemplate,
    createProjectFromTemplate: creationCommands.createProjectFromTemplate,
    currentProject,
    currentGraph,
    currentPage,
    currentPageId,
    discardRecoveryDraft: persistenceCommands.discardRecoveryDraft,
    designerFieldNames,
    flowEventTargets,
    designerLayers,
    dirty,
    executeFlowCommand: projectBinding.executeProjectCommand,
    getCurrentAdapterId,
    handlePageAction: pageCommands.handlePageAction,
    inspectProjectVersion: persistenceCommands.inspectProjectVersion,
    initialized,
    listProjectVersions: persistenceCommands.listProjectVersions,
    listRecoveryDrafts: persistenceCommands.listRecoveryDrafts,
    localeOptions,
    previewState,
    prepareJsonImport: creationCommands.prepareJsonImport,
    registry,
    repositoryRevision,
    recoveryDrafts,
    requestOpenProject: projectBinding.requestOpenProject,
    restoreProjectVersion: persistenceCommands.restoreProjectVersion,
    restoreRecoveryDraft: persistenceCommands.restoreRecoveryDraft,
    reloadCurrentProject: persistenceCommands.reloadCurrentProject,
    saveProject: persistenceCommands.saveProject,
    saveCurrentDraftAsProject: persistenceCommands.saveCurrentDraftAsProject,
    selectPageFromDesigner: pageCommands.selectPageFromDesigner,
    setProjectVersionLabel: persistenceCommands.setProjectVersionLabel,
    statusLabel,
    workbenchLocale,
    workspaceRecoveryNotice,
    designSession,
    exportService,
    previewSession,
  }
}
