<script setup lang="ts">
import type { DesignerSelectionMode, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { DatasetReference, NodeSubgraph } from '@moluoxixi/config-form-model'
import type { PersistenceDialogMode } from '../features/persistence'
import type { MobileStudioView, WorkbenchExportCommand } from './types'
import type { StudioDiagnostic } from './types/editor-session'
import { Blocks, Files, Layers3, Monitor, Paintbrush, RefreshCw, SlidersHorizontal, Undo2 } from '@lucide/vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createInsertCommand, DesignSurface } from '@moluoxixi/config-form-designer'

import { initializePrototypeProjectSession } from '@moluoxixi/config-form-prototype-runtime/session'
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { downloadProjectTransfer, downloadSurfaceTransfer } from '../project'
import {
  DesignRuntimeHostFrame,
  PreviewDrawer,
  ProjectThemeEditor,
  StudioLeftPanel,
  WorkbenchCommandHint,
  WorkbenchTopbar,
} from './components'
import StudioCommandPalette from './components/StudioCommandPalette.vue'
import StudioDesignRuntime from './components/StudioDesignRuntime.vue'
import StudioDesignToolbar from './components/StudioDesignToolbar.vue'
import StudioIssuesDock from './components/StudioIssuesDock.vue'
import StudioResponsiveCompare from './components/StudioResponsiveCompare.vue'
import {
  useWorkbenchController,
  useWorkbenchDesignSession,
  useWorkbenchExportService,
  useWorkbenchPreviewSession,
  useWorkbenchUiStore,
} from './composables'
import { useStudioCommands } from './composables/studio-commands'
import { projectPagesPath, projectsPath } from './navigation'
import { evaluateStudioExpression } from './services/expression-preview'
import { normalizeDiagnostics, uniqueDiagnostics } from './state/editor-session'

const SourceWorkspace = defineAsyncComponent(() => import('../features/export').then(module => module.SourceWorkspace),
)
const AssetManagerDialog = defineAsyncComponent(() => import('../features/assets').then(module => module.AssetManagerDialog),
)
const PersistenceDialog = defineAsyncComponent(() => import('../features/persistence').then(module => module.PersistenceDialog),
)
const SchemaImportDialog = defineAsyncComponent(() =>
  import('./components/SchemaImportDialog/index.vue'),
)

const router = useRouter()
const controller = useWorkbenchController()
const designSession = useWorkbenchDesignSession()
const previewSession = useWorkbenchPreviewSession()
const exportService = useWorkbenchExportService()
const ui = useWorkbenchUiStore()
const {
  busy,
  componentRegistry,
  configError,
  currentProject,
  currentGraph,
  currentSurface,
  currentSurfaceId,
  designerLayers,
  dirty,
  getCurrentAdapterId,
  localeOptions,
  previewState,
  readEmbeddedResource,
  registry,
  repositoryRevision,
  recoveryDrafts,
  reloadCurrentProject,
  materializeOptionsSnapshot,
  saveProject,
  saveCurrentDraftAsProject,
  saveOptionsAsDataset,
  selectSurfaceFromDesigner,
  setDatasetBinding,
  setResourceBinding,
  statusLabel,
  workbenchLocale,
  workspaceRecoveryNotice,
  updateProjectTheme,
} = controller
const persistenceDialogMode = ref<PersistenceDialogMode>()
const assetManagerOpen = ref(false)
const schemaImportOpen = ref(false)
const responsiveCompareOpen = ref(false)
const existingFields = computed(() =>
  Object.values(currentGraph.value?.nodesById ?? {}).flatMap(node => (node.kind === 'field' ? [node.field] : [])),
)
const assetSelection = ref<{ id?: string, kind?: 'dataset' | 'resource' }>({})
const {
  candidateDiagnostic,
  commandControl: designerCommandControl,
  getCompilation: getDesignRuntimeCompilation,
  historyControl: designerHistoryControl,
  selectedIds: selectedDesignerIds,
} = designSession
const {
  compilation: previewCompilation,
  handleInstanceState: handlePreviewInstanceState,
  handleRuntimeError: handlePreviewRuntimeError,
  handleRuntimeMounted: handlePreviewRuntimeMounted,
  handleRuntimeReady: handlePreviewRuntimeReady,
  handleSession: handlePreviewSession,
  revision: previewRevision,
  session: previewPrototypeSession,
  sessionId: previewSessionId,
} = previewSession
const { capture: captureExportSnapshotInput, getCompilation: getCurrentExportCompilation } = exportService
const {
  clearNotice,
  closeExportPreview,
  exportDialogLoaded,
  exportPreviewMode,
  localeId,
  message,
  mobileStudioView,
  notice,
  openExportPreview,
  openAppearanceDrawer,
  paletteFamily,
  previewExpanded,
  previewOpen,
  previewViewport,
  previewViewportPinned,
  resolvedTheme,
  selectMobileStudioView: selectMobileView,
  setPaletteFamily,
  setPreviewViewport,
  setThemePreference,
  showNotice,
  studioLeftView,
  themePreference,
  toggleLocale,
  togglePreview,
} = ui

const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const mobileDock = useTemplateRef<HTMLElement>('mobileDock')
const { commandOpen, issuesOpen, designerDiagnostics, exportDiagnostics } = ui.editorSession
const studioDiagnostics = computed(() =>
  uniqueDiagnostics([
    ...designerDiagnostics.value,
    ...normalizeDiagnostics(designSession.diagnostics.value, 'compiler', currentSurfaceId.value),
    ...normalizeDiagnostics(candidateDiagnostic.value ? [candidateDiagnostic.value] : [], 'preview'),
    ...normalizeDiagnostics(previewSession.diagnostics.value, 'preview'),
    ...normalizeDiagnostics(exportService.diagnostics.value, 'export'),
    ...exportDiagnostics.value,
    ...(previewSession.error.value
      ? [
          {
            code: 'PREVIEW_HOST_ERROR',
            message: previewSession.error.value.message,
            severity: 'error' as const,
            origin: 'preview' as const,
          },
        ]
      : []),
  ]),
)
const { studioCommands } = useStudioCommands(designer, {
  showDesign,
  experience: toggleWorkspacePreview,
  handoff: () => {
    void handleExportCommand('source')
  },
  assets: showAssetManager,
  schema: () => {
    showDesign()
    schemaImportOpen.value = true
  },
})

watch(currentSurfaceId, () => {
  designerDiagnostics.value = []
})
watch(
  () => currentProject.value?.id,
  () => {
    exportDiagnostics.value = []
  },
)

async function locateDiagnostic(item: StudioDiagnostic): Promise<void> {
  if (item.datasetId || item.resourceId) {
    showAssetManager(item.datasetId ? 'dataset' : 'resource', item.datasetId ?? item.resourceId)
    return
  }
  showDesign()
  if (item.surfaceId && currentProject.value?.surfacesById[item.surfaceId])
    selectSurfaceFromDesigner(item.surfaceId)
  await nextTick()
  if (item.nodeId)
    await designer.value?.inspect(item.nodeId, item.path)
}

async function importSchemaFields(subgraph: NodeSubgraph): Promise<void> {
  if (busy.value || !currentSurfaceId.value)
    return
  const result = designerCommandControl.execute(
    createInsertCommand(
      currentSurfaceId.value,
      subgraph,
      { parentId: null },
      { label: 'Generate fields from JSON Schema' },
    ),
  )
  if (result.changed) {
    schemaImportOpen.value = false
    await nextTick()
    if (subgraph.root[0])
      await designer.value?.inspect(subgraph.root[0].nodeId)
    ui.notify(
      workbenchLocale.value.locale === 'zh-CN'
        ? `已生成 ${subgraph.root.length} 个字段，可整体撤销。`
        : `Generated ${subgraph.root.length} fields. Undo restores the form.`,
    )
  }
  else {
    ui.notify(result.diagnostics[0]?.message ?? 'Schema import was rejected.')
  }
}

function resetExperience(): void {
  const compilation = previewCompilation.value
  if (!compilation)
    return
  const id = crypto.randomUUID()
  const initialized = initializePrototypeProjectSession({
    compilation,
    homeInstanceId: `home-${id}`,
    createRowId: () => crypto.randomUUID(),
  })
  if (initialized.success) {
    previewSession.accept({
      compilation,
      revision: previewRevision.value,
      session: initialized.data,
      sessionId: `experience-${id}`,
    })
  }
  else {
    ui.notify(initialized.diagnostics[0]?.message ?? 'Experience reset failed')
  }
}
const designerDatasets = computed(
  () => currentProject.value?.datasetOrder
    .map(id => currentProject.value?.datasetsById[id])
    .filter(dataset => dataset !== undefined) ?? [],
)
const designerResources = computed(() => Object.values(currentProject.value?.resources ?? {})
  .sort((left, right) => left.name.localeCompare(right.name)),
)
const mobileStudioViews = computed(() => [
  { icon: Blocks, id: 'components' as const, label: workbenchLocale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: workbenchLocale.value.t('designer.view.layers', 'Layers') },
  { icon: Monitor, id: 'canvas' as const, label: workbenchLocale.value.t('designer.view.canvas', 'Canvas') },
  {
    icon: SlidersHorizontal,
    id: 'inspector' as const,
    label: workbenchLocale.value.t('designer.view.inspector', 'Inspector'),
  },
  { icon: Files, id: 'pages' as const, label: workbenchLocale.value.t('designer.view.pages', 'Surfaces') },
  { icon: Paintbrush, id: 'theme' as const, label: workbenchLocale.value.t('designer.view.theme', 'Theme') },
])

function selectMobileStudioView(view: MobileStudioView): void {
  selectMobileView(view)
  if (view === 'canvas') {
    designer.value?.selectWorkspaceView('canvas')
    return
  }
  if (view === 'inspector') {
    designer.value?.selectWorkspaceView('properties')
    return
  }
  designer.value?.selectWorkspaceView('palette')
}

function handleMobileStudioKeydown(event: KeyboardEvent, view: MobileStudioView): void {
  const ids = mobileStudioViews.value.map(item => item.id)
  const index = ids.indexOf(view)
  const nextIndex = event.key === 'ArrowRight'
    ? (index + 1) % ids.length
    : event.key === 'ArrowLeft'
      ? (index - 1 + ids.length) % ids.length
      : event.key === 'Home'
        ? 0
        : event.key === 'End' ? ids.length - 1 : undefined
  if (nextIndex === undefined)
    return
  event.preventDefault()
  const nextView = ids[nextIndex]!
  selectMobileStudioView(nextView)
  void nextTick(() =>
    mobileDock.value
      ?.querySelector<HTMLButtonElement>(`[data-mobile-studio-tab="${nextView}"]`)
      ?.focus(),
  )
}

function selectDesignerLayer(nodeId: string, mode: DesignerSelectionMode): void {
  designer.value?.select(nodeId, mode)
}

function jumpDesignerHistory(position: number): void {
  if (designerHistoryControl.value.jump(position))
    clearNotice()
}

function handleDesignerNotice(messageText: string, undo?: () => boolean): void {
  showNotice({
    message: messageText,
    tone: 'success',
    ...(undo
      ? {
          action: {
            label: workbenchLocale.value.t('action.undo', 'Undo'),
            run: () => {
              if (!undo()) {
                ui.notify(
                  workbenchLocale.value.t('history.undoUnavailable', 'This deletion can no longer be undone here.'),
                )
              }
            },
          },
        }
      : {}),
  })
}

function moveDesignerLayer(action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent', nodeId: string): void {
  designer.value?.performNodeAction(action, nodeId)
}

async function handleExportCommand(command: WorkbenchExportCommand): Promise<void> {
  if (command === 'surface-source') {
    const surfaceId = currentSurface.value?.id
    if (surfaceId)
      await controller.exportSurfaceSource(surfaceId)
    return
  }
  if (command === 'source' || command === 'config') {
    openExportPreview(command)
    return
  }

  const project = currentProject.value
  const surface = currentSurface.value
  if (!project || (command === 'surface-json' && !surface)) {
    showNotice({
      message: workbenchLocale.value.t(
        'export.transferUnavailable',
        'The current project or Surface is unavailable for JSON export.',
      ),
      tone: 'error',
    })
    return
  }

  try {
    const filename = command === 'project-json'
      ? await downloadProjectTransfer({ document: project, readEmbedded: readEmbeddedResource })
      : await downloadSurfaceTransfer({
          document: project,
          readEmbedded: readEmbeddedResource,
          surfaceId: surface!.id,
        })
    showNotice({
      message: workbenchLocale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }),
      tone: 'success',
    })
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    showNotice({
      message: workbenchLocale.value.t('export.transferFailed', 'Unable to export JSON: {reason}', { reason }),
      tone: 'error',
    })
  }
}

