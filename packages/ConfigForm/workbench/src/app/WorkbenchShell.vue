<script setup lang="ts">
import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerSelectionMode, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { MobileStudioView } from './workbench-ui-store'
import type { PersistenceDialogMode } from '../features/persistence/PersistenceDialog.vue'
import type { TemplateCreationTarget } from '../project'
import {
  Blocks,
  Copy,
  Files,
  Layers3,
  Monitor,
  Redo2,
  RefreshCw,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from '@lucide/vue'
import { DesignSurface } from '@moluoxixi/config-form-designer'
import { computed, defineAsyncComponent, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import DesignRuntimeHostFrame from '../runtime-host/DesignRuntimeHostFrame.vue'
import PreviewDrawer from '../studio/PreviewDrawer.vue'
import StudioLeftPanel from '../studio/StudioLeftPanel.vue'
import WorkbenchCommandTooltip from './WorkbenchCommandTooltip.vue'
import WorkbenchTopbar from './WorkbenchTopbar.vue'
import {
  useWorkbenchController,
  useWorkbenchDesignSession,
  useWorkbenchExportService,
  useWorkbenchPreviewSession,
  useWorkbenchUiStore,
} from './workbench-context'

defineProps<{
  creationReturnFocusKey?: string
}>()

const ExportDialog = defineAsyncComponent(() => import('../features/export/ExportDialog.vue'))
const FlowDialog = defineAsyncComponent(() => import('../features/flow/FlowDialog.vue'))
const PageManagerDialog = defineAsyncComponent(() => import('../features/pages/PageManagerDialog.vue'))
const PersistenceDialog = defineAsyncComponent(() => import('../features/persistence/PersistenceDialog.vue'))

const emit = defineEmits<{
  create: [request: { focusKey: string, target: TemplateCreationTarget }]
  creationFocusRestored: []
}>()

const controller = useWorkbenchController()
const designSession = useWorkbenchDesignSession()
const previewSession = useWorkbenchPreviewSession()
const exportService = useWorkbenchExportService()
const ui = useWorkbenchUiStore()
const {
  projects,
  busy,
  componentRegistry,
  configError,
  currentProject,
  currentGraph,
  currentPage,
  currentPageId,
  designerFieldNames,
  flowEventTargets,
  designerLayers,
  dirty,
  executeFlowCommand,
  getCurrentAdapterId,
  handlePageAction,
  localeOptions,
  previewState,
  registry,
  repositoryRevision,
  recoveryDrafts,
  requestOpenProject,
  reloadCurrentProject,
  saveProject,
  saveCurrentDraftAsProject,
  selectPageFromDesigner,
  statusLabel,
  workbenchLocale,
  workspaceRecoveryNotice,
} = controller
const persistenceDialogMode = ref<PersistenceDialogMode>()
const {
  commandControl: designerCommandControl,
  getCompilation: getDesignRuntimeCompilation,
  historyControl: designerHistoryControl,
  runtime: designRuntime,
  selectedIds: selectedDesignerIds,
} = designSession
const {
  flowProjection: previewFlowProjection,
  getCompilation: getPreviewCompilation,
  handleFieldChange: handlePreviewFieldChange,
  handleRuntimeEvent: handlePreviewRuntimeEvent,
  handleRuntimeMounted: handlePreviewRuntimeMounted,
  handleRuntimeReady: handlePreviewRuntimeReady,
  handleRuntimeState: handlePreviewRuntimeState,
  handleSubmitResult: handlePreviewSubmitResult,
  handleSubmit: handlePreviewSubmit,
  clearSubmission: clearPreviewSubmission,
  lastSubmission: previewLastSubmission,
  projection: previewProjection,
  runtimeState: previewRuntimeState,
} = previewSession
const {
  capture: captureExportSnapshotInput,
  getCompilation: getCurrentExportCompilation,
} = exportService
const {
  clearNotice,
  closeExportPreview,
  closeFlowWorkspace,
  closePageManager,
  exportDialogLoaded,
  exportPreviewMode,
  flowDialogLoaded,
  flowInitialTrigger,
  flowWorkspaceOpen,
  localeId,
  message,
  mobileStudioView,
  notice,
  openExportPreview,
  openFlowWorkspace,
  openPageManager,
  pageManagerLoaded,
  pageManagerOpen,
  previewExpanded,
  previewOpen,
  previewViewport,
  selectMobileStudioView: selectMobileView,
  showNotice,
  studioLeftView,
  theme,
  toggleLocale,
  togglePreview,
  toggleTheme,
} = ui

const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const mobileDock = useTemplateRef<HTMLElement>('mobileDock')
const workbenchRoot = useTemplateRef<HTMLElement>('workbenchRoot')
const overlayRoot = ref<HTMLElement>()
const mobileStudioViews = computed(() => [
  { icon: Blocks, id: 'components' as const, label: workbenchLocale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: workbenchLocale.value.t('designer.view.layers', 'Layers') },
  { icon: Monitor, id: 'canvas' as const, label: workbenchLocale.value.t('designer.view.canvas', 'Canvas') },
  { icon: SlidersHorizontal, id: 'inspector' as const, label: workbenchLocale.value.t('designer.view.inspector', 'Inspector') },
  { icon: Files, id: 'pages' as const, label: workbenchLocale.value.t('designer.view.pages', 'Pages') },
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
  void nextTick(() => mobileDock.value
    ?.querySelector<HTMLButtonElement>(`[data-mobile-studio-tab="${nextView}"]`)
    ?.focus())
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
              if (!undo())
                ui.notify(workbenchLocale.value.t('history.undoUnavailable', 'This deletion can no longer be undone here.'))
            },
          },
        }
      : {}),
  })
}

