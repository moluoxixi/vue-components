<script setup lang="ts">
import type { DesignerSelectionMode, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { MobileStudioView } from './workbench-controller'
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
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef } from 'vue'
import PreviewDrawer from '../studio/PreviewDrawer.vue'
import StudioLeftPanel from '../studio/StudioLeftPanel.vue'
import TemplateDialog from '../features/templates/TemplateDialog.vue'
import WorkbenchTopbar from './WorkbenchTopbar.vue'
import { useWorkbenchController } from './workbench-context'

const ExportDialog = defineAsyncComponent(() => import('../features/export/ExportDialog.vue'))
const FlowDialog = defineAsyncComponent(() => import('../features/flow/FlowDialog.vue'))
const PageManagerDialog = defineAsyncComponent(() => import('../features/pages/PageManagerDialog.vue'))

const controller = useWorkbenchController()
const {
  activePreview,
  applications,
  busy,
  closeExportPreview,
  closeFlowWorkspace,
  closePageManager,
  closeTemplatePicker,
  configError,
  configModel,
  captureExportSnapshotInput,
  createApplication,
  currentApplication,
  currentPage,
  currentPageId,
  designRuntime,
  designerCommandControl,
  designerDocument,
  designerFieldNames,
  designerHistoryControl,
  designerLayers,
  dirty,
  exportPreviewMode,
  fallbackPreviewModel,
  flowWorkspaceOpen,
  getCurrentExportCompilation,
  handleApplicationOperation,
  handlePreviewRuntimeReady,
  localeId,
  localeOptions,
  lowCodeRegistry,
  message,
  mobileStudioView,
  openExportPreview,
  openFlowWorkspace,
  openPageManager,
  openPageTemplatePicker,
  openTemplatePicker,
  pageManagerOpen,
  previewExpanded,
  previewFlowProjection,
  previewModel,
  previewOpen,
  previewProjection,
  previewState,
  previewViewport,
  registry,
  requestOpenApplication,
  reloadCurrentApplication,
  runPreviewFlows,
  runtimeFallbackPreview,
  saveProject,
  selectPageFromDesigner,
  selectedDesignerIds,
  selectTemplate,
  statusLabel,
  studioLeftView,
  templates,
  templatePickerOpen,
  theme,
  toggleLocale,
  togglePreview,
  toggleTheme,
  updateModelOperation,
  workbenchLocale,
  workspaceRecoveryNotice,
} = controller

const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const mobileDock = useTemplateRef<HTMLElement>('mobileDock')
const exportDialogLoaded = ref(false)
const flowDialogLoaded = ref(false)
const pageManagerLoaded = ref(false)
const mobileStudioViews = computed(() => [
  { icon: Blocks, id: 'components' as const, label: workbenchLocale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: workbenchLocale.value.t('designer.view.layers', 'Layers') },
  { icon: Monitor, id: 'canvas' as const, label: workbenchLocale.value.t('designer.view.canvas', 'Canvas') },
  { icon: SlidersHorizontal, id: 'inspector' as const, label: workbenchLocale.value.t('designer.view.inspector', 'Inspector') },
  { icon: Files, id: 'pages' as const, label: workbenchLocale.value.t('designer.view.pages', 'Pages') },
])

function selectMobileStudioView(view: MobileStudioView): void {
  previewOpen.value = false
  previewExpanded.value = false
  mobileStudioView.value = view
  if (view === 'canvas') {
    designer.value?.selectWorkspaceView('canvas')
    return
  }
  if (view === 'inspector') {
    designer.value?.selectWorkspaceView('properties')
    return
  }
  studioLeftView.value = view
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
  exportDialogLoaded.value = true
  openExportPreview(mode)
}

function showFlowDialog(): void {
  flowDialogLoaded.value = true
  openFlowWorkspace()
}

function showPageManager(): void {
  pageManagerLoaded.value = true
  openPageManager()
}
</script>

<template>
  <main class="workbench-app" :data-theme="theme">
    <WorkbenchTopbar
      :application="currentApplication"
      :busy="busy"
      :config-error="configError"
      :current-page="currentPage"
      :dirty="dirty"
      :flow-open="flowWorkspaceOpen"
      :locale="localeOptions"
      :locale-id="localeId"
      :preview-open="previewOpen"
      :status-label="statusLabel"
      :theme="theme"
      @export="showExportDialog"
      @new-page="openTemplatePicker"
      @open-flow="showFlowDialog"
      @open-pages="showPageManager"
      @save="saveProject"
      @toggle-locale="toggleLocale"
      @toggle-preview="togglePreview"
      @toggle-theme="toggleTheme"
    />

    <section
      v-if="currentApplication"
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
            v-if="designerDocument && configModel"
            ref="designer"
            :key="`${currentApplication.manifest.adapter}-${currentPageId}`"
            class="embedded-designer"
            :document="designerDocument"
            :model="configModel"
            :model-registry="lowCodeRegistry"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :locale="localeOptions"
            :readonly="busy"
            :registry="registry"
             :runtime-renderer="designRuntime?.artifact.plan.renderer"
             workspace-navigation="external"
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
                :application="currentApplication"
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
          </DesignSurface>
        </div>
      </section>

      <PreviewDrawer
        v-model:expanded="previewExpanded"
        v-model:fallback-model-value="fallbackPreviewModel"
        v-model:model-value="previewModel"
        v-model:viewport="previewViewport"
        :active="activePreview"
        :config-error="configError"
        :fallback="runtimeFallbackPreview"
        :locale="localeOptions"
        :namespace="registry.rendererNamespace"
        :open="previewOpen"
        :projection="previewProjection"
        :reaction-projection="previewFlowProjection"
        :state="previewState"
        @close="togglePreview"
        @error="message = $event instanceof Error ? $event.message : String($event)"
        @field-change="runPreviewFlows('field.change', $event.values, $event.field)"
        @ready="handlePreviewRuntimeReady"
        @submit="runPreviewFlows('form.submit', $event)"
      />
    </section>

    <nav v-if="currentApplication" ref="mobileDock" class="mobile-studio-dock" role="tablist" :aria-label="workbenchLocale.t('designer.navigation', 'Designer navigation')">
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
          @click="createApplication(template.id)"
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
      :application="currentApplication"
      :applications="applications"
      :busy="busy"
      :locale="localeOptions"
      :open="pageManagerOpen"
      @close="closePageManager"
      @create-page="openPageTemplatePicker"
      @open-application="requestOpenApplication($event)"
      @operation="handleApplicationOperation"
    />

    <FlowDialog
      v-if="flowDialogLoaded"
      :field-names="designerFieldNames"
      :flows="configModel?.flows ?? []"
      :locale="localeOptions"
      :open="flowWorkspaceOpen"
      :readonly="busy"
      @close="closeFlowWorkspace"
      @operation="updateModelOperation"
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
        @click="reloadCurrentApplication"
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
