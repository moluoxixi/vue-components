<script setup lang="ts">
import type { DesignerSelectionMode, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { PersistenceDialogMode } from '../features/persistence'
import type { TemplateCreationTarget } from '../project'
import type { WorkbenchExportCommand, WorkbenchShellEmits, WorkbenchShellProps } from './types'
import type { MobileStudioView } from './types'
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
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef, watch } from 'vue'
import { downloadProjectTransfer, downloadSurfaceTransfer } from '../project'
import { DesignRuntimeHostFrame, PreviewDrawer, StudioLeftPanel, WorkbenchCommandHint, WorkbenchTopbar } from './components'
import {
  useWorkbenchController,
  useWorkbenchDesignSession,
  useWorkbenchExportService,
  useWorkbenchPreviewSession,
  useWorkbenchUiStore,
} from './composables'

defineProps<WorkbenchShellProps>()

const ExportDialog = defineAsyncComponent(() => import('../features/export').then(module => module.ExportDialog))
const SurfaceManagerDialog = defineAsyncComponent(() => import('../features/pages').then(module => module.SurfaceManagerDialog))
const PersistenceDialog = defineAsyncComponent(() => import('../features/persistence').then(module => module.PersistenceDialog))

const emit = defineEmits<WorkbenchShellEmits>()

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
  currentSurface,
  currentSurfaceId,
  designerLayers,
  dirty,
  getCurrentAdapterId,
  handleSurfaceAction,
  localeOptions,
  previewState,
  readEmbeddedResource,
  registry,
  repositoryRevision,
  recoveryDrafts,
  requestOpenProject,
  reloadCurrentProject,
  saveProject,
  saveCurrentDraftAsProject,
  selectSurfaceFromDesigner,
  statusLabel,
  workbenchLocale,
  workspaceRecoveryNotice,
} = controller
const persistenceDialogMode = ref<PersistenceDialogMode>()
const {
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
const {
  capture: captureExportSnapshotInput,
  getCompilation: getCurrentExportCompilation,
} = exportService
const {
  clearNotice,
  closeExportPreview,
  closeSurfaceManager,
  exportDialogLoaded,
  exportPreviewMode,
  localeId,
  message,
  mobileStudioView,
  notice,
  openExportPreview,
  openAppearanceDrawer,
  openSurfaceManager,
  pageManagerLoaded,
  pageManagerOpen,
  paletteFamily,
  previewExpanded,
  previewOpen,
  previewViewport,
  resolvedTheme,
  selectMobileStudioView: selectMobileView,
  setPaletteFamily,
  setThemePreference,
  showNotice,
  studioLeftView,
  themePreference,
  toggleLocale,
  togglePreview,
} = ui

const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const mobileDock = useTemplateRef<HTMLElement>('mobileDock')
const mobileStudioViews = computed(() => [
  { icon: Blocks, id: 'components' as const, label: workbenchLocale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: workbenchLocale.value.t('designer.view.layers', 'Layers') },
  { icon: Monitor, id: 'canvas' as const, label: workbenchLocale.value.t('designer.view.canvas', 'Canvas') },
  { icon: SlidersHorizontal, id: 'inspector' as const, label: workbenchLocale.value.t('designer.view.inspector', 'Inspector') },
  { icon: Files, id: 'pages' as const, label: workbenchLocale.value.t('designer.view.pages', 'Surfaces') },
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

async function handleExportCommand(command: WorkbenchExportCommand): Promise<void> {
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
      message: workbenchLocale.value.t(
        'export.transferFailed',
        'Unable to export JSON: {reason}',
        { reason },
      ),
      tone: 'error',
    })
  }
}