function moveDesignerLayer(
  action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent',
  nodeId: string,
): void {
  designer.value?.performNodeAction(action, nodeId)
}

function showExportDialog(mode: 'source' | 'config'): void {
  openExportPreview(mode)
}

function showFlowDialog(trigger?: ConfigFormFlowTrigger): void {
  openFlowWorkspace(trigger)
}

function showComponentEventFlow(nodeId: string, eventName: string): void {
  showFlowDialog({ kind: 'component.event', nodeId, event: eventName })
}

function showPageManager(): void {
  openPageManager()
}

function requestCreation(target: TemplateCreationTarget, focusKey: string): void {
  emit('create', { focusKey, target })
}

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

watch(recoveryDrafts, (drafts) => {
  if (drafts.length > 0 && !persistenceDialogMode.value)
    persistenceDialogMode.value = 'recovery'
}, { immediate: true })

onMounted(() => {
  overlayRoot.value = document.getElementById('workbench-overlays') ?? undefined
})
</script>

<template>
  <main ref="workbenchRoot" class="workbench-app" :data-theme="theme" data-designer-entry tabindex="-1">
    <WorkbenchCommandTooltip :root="workbenchRoot" :overlay-root="overlayRoot" />
    <WorkbenchTopbar
      :project="currentProject"
      :busy="busy"
      :config-error="configError"
      :current-page="currentPage"
      :dirty="dirty"
      :flow-open="flowWorkspaceOpen"
      :locale="localeOptions"
      :locale-id="localeId"
      :preview-open="previewOpen"
      :repository-revision="repositoryRevision"
      :status-label="statusLabel"
      :theme="theme"
      @export="showExportDialog"
      @create-checkpoint="showPersistenceDialog('checkpoint')"
      @new-page="requestCreation('page', $event)"
      @open-flow="showFlowDialog()"
      @open-pages="showPageManager"
      @open-versions="showPersistenceDialog('versions')"
      @save="saveProject"
      @toggle-locale="toggleLocale"
      @toggle-preview="togglePreview"
      @toggle-theme="toggleTheme"
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
        id="page-editor-panel"
        class="editor-pane"
        :aria-hidden="previewExpanded ? 'true' : undefined"
        :aria-label="workbenchLocale.t('workbench.designEditor', 'Design editor')"
        :inert="previewExpanded ? true : undefined"
      >
        <div class="provider-surface">
          <DesignSurface
            v-if="currentGraph && designRuntime"
            ref="designer"
            :key="`${currentProject.registryLock.adapter}-${currentPageId}`"
            class="embedded-designer"
            :graph="currentGraph"
            event-editor="flow"
            :page-id="currentPageId"
            :component-registry="componentRegistry"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :locale="localeOptions"
            :readonly="busy"
            :registry="registry"
            :runtime-renderer="designRuntime.artifact.plan.renderer"
            workspace-navigation="external"
            @configure-event="showComponentEventFlow"
            @notice="handleDesignerNotice"
            @selection-set-change="selectedDesignerIds = $event"
           >
            <template #toolbar="{ breakpoint, canUndo, canRedo, canEditSelection, copySelection, removeSelection, selectBreakpoint, undo, redo }">
              <div class="mx-config-form-designer__toolbar-actions" role="toolbar" :aria-label="workbenchLocale.t('designer.commands', 'Designer commands')">
                <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canUndo ? 'true' : undefined" :data-command-disabled-reason="!canUndo ? workbenchLocale.t('action.undoUnavailable', 'No operation to undo') : undefined" data-command-hint data-command-shortcut="Ctrl/Cmd+Z" :title="workbenchLocale.t('action.undoShortcut', 'Undo (Ctrl/Cmd+Z)')" :aria-label="workbenchLocale.t('action.undo', 'Undo')" aria-keyshortcuts="Control+Z Meta+Z" @click="canUndo && undo()">
                  <Undo2 :size="17" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canRedo ? 'true' : undefined" :data-command-disabled-reason="!canRedo ? workbenchLocale.t('action.redoUnavailable', 'No operation to redo') : undefined" data-command-hint data-command-shortcut="Ctrl/Cmd+Shift+Z" :title="workbenchLocale.t('action.redoShortcut', 'Redo (Ctrl/Cmd+Shift+Z)')" :aria-label="workbenchLocale.t('action.redo', 'Redo')" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" @click="canRedo && redo()">
                  <Redo2 :size="17" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canEditSelection ? 'true' : undefined" :data-command-disabled-reason="!canEditSelection ? workbenchLocale.t('node.selectionRequired', 'Select a component first') : undefined" data-command-hint data-command-shortcut="Ctrl/Cmd+D" :title="workbenchLocale.t('node.copySelectionShortcut', 'Copy selection (Ctrl/Cmd+D)')" :aria-label="workbenchLocale.t('node.copySelection', 'Copy selection')" aria-keyshortcuts="Control+D Meta+D" @click="canEditSelection && copySelection()">
                  <Copy :size="16" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button is-danger" :aria-disabled="!canEditSelection ? 'true' : undefined" :data-command-disabled-reason="!canEditSelection ? workbenchLocale.t('node.selectionRequired', 'Select a component first') : undefined" data-command-hint data-command-shortcut="Delete" :title="workbenchLocale.t('node.deleteSelectionShortcut', 'Delete selection (Delete)')" :aria-label="workbenchLocale.t('node.deleteSelection', 'Delete selection')" aria-keyshortcuts="Delete Backspace" @click="canEditSelection && removeSelection()">
                  <Trash2 :size="16" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <div class="mx-config-form-designer__segmented" role="group" :aria-label="workbenchLocale.t('canvas.viewport', 'Canvas viewport')">
                  <button type="button" :class="{ 'is-active': breakpoint === 'desktop' }" :aria-pressed="breakpoint === 'desktop'" :title="workbenchLocale.t('canvas.desktop', 'Desktop')" :aria-label="workbenchLocale.t('canvas.desktop', 'Desktop')" data-command-hint @click="selectBreakpoint('desktop')">
                    <Monitor :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'tablet' }" :aria-pressed="breakpoint === 'tablet'" :title="workbenchLocale.t('canvas.tablet', 'Tablet')" :aria-label="workbenchLocale.t('canvas.tablet', 'Tablet')" data-command-hint @click="selectBreakpoint('tablet')">
                    <Tablet :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'mobile' }" :aria-pressed="breakpoint === 'mobile'" :title="workbenchLocale.t('canvas.mobile', 'Mobile')" :aria-label="workbenchLocale.t('canvas.mobile', 'Mobile')" data-command-hint @click="selectBreakpoint('mobile')">
                    <Smartphone :size="15" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </template>

            <template #palette="{ materials, addMaterial, readonly, form }">
              <StudioLeftPanel
                v-model:active-view="studioLeftView"
                :project="currentProject"
                :current-page-id="currentPageId"
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
                @jump-history="jumpDesignerHistory"
                @manage-pages="showPageManager"
                @select-layer="selectDesignerLayer"
                @select-page="selectPageFromDesigner"
              />
            </template>
            <template #runtime="scope">
              <DesignRuntimeHostFrame
                :adapter="getCurrentAdapterId()"
                :breakpoint="scope.breakpoint"
                :camera-scale="scope.cameraScale"
                :candidate-id="scope.candidateId"
                :candidate-uses-fallback="scope.candidateUsesFallback"
                :command="scope.command"
                :locale="workbenchLocale.locale"
                :model-value="scope.model"
                :namespace="registry.rendererNamespace"
                :reaction-props="scope.reactionProps"
                :reaction-states="scope.reactionStates"
                :resolve-compilation="getDesignRuntimeCompilation"
                :title="workbenchLocale.t('canvas.runtimeFrame', 'Design runtime')"
                variant="canvas"
                @error="message = $event.message"
                @geometry="scope.bridge.updateGeometry"
                @pointer-cancel="scope.bridge.pointerCancel"
                @pointer-down="scope.bridge.pointerDown"
                @pointer-move="scope.bridge.pointerMove"
                @pointer-up="scope.bridge.pointerUp"
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
                :reaction-props="scope.reactionProps"
                :reaction-states="scope.reactionStates"
                :resolve-compilation="getDesignRuntimeCompilation"
                :title="workbenchLocale.t('canvas.dragVisualFrame', 'Drag preview runtime')"
                variant="drag-visual"
                @error="message = $event.message"
              />
            </template>
          </DesignSurface>
        </div>
      </section>

      <PreviewDrawer
        v-model:expanded="previewExpanded"
        v-model:viewport="previewViewport"
        :adapter="getCurrentAdapterId()"
        :compilation="getPreviewCompilation()"
        :config-error="configError"
        :locale="localeOptions"
        :runtime-state="previewRuntimeState"
        :last-submission="previewLastSubmission"
        :namespace="registry.rendererNamespace"
        :open="previewOpen"
        :projection="previewProjection"
        :reaction-projection="previewFlowProjection"
        :state="previewState"
        @close="togglePreview"
        @error="message = $event instanceof Error ? $event.message : String($event)"
        @field-change="handlePreviewFieldChange"
        @runtime-event="handlePreviewRuntimeEvent"
        @runtime-mounted="handlePreviewRuntimeMounted"
        @ready="handlePreviewRuntimeReady"
        @runtime-state="handlePreviewRuntimeState"
        @submit="handlePreviewSubmit"
        @submit-result="handlePreviewSubmitResult"
        @clear-submission="clearPreviewSubmission"
        @message="message = $event"
      />
    </section>

    <nav v-if="currentProject" ref="mobileDock" class="mobile-studio-dock" role="tablist" :aria-label="workbenchLocale.t('designer.navigation', 'Designer navigation')">
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

    <PageManagerDialog
      v-if="pageManagerLoaded"
      :project="currentProject"
      :projects="projects"
      :busy="busy"
      :locale="localeOptions"
      :open="pageManagerOpen"
      :return-focus-key="creationReturnFocusKey"
      @close="closePageManager"
      @create-page="requestCreation('page', 'page-manager-new-page')"
      @create-project="requestCreation('project', 'page-manager-new-project')"
      @open-project="requestOpenProject($event)"
      @action="handlePageAction"
      @return-focus-restored="emit('creationFocusRestored')"
    />

    <FlowDialog
      v-if="flowDialogLoaded"
      :field-names="designerFieldNames"
      :event-targets="flowEventTargets"
      :flows="currentPage?.flows ?? []"
      :initial-trigger="flowInitialTrigger"
      :locale="localeOptions"
      :open="flowWorkspaceOpen"
      :page-id="currentPageId"
      :readonly="busy"
      @close="closeFlowWorkspace"
      @command="executeFlowCommand"
    />

    <ExportDialog
      v-if="exportDialogLoaded"
      :capture="captureExportSnapshotInput"
      :current-compilation="getCurrentExportCompilation()"
      :locale="localeOptions"
      :mode="exportPreviewMode"
      :theme="theme"
      @close="closeExportPreview"
      @message="message = $event"
    />

    <PersistenceDialog
      :mode="persistenceDialogMode"
      @close="persistenceDialogMode = undefined"
    />

    <Teleport to="#workbench-overlays">
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
        v-if="message"
        class="workbench-message"
        type="info"
        :closable="false"
        :title="message"
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