function handleDatasetBinding(nodeId: string, bindingKey: string, reference: DatasetReference | undefined): void {
  const changed = setDatasetBinding(currentSurfaceId.value, nodeId, bindingKey, reference)
  showNotice({
    message: changed
      ? workbenchLocale.value.t('data.dataset.saved', 'Dataset binding saved.')
      : workbenchLocale.value.t(
          'data.dataset.rejected',
          'Dataset binding was rejected. Check its projection and query.',
        ),
    tone: changed ? 'success' : 'error',
  })
}

function handleResourceBinding(nodeId: string, bindingKey: string, resourceId: string | undefined): void {
  const changed = setResourceBinding(currentSurfaceId.value, nodeId, bindingKey, resourceId)
  showNotice({
    message: changed
      ? workbenchLocale.value.t('data.resource.saved', 'Resource binding saved.')
      : workbenchLocale.value.t('data.resource.rejected', 'Resource binding was rejected.'),
    tone: changed ? 'success' : 'error',
  })
}

function handleSaveOptionsAsDataset(nodeId: string, bindingKey: string, name: string): void {
  const datasetId = saveOptionsAsDataset(currentSurfaceId.value, nodeId, bindingKey, name)
  showNotice({
    message: datasetId
      ? workbenchLocale.value.t(
          'data.options.saved',
          'Inline options were saved as a Dataset and bound to this component.',
        )
      : workbenchLocale.value.t('data.options.rejected', 'Inline options could not be saved as a Dataset.'),
    tone: datasetId ? 'success' : 'error',
  })
}

