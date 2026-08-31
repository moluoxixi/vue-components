<script setup lang="ts">
import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerSelectionMode, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { MobileStudioView } from './workbench-ui-store'
import {
  AlertTriangle,
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
import { computed, defineAsyncComponent, nextTick, useTemplateRef } from 'vue'
import DesignRuntimeHostFrame from '../runtime-host/DesignRuntimeHostFrame.vue'
import PreviewDrawer from '../studio/PreviewDrawer.vue'
import StudioLeftPanel from '../studio/StudioLeftPanel.vue'
import TemplateDialog from '../features/templates/TemplateDialog.vue'
import WorkbenchTopbar from './WorkbenchTopbar.vue'
import {
  useWorkbenchController,
  useWorkbenchDesignSession,
  useWorkbenchExportService,
  useWorkbenchPreviewSession,
  useWorkbenchUiStore,
} from './workbench-context'

const ExportDialog = defineAsyncComponent(() => import('../features/export/ExportDialog.vue'))
const FlowDialog = defineAsyncComponent(() => import('../features/flow/FlowDialog.vue'))
const PageManagerDialog = defineAsyncComponent(() => import('../features/pages/PageManagerDialog.vue'))

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
  createProject,
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
  requestOpenProject,
  reloadCurrentProject,
  saveProject,
  selectPageFromDesigner,
  selectTemplate,
  statusLabel,
  templates,
  workbenchLocale,
  workspaceRecoveryNotice,
} = controller
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
  handleSubmit: handlePreviewSubmit,
  projection: previewProjection,
  runtimeState: previewRuntimeState,
} = previewSession
const {
  capture: captureExportSnapshotInput,
  getCompilation: getCurrentExportCompilation,
} = exportService
const {
  closeExportPreview,
  closeFlowWorkspace,
  closePageManager,
  closeTemplatePicker,
  exportDialogLoaded,
  exportPreviewMode,
  flowDialogLoaded,
  flowInitialTrigger,
  flowWorkspaceOpen,
  localeId,
  message,
  mobileStudioView,
  openExportPreview,
  openFlowWorkspace,
  openPageManager,
  openPageTemplatePicker,
  openTemplatePicker,
  pageManagerLoaded,
  pageManagerOpen,
  previewExpanded,
  previewOpen,
  previewViewport,
  selectMobileStudioView: selectMobileView,
  studioLeftView,
  templatePickerOpen,
  theme,
  toggleLocale,
  togglePreview,
  toggleTheme,
} = ui

const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const mobileDock = useTemplateRef<HTMLElement>('mobileDock')
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
</script>

<template>
  <main class="workbench-app" :data-theme="theme">
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
      @new-page="openTemplatePicker"
      @open-flow="showFlowDialog()"
      @open-pages="showPageManager"
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
             @selection-set-change="selectedDesignerIds = $event"
           >
            <template #toolbar="{ breakpoint, canUndo, canRedo, canEditSelection, copySelection, removeSelection, selectBreakpoint, undo, redo }">
              <div class="mx-config-form-designer__toolbar-actions" role="toolbar" :aria-label="workbenchLocale.t('designer.commands', 'Designer commands')">
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canUndo" :title="workbenchLocale.t('action.undo', 'Undo')" :aria-label="workbenchLocale.t('action.undo', 'Undo')" @click="undo">
                  <Undo2 :size="17" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canRedo" :title="workbenchLocale.t('action.redo', 'Redo')" :aria-label="workbenchLocale.t('action.redo', 'Redo')" @click="redo">
                  <Redo2 :size="17" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canEditSelection" :title="workbenchLocale.t('node.copySelection', 'Copy selection')" :aria-label="workbenchLocale.t('node.copySelection', 'Copy selection')" @click="copySelection">
                  <Copy :size="16" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="!canEditSelection" :title="workbenchLocale.t('node.deleteSelection', 'Delete selection')" :aria-label="workbenchLocale.t('node.deleteSelection', 'Delete selection')" @click="removeSelection">
                  <Trash2 :size="16" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <div class="mx-config-form-designer__segmented" role="group" :aria-label="workbenchLocale.t('canvas.viewport', 'Canvas viewport')">
                  <button type="button" :class="{ 'is-active': breakpoint === 'desktop' }" :aria-pressed="breakpoint === 'desktop'" :title="workbenchLocale.t('canvas.desktop', 'Desktop')" :aria-label="workbenchLocale.t('canvas.desktop', 'Desktop')" @click="selectBreakpoint('desktop')">
                    <Monitor :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'tablet' }" :aria-pressed="breakpoint === 'tablet'" :title="workbenchLocale.t('canvas.tablet', 'Tablet')" :aria-label="workbenchLocale.t('canvas.tablet', 'Tablet')" @click="selectBreakpoint('tablet')">
                    <Tablet :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'mobile' }" :aria-pressed="breakpoint === 'mobile'" :title="workbenchLocale.t('canvas.mobile', 'Mobile')" :aria-label="workbenchLocale.t('canvas.mobile', 'Mobile')" @click="selectBreakpoint('mobile')">
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
                :layers="designerLayers"
                :locale="localeOptions"
                :materials="materials"
                :readonly="readonly"
                :registry="registry"
                :selected-ids="selectedDesignerIds"
                @add-material="addMaterial"
                @arrange-layer="moveDesignerLayer"
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

    <section v-else class="empty-workbench" aria-labelledby="new-page-title">
      <h1 id="new-page-title">
        {{ workbenchLocale.t('template.newPage', 'New page') }}
      </h1>
      <div class="template-list">
        <button
          v-for="template in templates.values()"
          :key="template.id"
          type="button"
          :disabled="busy"
          @click="createProject(template.id)"
        >
          <strong>{{ template.title }}</strong>
          <span>{{ template.adapter }}</span>
        </button>
      </div>
    </section>

    <TemplateDialog
      :busy="busy"
      :locale="localeOptions"
      :open="templatePickerOpen"
      :templates="[...templates.values()]"
      @close="closeTemplatePicker"
      @select="selectTemplate"
    />

    <PageManagerDialog
      v-if="pageManagerLoaded"
      :project="currentProject"
      :projects="projects"
      :busy="busy"
      :locale="localeOptions"
      :open="pageManagerOpen"
      @close="closePageManager"
      @create-page="openPageTemplatePicker"
      @open-project="requestOpenProject($event)"
      @action="handlePageAction"
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

    <aside
      v-if="workspaceRecoveryNotice"
      class="workspace-recovery-notice"
      :data-tone="workspaceRecoveryNotice.tone"
      :role="workspaceRecoveryNotice.tone === 'error' ? 'alert' : 'status'"
      aria-live="polite"
    >
      <AlertTriangle :size="17" aria-hidden="true" />
      <span>{{ workspaceRecoveryNotice.message }}</span>
      <button
        v-if="workspaceRecoveryNotice.action === 'reload'"
        type="button"
        :disabled="busy"
        @click="reloadCurrentProject"
      >
        <RefreshCw :size="14" aria-hidden="true" />
        {{ workspaceRecoveryNotice.actionLabel }}
      </button>
    </aside>

    <p v-if="message" class="workbench-message" aria-live="polite">
      {{ message }}
    </p>
  </main>
</template>