function showSurfaceManager(): void {
  openSurfaceManager()
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
      :repository-revision="repositoryRevision"
      :status-label="statusLabel"
      :theme-preference="themePreference"
      @export="handleExportCommand"
      @create-checkpoint="showPersistenceDialog('checkpoint')"
      @new-surface="requestCreation('surface', $event)"
      @open-appearance="openAppearanceDrawer"
      @open-surfaces="showSurfaceManager"
      @open-versions="showPersistenceDialog('versions')"
      @save="saveProject"
      @set-palette-family="setPaletteFamily"
      @set-theme-preference="setThemePreference"
      @toggle-locale="toggleLocale"
      @toggle-preview="togglePreview"
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
            v-if="currentGraph"
            ref="designer"
            :key="`${currentProject.registryLock.adapter}-${currentSurfaceId}`"
            class="embedded-designer"
            :graph="currentGraph"
            :surface-id="currentSurfaceId"
            :component-registry="componentRegistry"
            :command-hint="WorkbenchCommandHint"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :locale="localeOptions"
            :readonly="busy"
            :renderer="ConfigFormRenderer"
            :registry="registry"
            workspace-navigation="external"
            @notice="handleDesignerNotice"
            @selection-set-change="selectedDesignerIds = $event"
           >
            <template #toolbar="{ breakpoint, canUndo, canRedo, canEditSelection, copySelection, removeSelection, selectBreakpoint, undo, redo }">
              <div class="mx-config-form-designer__toolbar-actions" role="toolbar" :aria-label="workbenchLocale.t('designer.commands', 'Designer commands')">
                <WorkbenchCommandHint :label="workbenchLocale.t('action.undo', 'Undo')" shortcut="Ctrl/Cmd+Z" :disabled-reason="!canUndo ? workbenchLocale.t('action.undoUnavailable', 'No operation to undo') : undefined">
                  <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canUndo ? 'true' : undefined" :title="workbenchLocale.t('action.undoShortcut', 'Undo (Ctrl/Cmd+Z)')" :aria-label="workbenchLocale.t('action.undo', 'Undo')" aria-keyshortcuts="Control+Z Meta+Z" @click="canUndo && undo()">
                    <Undo2 :size="17" aria-hidden="true" />
                  </button>
                </WorkbenchCommandHint>
                <WorkbenchCommandHint :label="workbenchLocale.t('action.redo', 'Redo')" shortcut="Ctrl/Cmd+Shift+Z" :disabled-reason="!canRedo ? workbenchLocale.t('action.redoUnavailable', 'No operation to redo') : undefined">
                  <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canRedo ? 'true' : undefined" :title="workbenchLocale.t('action.redoShortcut', 'Redo (Ctrl/Cmd+Shift+Z)')" :aria-label="workbenchLocale.t('action.redo', 'Redo')" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" @click="canRedo && redo()">
                    <Redo2 :size="17" aria-hidden="true" />
                  </button>
                </WorkbenchCommandHint>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <WorkbenchCommandHint :label="workbenchLocale.t('node.copySelection', 'Copy selection')" shortcut="Ctrl/Cmd+D" :disabled-reason="!canEditSelection ? workbenchLocale.t('node.selectionRequired', 'Select a component first') : undefined">
                  <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="!canEditSelection ? 'true' : undefined" :title="workbenchLocale.t('node.copySelectionShortcut', 'Copy selection (Ctrl/Cmd+D)')" :aria-label="workbenchLocale.t('node.copySelection', 'Copy selection')" aria-keyshortcuts="Control+D Meta+D" @click="canEditSelection && copySelection()">
                    <Copy :size="16" aria-hidden="true" />
                  </button>
                </WorkbenchCommandHint>
                <WorkbenchCommandHint :label="workbenchLocale.t('node.deleteSelection', 'Delete selection')" shortcut="Delete" :disabled-reason="!canEditSelection ? workbenchLocale.t('node.selectionRequired', 'Select a component first') : undefined">
                  <button type="button" class="mx-config-form-designer__icon-button is-danger" :aria-disabled="!canEditSelection ? 'true' : undefined" :title="workbenchLocale.t('node.deleteSelectionShortcut', 'Delete selection (Delete)')" :aria-label="workbenchLocale.t('node.deleteSelection', 'Delete selection')" aria-keyshortcuts="Delete Backspace" @click="canEditSelection && removeSelection()">
                    <Trash2 :size="16" aria-hidden="true" />
                  </button>
                </WorkbenchCommandHint>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <div class="mx-config-form-designer__segmented" role="group" :aria-label="workbenchLocale.t('canvas.viewport', 'Canvas viewport')">
                  <WorkbenchCommandHint :label="workbenchLocale.t('canvas.desktop', 'Desktop')">
                    <button type="button" :class="{ 'is-active': breakpoint === 'desktop' }" :aria-pressed="breakpoint === 'desktop'" :title="workbenchLocale.t('canvas.desktop', 'Desktop')" :aria-label="workbenchLocale.t('canvas.desktop', 'Desktop')" @click="selectBreakpoint('desktop')">
                      <Monitor :size="15" aria-hidden="true" />
                    </button>
                  </WorkbenchCommandHint>
                  <WorkbenchCommandHint :label="workbenchLocale.t('canvas.tablet', 'Tablet')">
                    <button type="button" :class="{ 'is-active': breakpoint === 'tablet' }" :aria-pressed="breakpoint === 'tablet'" :title="workbenchLocale.t('canvas.tablet', 'Tablet')" :aria-label="workbenchLocale.t('canvas.tablet', 'Tablet')" @click="selectBreakpoint('tablet')">
                      <Tablet :size="15" aria-hidden="true" />
                    </button>
                  </WorkbenchCommandHint>
                  <WorkbenchCommandHint :label="workbenchLocale.t('canvas.mobile', 'Mobile')">
                    <button type="button" :class="{ 'is-active': breakpoint === 'mobile' }" :aria-pressed="breakpoint === 'mobile'" :title="workbenchLocale.t('canvas.mobile', 'Mobile')" :aria-label="workbenchLocale.t('canvas.mobile', 'Mobile')" @click="selectBreakpoint('mobile')">
                      <Smartphone :size="15" aria-hidden="true" />
                    </button>
                  </WorkbenchCommandHint>
                </div>
              </div>
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
                @move-layer="(nodeId, referenceId, position) => designer?.moveNodeRelative(nodeId, referenceId, position)"
                @jump-history="jumpDesignerHistory"
                @manage-surfaces="showSurfaceManager"
                @select-layer="selectDesignerLayer"
                @select-surface="selectSurfaceFromDesigner"
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
                :resolve-compilation="getDesignRuntimeCompilation"
                :title="workbenchLocale.t('canvas.runtimeFrame', 'Design runtime')"
                variant="canvas"
                @error="message = $event.message"
                @geometry="scope.bridge.updateGeometry"
                @context-menu="scope.bridge.contextMenu"
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
        :compilation="previewCompilation"
        :locale="localeOptions"
        :namespace="registry.rendererNamespace"
        :open="previewOpen"
        :revision="previewRevision"
        :session="previewPrototypeSession"
        :session-id="previewSessionId"
        :state="previewState"
        @close="togglePreview"
        @error="handlePreviewRuntimeError"
        @instance-state="handlePreviewInstanceState"
        @mounted="handlePreviewRuntimeMounted"
        @ready="handlePreviewRuntimeReady"
        @session="handlePreviewSession"
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

    <SurfaceManagerDialog
      v-if="pageManagerLoaded"
      :project="currentProject"
      :projects="projects"
      :busy="busy"
      :locale="localeOptions"
      :open="pageManagerOpen"
      :return-focus-key="creationReturnFocusKey"
      @close="closeSurfaceManager"
      @create-surface="requestCreation('surface', 'page-manager-new-surface')"
      @create-project="requestCreation('project', 'page-manager-new-project')"
      @open-project="requestOpenProject($event)"
      @action="handleSurfaceAction"
      @return-focus-restored="emit('creationFocusRestored')"
    />

    <ExportDialog
      v-if="exportDialogLoaded"
      :capture="captureExportSnapshotInput"
      :current-compilation="getCurrentExportCompilation()"
      :locale="localeOptions"
      :mode="exportPreviewMode"
      :theme="resolvedTheme"
      @close="closeExportPreview"
      @message="message = $event"
    />

    <PersistenceDialog
      :controller="controller"
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