function handleMaterializeOptions(nodeId: string, bindingKey: string): void {
  const changed = materializeOptionsSnapshot(currentSurfaceId.value, nodeId, bindingKey)
  showNotice({
    message: changed
      ? workbenchLocale.value.t('data.options.materialized', 'Dataset options were detached as an inline snapshot.')
      : workbenchLocale.value.t('data.options.materializeRejected', 'Dataset options could not be materialized.'),
    tone: changed ? 'success' : 'error',
  })
}

function showSurfaceManager(): void {
  const projectId = currentProject.value?.id
  if (projectId)
    void router.push(projectPagesPath(projectId))
}

function showDesign(): void {
  closeExportPreview()
  if (previewOpen.value)
    togglePreview()
}

function toggleWorkspacePreview(): void {
  if (!previewOpen.value && !currentProject.value?.homeSurfaceId) {
    showNotice({ message: workbenchLocale.value.t('preview.needsPage', 'Add a page to preview the project experience. Dialogs and drawers can already be designed and saved.'), tone: 'info' })
    return
  }
  if (!previewOpen.value)
    closeExportPreview()
  togglePreview()
}

function showAssetManager(kind?: 'dataset' | 'resource', id?: string): void {
  assetSelection.value = { ...(kind ? { kind } : {}), ...(id ? { id } : {}) }
  assetManagerOpen.value = true
}

function exitToProjects(): void {
  void router.push(projectsPath())
}

/**
 * Creation is a routed workspace, so the command records where it came from and
 * navigates; the creation screen returns here and restores trigger focus.
 */
function showPersistenceDialog(mode: PersistenceDialogMode): void {
  persistenceDialogMode.value = mode
}

function handleRecoveryAction(action: 'fork' | 'reload' | 'versions'): void {
  if (action === 'reload') {
    void reloadCurrentProject()
    return
  }
  if (action === 'fork') {
    void saveCurrentDraftAsProject()
    return
  }
  showPersistenceDialog('versions')
}

watch(
  recoveryDrafts,
  (drafts) => {
    if (drafts.length > 0 && !persistenceDialogMode.value)
      persistenceDialogMode.value = 'recovery'
  },
  { immediate: true },
)
</script>

<template>
  <main
    class="workbench-app"
    :data-theme="resolvedTheme"
    :data-palette="paletteFamily"
    data-designer-entry
    tabindex="-1"
  >
    <WorkbenchTopbar
      :project="currentProject"
      :busy="busy"
      :config-error="configError"
      :current-surface="currentSurface"
      :dirty="dirty"
      :locale="localeOptions"
      :locale-id="localeId"
      :palette-family="paletteFamily"
      :preview-open="previewOpen"
      :source-open="Boolean(exportPreviewMode)"
      :repository-revision="repositoryRevision"
      :status-label="statusLabel"
      :theme-preference="themePreference"
      @export="handleExportCommand"
      @create-checkpoint="showPersistenceDialog('checkpoint')"
      @open-projects="exitToProjects"
      @open-appearance="openAppearanceDrawer"
      @open-surfaces="showSurfaceManager"
      @open-versions="showPersistenceDialog('versions')"
      @save="saveProject"
      @set-palette-family="setPaletteFamily"
      @set-theme-preference="setThemePreference"
      @toggle-locale="toggleLocale"
      @toggle-preview="toggleWorkspacePreview"
      @show-design="showDesign"
      @open-commands="commandOpen = true"
    />

    <section
      v-if="currentProject"
      id="workspace-panel"
      class="workbench-layout"
      :class="{
        'is-preview-collapsed': !previewOpen,
        'is-preview-expanded': previewExpanded,
        'show-mobile-preview': previewOpen,
      }"
    >
      <section
        v-show="!previewOpen && !exportPreviewMode"
        id="page-editor-panel"
        class="editor-pane"
        :aria-hidden="previewExpanded ? 'true' : undefined"
        :aria-label="workbenchLocale.t('workbench.designEditor', 'Design editor')"
        :inert="previewExpanded ? true : undefined"
      >
        <div class="provider-surface">
          <DesignSurface
            v-if="currentGraph"
            ref="designer"
            :key="`${currentProject.registryLock.adapter}-${currentSurfaceId}`"
            class="embedded-designer"
            :graph="currentGraph"
            :surface-id="currentSurfaceId"
            :component-registry="componentRegistry"
            :datasets="designerDatasets"
            :expression-evaluator="evaluateStudioExpression"
            :command-hint="WorkbenchCommandHint"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :locale="localeOptions"
            :readonly="busy"
            :renderer="ConfigFormRenderer"
            :resources="designerResources"
            :registry="registry"
            :surface="currentSurface"
            workspace-navigation="external"
            :surfaces="Object.values(currentProject.surfacesById)"
            @notice="handleDesignerNotice"
            @diagnostics="designerDiagnostics = normalizeDiagnostics($event, 'model', currentSurfaceId)"
            @selection-set-change="selectedDesignerIds = $event"
            @update-dataset-binding="handleDatasetBinding"
            @update-resource-binding="handleResourceBinding"
            @save-options-as-dataset="handleSaveOptionsAsDataset"
            @materialize-options-snapshot="handleMaterializeOptions"
          >
            <template #toolbar="scope">
              <StudioDesignToolbar :scope="scope" :locale="localeOptions" @compare="responsiveCompareOpen = true" />
            </template>

            <template #palette="{ materials, addMaterial, readonly, form }">
              <StudioLeftPanel
                v-model:active-view="studioLeftView"
                :project="currentProject"
                :current-surface-id="currentSurfaceId"
                :form="form"
                :history="designerHistoryControl.history"
                :layers="designerLayers"
                :locale="localeOptions"
                :materials="materials"
                :readonly="readonly"
                :registry="registry"
                :selected-ids="selectedDesignerIds"
                @add-material="addMaterial"
                @arrange-layer="moveDesignerLayer"
                @move-layer="
                  (nodeId, referenceId, position) => designer?.moveNodeRelative(nodeId, referenceId, position)
                "
                @jump-history="jumpDesignerHistory"
                @manage-assets="showAssetManager"
                @manage-surfaces="showSurfaceManager"
                @select-layer="selectDesignerLayer"
                @select-surface="selectSurfaceFromDesigner"
              >
                <template #theme>
                  <ProjectThemeEditor
                    :locale="localeOptions"
                    :model-value="currentProject.theme"
                    :readonly="busy"
                    @apply="updateProjectTheme"
                  />
                </template>
              </StudioLeftPanel>
            </template>
            <template #runtime="scope">
              <StudioDesignRuntime
                :surface="currentSurface"
                :scope="scope"
                :adapter="getCurrentAdapterId()"
                :locale="workbenchLocale.locale"
                :namespace="registry.rendererNamespace"
                :resolve-compilation="getDesignRuntimeCompilation"
                :title="workbenchLocale.t('canvas.runtimeFrame', 'Design runtime')"
                @error="message = $event.message"
              />
            </template>

            <template #dragVisual="scope">
              <DesignRuntimeHostFrame
                :adapter="getCurrentAdapterId()"
                :breakpoint="scope.breakpoint"
                :camera-scale="scope.cameraScale"
                :candidate-id="scope.candidateId"
                :candidate-uses-fallback="scope.candidateUsesFallback"
                :canvas-width="scope.canvasWidth"
                :command="scope.command"
                :locale="workbenchLocale.locale"
                :model-value="scope.model"
                :namespace="registry.rendererNamespace"
                :resolve-compilation="getDesignRuntimeCompilation"
                :title="workbenchLocale.t('canvas.dragVisualFrame', 'Drag preview runtime')"
                variant="drag-visual"
                @error="message = $event.message"
              />
            </template>
          </DesignSurface>
        </div>
        <StudioIssuesDock
          v-model:open="issuesOpen"
          :diagnostics="studioDiagnostics"
          :locale="localeId"
          @locate="locateDiagnostic"
        />
      </section>

      <PreviewDrawer
        v-if="previewOpen"
        v-model:expanded="previewExpanded"
        :viewport="previewViewport"
        :adapter="getCurrentAdapterId()"
        :compilation="previewCompilation"
        :locale="localeOptions"
        :namespace="registry.rendererNamespace"
        :open="previewOpen"
        :revision="previewRevision"
        :session="previewPrototypeSession"
        :session-id="previewSessionId"
        :state="previewState"
        :viewport-pinned="previewViewportPinned"
        :instance-states="previewSession.instanceStates.value"
        @reset="resetExperience"
        @close="togglePreview"
        @error="handlePreviewRuntimeError"
        @instance-state="handlePreviewInstanceState"
        @mounted="handlePreviewRuntimeMounted"
        @ready="handlePreviewRuntimeReady"
        @session="handlePreviewSession"
        @update:viewport="setPreviewViewport"
      />

      <section v-if="exportPreviewMode" class="source-pane" :aria-label="workbenchLocale.t('workbench.code', 'Source')">
        <SourceWorkspace
          v-if="exportDialogLoaded"
          :capture="captureExportSnapshotInput"
          :current-compilation="getCurrentExportCompilation()"
          :locale="localeOptions"
          :mode="exportPreviewMode"
          :surface-id="currentSurfaceId"
          :theme="resolvedTheme"
          @notice="showNotice($event)"
          @diagnostics="exportDiagnostics = normalizeDiagnostics($event, 'export')"
          @update:mode="openExportPreview"
        />
      </section>
    </section>

    <nav
      v-if="currentProject"
      ref="mobileDock"
      class="mobile-studio-dock"
      role="tablist"
      :aria-label="workbenchLocale.t('designer.navigation', 'Designer navigation')"
    >
      <button
        v-for="view in mobileStudioViews"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="mobileStudioView === view.id"
        :data-mobile-studio-tab="view.id"
        :tabindex="mobileStudioView === view.id ? 0 : -1"
        @click="selectMobileStudioView(view.id)"
        @keydown="handleMobileStudioKeydown($event, view.id)"
      >
        <component :is="view.icon" :size="17" aria-hidden="true" />
        <span>{{ view.label }}</span>
      </button>
    </nav>

    <AssetManagerDialog
      v-if="currentProject"
      v-model="assetManagerOpen"
      :commands="controller"
      :initial-id="assetSelection.id"
      :initial-kind="assetSelection.kind"
      :locale="localeOptions"
      :project="currentProject"
    />
    <StudioCommandPalette v-model:open="commandOpen" :commands="studioCommands" :locale="localeId" />

    <PersistenceDialog
      :controller="controller"
      :mode="persistenceDialogMode"
      @close="persistenceDialogMode = undefined"
    />

    <Teleport to="#workbench-overlays">
      <StudioResponsiveCompare
        v-if="currentProject && responsiveCompareOpen"
        v-model="responsiveCompareOpen"
        :locale="localeOptions"
      />
      <SchemaImportDialog
        v-if="currentProject && schemaImportOpen"
        v-model="schemaImportOpen"
        :adapter="getCurrentAdapterId()"
        :existing-fields="existingFields"
        :locale="localeOptions"
        @apply="importSchemaFields"
      />
      <ElAlert
        v-if="workspaceRecoveryNotice"
        class="workspace-recovery-notice"
        :type="workspaceRecoveryNotice.tone === 'error' ? 'error' : 'warning'"
        :data-tone="workspaceRecoveryNotice.tone"
        :closable="false"
        show-icon
        :role="workspaceRecoveryNotice.tone === 'error' ? 'alert' : 'status'"
        aria-live="polite"
      >
        <template #title>
          <span class="workspace-recovery-notice__message">{{ workspaceRecoveryNotice.message }}</span>
          <span class="workspace-recovery-notice__actions">
            <ElButton
              v-if="workspaceRecoveryNotice.action"
              native-type="button"
              size="small"
              :disabled="busy"
              @click="handleRecoveryAction(workspaceRecoveryNotice.action)"
            >
              <RefreshCw :size="14" aria-hidden="true" />
              {{ workspaceRecoveryNotice.actionLabel }}
            </ElButton>
            <ElButton
              v-if="workspaceRecoveryNotice.secondaryAction"
              native-type="button"
              size="small"
              :disabled="busy"
              @click="handleRecoveryAction(workspaceRecoveryNotice.secondaryAction)"
            >
              {{ workspaceRecoveryNotice.secondaryActionLabel }}
            </ElButton>
            <ElButton
              v-if="workspaceRecoveryNotice.tertiaryAction"
              native-type="button"
              size="small"
              :disabled="busy"
              @click="handleRecoveryAction(workspaceRecoveryNotice.tertiaryAction)"
            >
              {{ workspaceRecoveryNotice.tertiaryActionLabel }}
            </ElButton>
          </span>
        </template>
      </ElAlert>

      <ElAlert
        v-if="candidateDiagnostic || message"
        class="workbench-message"
        :type="candidateDiagnostic ? 'warning' : 'info'"
        :closable="false"
        :title="
          candidateDiagnostic
            ? workbenchLocale.t(
              'canvas.candidateFailed',
              'Preview could not be calculated. Try again; your project can still be saved.',
            )
            : message
        "
        :description="candidateDiagnostic?.message"
        role="status"
        aria-live="polite"
      />
      <ElAlert
        v-if="notice"
        class="workbench-toast"
        :type="notice.tone"
        :closable="false"
        show-icon
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template #title>
          <span>{{ notice.message }}</span>
          <ElButton v-if="notice.action" native-type="button" text size="small" @click="notice.action.run()">
            <Undo2 :size="14" aria-hidden="true" />
            {{ notice.action.label }}
          </ElButton>
        </template>
      </ElAlert>
    </Teleport>
  </main>
</template>
