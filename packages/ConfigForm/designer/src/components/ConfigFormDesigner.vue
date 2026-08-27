<script setup lang="ts">
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerCompileResult } from '../compiler'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type {
  ConfigFormDesignerEmits,
  ConfigFormDesignerExpose,
  ConfigFormDesignerProps,
  ConfigFormDesignerSlots,
  DesignerNodeAction,
} from './types'
import {
  Clipboard,
  Download,
  Eye,
  FileDown,
  FileUp,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Undo2,
  X,
} from '@lucide/vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, useId, watch } from 'vue'
import { useDesignerController } from '../composables'
import { applyDesignerDocumentReactions, createDesignerPreviewModel } from '../document'
import { createDesignerLocale, DESIGNER_LOCALE_KEY } from '../locale'
import DesignerCanvas from './DesignerCanvas.vue'
import DesignerPalette from './DesignerPalette.vue'
import DesignerPropertyPanel from './DesignerPropertyPanel.vue'
import '../styles.scss'

const props = withDefaults(defineProps<ConfigFormDesignerProps>(), {
  historyLimit: 100,
  readonly: false,
})
const emit = defineEmits<ConfigFormDesignerEmits>()
defineSlots<ConfigFormDesignerSlots>()
const locale = reactive(createDesignerLocale(props.locale))
provide(DESIGNER_LOCALE_KEY, locale)

watch(() => props.locale, (value) => {
  Object.assign(locale, createDesignerLocale(value))
}, { deep: true })

const rootRef = ref<HTMLElement>()
const transferDialogRef = ref<HTMLElement>()
const previewDialogRef = ref<HTMLElement>()
const previewResult = shallowRef<DesignerCompileResult>()
const previewOpen = ref(false)
const initialReactionProjection = applyDesignerDocumentReactions(
  props.document,
  createDesignerPreviewModel(props.document),
)
const previewModel = ref<Record<string, unknown>>(initialReactionProjection.values)
const previewReactionProps = ref<ConfigFormReactionProjection['props']>(initialReactionProjection.props)
const previewReactionStates = ref<ConfigFormReactionProjection['states']>(initialReactionProjection.states)
const linkagePreview = ref(false)
const transferMode = ref<'import' | 'export'>()
const transferText = ref('')
const transferError = ref('')
const activeBreakpoint = ref<ConfigFormBreakpoint>(recommendedBreakpoint())
const workspaceWidth = ref<number>()
const activeWorkspaceView = ref<'canvas' | 'palette' | 'properties'>('canvas')
const paletteOpen = ref(true)
const propertiesOpen = ref(true)
const workspaceId = useId()
const workspaceViews = [
  { id: 'palette' as const, label: 'Palette' },
  { id: 'canvas' as const, label: 'Canvas' },
  { id: 'properties' as const, label: 'Properties' },
]
const workspaceMode = computed(() => {
  const width = workspaceWidth.value
  if (!width)
    return 'desktop' as const
  if (width <= 720)
    return 'narrow' as const
  if (width <= 1100)
    return 'medium' as const
  return 'desktop' as const
})
let breakpointManuallySelected = false
let resizeObserver: ResizeObserver | undefined
let transferReturnFocus: HTMLElement | undefined
let previewReturnFocus: HTMLElement | undefined

const dialogFocusableSelector = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function recommendedBreakpoint(): ConfigFormBreakpoint {
  if (typeof window === 'undefined')
    return 'desktop'
  if (window.innerWidth <= 720)
    return 'mobile'
  if (window.innerWidth <= 1024)
    return 'tablet'
  return 'desktop'
}

function syncBreakpointToViewport(): void {
  if (!breakpointManuallySelected)
    activeBreakpoint.value = recommendedBreakpoint()
}

function selectBreakpoint(breakpoint: ConfigFormBreakpoint): void {
  breakpointManuallySelected = true
  activeBreakpoint.value = breakpoint
}

function measureWorkspace(): void {
  const width = rootRef.value?.getBoundingClientRect().width
  if (width && width > 0)
    workspaceWidth.value = width
}

function selectWorkspaceView(view: typeof activeWorkspaceView.value): void {
  activeWorkspaceView.value = view
}

function isWorkspacePanelHidden(view: typeof activeWorkspaceView.value): boolean {
  if (workspaceMode.value === 'narrow')
    return activeWorkspaceView.value !== view
  if (view === 'palette')
    return !paletteOpen.value
  if (view === 'properties')
    return !propertiesOpen.value
  return false
}

function toggleWorkspacePanel(view: 'palette' | 'properties'): void {
  if (view === 'palette')
    paletteOpen.value = !paletteOpen.value
  else
    propertiesOpen.value = !propertiesOpen.value
}

function handleWorkspaceTabKeydown(event: KeyboardEvent, view: typeof activeWorkspaceView.value): void {
  const index = workspaceViews.findIndex(item => item.id === view)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % workspaceViews.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + workspaceViews.length) % workspaceViews.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = workspaceViews.length - 1
  else
    return
  event.preventDefault()
  const nextView = workspaceViews[nextIndex]!.id
  selectWorkspaceView(nextView)
  void nextTick(() => rootRef.value
    ?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${nextView}"]`)
    ?.focus())
}

onMounted(() => {
  syncBreakpointToViewport()
  window.addEventListener('resize', syncBreakpointToViewport)
  measureWorkspace()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(measureWorkspace)
    resizeObserver.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncBreakpointToViewport)
  resizeObserver?.disconnect()
})

const controller = useDesignerController({
  document: () => props.document,
  registry: () => props.registry,
  historyLimit: () => props.historyLimit,
  readonly: () => props.readonly,
  onDocumentChange: (document) => {
    if (!linkagePreview.value)
      resetPreviewModel(document)
    emit('update:document', document)
  },
  onCommand: (command, document) => emit('command', command, document),
  onDiagnostics: diagnostics => emit('diagnostics', diagnostics),
  onSelectionChange: nodeId => emit('selectionChange', nodeId),
})

watch(controller.document, (document) => {
  if (!linkagePreview.value)
    resetPreviewModel(document)
  else
    applyPreviewProjection(document, previewModel.value)
}, { deep: true })

const toolbarScope = computed(() => ({
  canUndo: controller.canUndo.value,
  canRedo: controller.canRedo.value,
  readonly: props.readonly,
  undo: handleUndo,
  redo: handleRedo,
  preview: handlePreview,
  openImport,
  openExport,
}))

async function focusNode(nodeId?: string): Promise<void> {
  if (!nodeId)
    return
  await nextTick()
  const target = [...(rootRef.value?.querySelectorAll<HTMLElement>('[data-focus-node-id]') ?? [])]
    .find(element => element.dataset.focusNodeId === nodeId)
  target?.focus()
}

function dispatch(command: DesignerCommand): boolean {
  const changed = controller.dispatch(command)
  void focusNode(controller.selectedId.value)
  return changed
}

function handleUndo(): boolean {
  const changed = controller.undo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleRedo(): boolean {
  const changed = controller.redo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleMove(nodeId: string, target: DesignerDropTarget): void {
  controller.select(nodeId)
  dispatch({ type: 'moveNode', nodeId, target })
}

function handleAddMaterial(materialKey: string, target: DesignerDropTarget): void {
  if (controller.addMaterial(materialKey, target) && workspaceMode.value === 'narrow')
    activeWorkspaceView.value = 'canvas'
}

function addMaterial(materialKey: string, target?: DesignerDropTarget): boolean {
  const changed = controller.addMaterial(materialKey, target)
  if (changed && workspaceMode.value === 'narrow')
    activeWorkspaceView.value = 'canvas'
  return changed
}

function handleUpdatePath(nodeId: string, path: string[], value: unknown): void {
  const changed = dispatch({ type: 'updateNodePath', nodeId, path, value })
  if (!changed || !['conditions', 'reactions'].includes(path[0] ?? ''))
    return
  if (!linkagePreview.value) {
    linkagePreview.value = true
    resetPreviewModel(controller.document.value)
    return
  }
  applyPreviewProjection(controller.document.value, previewModel.value)
}

function handleUpdateForm(changes: Record<string, unknown>): void {
  dispatch({ type: 'updateForm', changes })
}

function handleAction(action: DesignerNodeAction, nodeId: string): void {
  controller.select(nodeId)
  controller.performNodeAction(action, nodeId)
  void focusNode(controller.selectedId.value)
}

function handlePreview(): DesignerCompileResult {
  const result = controller.preview()
  previewResult.value = result
  emit('preview', result)
  if (result.success) {
    if (!linkagePreview.value)
      resetPreviewModel(result.document)
    previewOpen.value = true
    previewReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    void focusDialog(previewDialogRef)
  }
  return result
}

function toggleLinkagePreview(): void {
  linkagePreview.value = !linkagePreview.value
  resetPreviewModel(controller.document.value)
}

function updatePreviewField(field: string, value: unknown): void {
  applyPreviewProjection(controller.document.value, { ...previewModel.value, [field]: value })
}

function resetPreviewModel(document = controller.document.value): void {
  applyPreviewProjection(document, createDesignerPreviewModel(document))
}

function applyPreviewProjection(document: typeof props.document, values: Record<string, unknown>): void {
  const projection = applyDesignerDocumentReactions(document, values)
  previewModel.value = projection.values
  previewReactionProps.value = projection.props
  previewReactionStates.value = projection.states
}

function openImport(): void {
  transferReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined
  transferMode.value = 'import'
  transferText.value = ''
  transferError.value = ''
  void focusDialog(transferDialogRef, '[autofocus]')
}

function openExport(): void {
  transferReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined
  transferMode.value = 'export'
  transferText.value = controller.exportDocument()
  transferError.value = transferText.value
    ? ''
    : controller.diagnostics.value[0]?.message ?? locale.t('error.exportFailed', 'Export validation failed')
  if (transferText.value)
    emit('export', transferText.value)
  void focusDialog(transferDialogRef, '[autofocus]')
}

function closeTransfer(): void {
  transferMode.value = undefined
  transferError.value = ''
  void restoreDialogFocus('transfer')
}

function closePreview(): void {
  previewOpen.value = false
  void restoreDialogFocus('preview')
}

async function focusDialog(
  dialogRef: typeof transferDialogRef,
  preferredSelector = dialogFocusableSelector,
): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  dialogRef.value?.querySelector<HTMLElement>(preferredSelector)?.focus()
}

async function restoreDialogFocus(dialog: 'preview' | 'transfer'): Promise<void> {
  const target = dialog === 'preview' ? previewReturnFocus : transferReturnFocus
  if (dialog === 'preview')
    previewReturnFocus = undefined
  else
    transferReturnFocus = undefined
  await nextTick()
  if (target?.isConnected)
    target.focus()
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | undefined): void {
  if (event.key !== 'Tab' || !dialog)
    return
  const focusable = [...dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector)]
  if (focusable.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTransferDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeTransfer()
    return
  }
  trapDialogFocus(event, transferDialogRef.value)
}

function handlePreviewDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePreview()
    return
  }
  trapDialogFocus(event, previewDialogRef.value)
}

function applyImport(): boolean {
  let input: unknown
  try {
    input = JSON.parse(transferText.value)
  }
  catch {
    transferError.value = locale.t('error.invalidJson', 'Invalid JSON')
    return false
  }
  if (!controller.importDocument(input)) {
    transferError.value = controller.diagnostics.value[0]?.message ?? locale.t('error.importFailed', 'Import failed')
    return false
  }
  emit('import', controller.document.value)
  closeTransfer()
  return true
}

async function copyExport(): Promise<void> {
  await navigator.clipboard?.writeText(transferText.value)
}

function downloadExport(): void {
  const url = URL.createObjectURL(new Blob([transferText.value], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'config-form.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function importDocument(input: unknown): boolean {
  const changed = controller.importDocument(input)
  if (changed)
    emit('import', controller.document.value)
  return changed
}

function handleRootKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey))
    return
  const target = event.target as HTMLElement
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    return
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? handleRedo() : handleUndo()
  }
  else if (event.key.toLowerCase() === 'y') {
    event.preventDefault()
    handleRedo()
  }
}

defineExpose<ConfigFormDesignerExpose>({
  dispatch,
  undo: handleUndo,
  redo: handleRedo,
  select: controller.select,
  preview: handlePreview,
  importDocument,
  exportDocument: controller.exportDocument,
})
</script>

<template>
  <div
    ref="rootRef"
    class="mx-config-form-designer"
    :data-active-view="activeWorkspaceView"
    :data-palette-open="paletteOpen"
    :data-properties-open="propertiesOpen"
    :data-workspace-mode="workspaceMode"
    @keydown="handleRootKeydown"
  >
    <header class="mx-config-form-designer__toolbar">
      <strong>{{ locale.t('designer.title', 'Form Designer') }}</strong>
      <div class="mx-config-form-designer__toolbar-controls">
        <div v-if="workspaceMode !== 'narrow'" class="mx-config-form-designer__sidebar-actions" role="group" :aria-label="locale.t('designer.sidebars', 'Designer sidebars')">
          <button
            type="button"
            class="mx-config-form-designer__icon-button"
            :aria-controls="`${workspaceId}-palette-panel`"
            :aria-expanded="paletteOpen"
            :aria-label="paletteOpen ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')"
            :title="paletteOpen ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')"
            @click="toggleWorkspacePanel('palette')"
          >
            <PanelLeftClose v-if="paletteOpen" :size="17" aria-hidden="true" />
            <PanelLeftOpen v-else :size="17" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="mx-config-form-designer__icon-button"
            :aria-controls="`${workspaceId}-properties-panel`"
            :aria-expanded="propertiesOpen"
            :aria-label="propertiesOpen ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')"
            :title="propertiesOpen ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')"
            @click="toggleWorkspacePanel('properties')"
          >
            <PanelRightClose v-if="propertiesOpen" :size="17" aria-hidden="true" />
            <PanelRightOpen v-else :size="17" aria-hidden="true" />
          </button>
        </div>
        <slot name="toolbar" v-bind="toolbarScope">
          <div class="mx-config-form-designer__toolbar-actions" role="toolbar" :aria-label="locale.t('designer.commands', 'Designer commands')">
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canUndo.value" :title="locale.t('action.undo', 'Undo')" :aria-label="locale.t('action.undo', 'Undo')" @click="handleUndo">
              <Undo2 :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canRedo.value" :title="locale.t('action.redo', 'Redo')" :aria-label="locale.t('action.redo', 'Redo')" @click="handleRedo">
              <Redo2 :size="17" aria-hidden="true" />
            </button>
            <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
            <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.preview', 'Preview')" :aria-label="locale.t('action.previewForm', 'Preview form')" @click="handlePreview">
              <Eye :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('action.import', 'Import')" :aria-label="locale.t('action.importDocument', 'Import document')" @click="openImport">
              <FileUp :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.export', 'Export')" :aria-label="locale.t('action.exportDocument', 'Export document')" @click="openExport">
              <FileDown :size="17" aria-hidden="true" />
            </button>
          </div>
        </slot>
      </div>
    </header>

    <div class="mx-config-form-designer__workspace">
      <nav
        v-if="workspaceMode === 'narrow'"
        class="mx-config-form-designer__workspace-tabs"
        role="tablist"
        :aria-label="locale.t('designer.workspaceViews', 'Designer views')"
      >
        <button
          v-for="view in workspaceViews"
          :id="`${workspaceId}-${view.id}-tab`"
          :key="view.id"
          type="button"
          role="tab"
          :aria-controls="`${workspaceId}-${view.id}-panel`"
          :aria-selected="activeWorkspaceView === view.id"
          :data-workspace-tab="view.id"
          :tabindex="activeWorkspaceView === view.id ? 0 : -1"
          @click="selectWorkspaceView(view.id)"
          @keydown="handleWorkspaceTabKeydown($event, view.id)"
        >
          {{ locale.t(`designer.view.${view.id}`, view.label) }}
        </button>
      </nav>

      <section
        :id="`${workspaceId}-palette-panel`"
        class="mx-config-form-designer__workspace-panel is-palette"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-palette-tab` : undefined"
        :hidden="isWorkspacePanelHidden('palette')"
        :inert="isWorkspacePanelHidden('palette') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined"
      >
        <slot
          name="palette"
          :materials="registry.listMaterials()"
          :add-material="addMaterial"
          :readonly="readonly"
        >
          <DesignerPalette
            :materials="registry.listMaterials()"
            :registry="registry"
            :readonly="readonly"
            @add-material="addMaterial"
          />
        </slot>
      </section>

      <section
        :id="`${workspaceId}-canvas-panel`"
        class="mx-config-form-designer__workspace-panel is-canvas"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-canvas-tab` : undefined"
        :hidden="isWorkspacePanelHidden('canvas')"
        :inert="isWorkspacePanelHidden('canvas') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined"
      >
        <slot
          name="canvas"
          :document="controller.document.value"
          :selected-id="controller.selectedId.value"
          :select="controller.select"
          :move="handleMove"
          :breakpoint="activeBreakpoint"
          :interactive="linkagePreview"
          :model="previewModel"
          :reaction-props="previewReactionProps"
          :reaction-states="previewReactionStates"
        >
          <DesignerCanvas
            :key="controller.renderVersion.value"
            :document="controller.document.value"
            :registry="registry"
            :selected-id="controller.selectedId.value"
            :readonly="readonly"
            :breakpoint="activeBreakpoint"
            :interactive="linkagePreview"
            :model="previewModel"
            :reaction-props="previewReactionProps"
            :reaction-states="previewReactionStates"
            @select="controller.select($event || undefined)"
            @move="handleMove"
            @add-material="handleAddMaterial"
            @action="handleAction"
            @update-breakpoint="selectBreakpoint"
            @toggle-interactive="toggleLinkagePreview"
            @update-field="updatePreviewField"
          />
        </slot>
      </section>

      <section
        :id="`${workspaceId}-properties-panel`"
        class="mx-config-form-designer__workspace-panel is-properties"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-properties-tab` : undefined"
        :hidden="isWorkspacePanelHidden('properties')"
        :inert="isWorkspacePanelHidden('properties') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined"
      >
        <slot
          name="properties"
          :document="controller.document.value"
          :node="controller.selectedNode.value"
          :material="controller.selectedMaterial.value"
          :diagnostics="controller.diagnostics.value"
        >
          <DesignerPropertyPanel
            :document="controller.document.value"
            :node="controller.selectedNode.value"
            :material="controller.selectedMaterial.value"
            :diagnostics="controller.diagnostics.value"
            :breakpoint="activeBreakpoint"
            :components="registry.components"
            :validator-options="registry.listValidators()"
            :property-controls="registry.propertyControls"
            :readonly="readonly"
            @update-path="handleUpdatePath"
            @update-form="handleUpdateForm"
          />
        </slot>
      </section>
    </div>

    <footer class="mx-config-form-designer__status" aria-live="polite">
      <slot name="diagnostics" :diagnostics="controller.diagnostics.value">
        <span v-if="controller.diagnostics.value.length">
          {{ locale.t('status.issues', '{count} issue{suffix}', { count: controller.diagnostics.value.length, suffix: controller.diagnostics.value.length === 1 ? '' : 's' }) }} · {{ controller.diagnostics.value[0]?.message }}
        </span>
        <span v-else>{{ locale.t('status.ready', 'Ready') }}</span>
      </slot>
    </footer>

    <div v-if="transferMode" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="closeTransfer">
      <section ref="transferDialogRef" class="mx-config-form-designer__dialog" role="dialog" aria-modal="true" tabindex="-1" :aria-label="transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document')" @keydown="handleTransferDialogKeydown">
        <header>
          <strong>{{ transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.close', 'Close')" @click="closeTransfer">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <textarea v-model="transferText" rows="18" spellcheck="false" :readonly="transferMode === 'export'" autofocus />
        <p v-if="transferError" class="mx-config-form-designer__dialog-error" role="alert">
          {{ transferError }}
        </p>
        <footer>
          <template v-if="transferMode === 'import'">
            <button type="button" class="mx-config-form-designer__command-button is-secondary" @click="closeTransfer">
              {{ locale.t('action.cancel', 'Cancel') }}
            </button>
            <button type="button" class="mx-config-form-designer__command-button" @click="applyImport">
              {{ locale.t('action.apply', 'Apply') }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="mx-config-form-designer__command-button is-secondary" :disabled="Boolean(transferError)" @click="copyExport">
              <Clipboard :size="15" aria-hidden="true" /> {{ locale.t('action.copy', 'Copy') }}
            </button>
            <button type="button" class="mx-config-form-designer__command-button" :disabled="Boolean(transferError)" @click="downloadExport">
              <Download :size="15" aria-hidden="true" /> {{ locale.t('action.download', 'Download') }}
            </button>
          </template>
        </footer>
      </section>
    </div>

    <div v-if="previewOpen && previewResult" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="closePreview">
      <section ref="previewDialogRef" class="mx-config-form-designer__dialog is-preview" role="dialog" aria-modal="true" tabindex="-1" :aria-label="locale.t('dialog.preview', 'Form preview')" @keydown="handlePreviewDialogKeydown">
        <header>
          <strong>{{ locale.t('action.preview', 'Preview') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.closePreview', 'Close preview')" @click="closePreview">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <slot name="preview" :result="previewResult" :close="closePreview">
          <ConfigFormRenderer
            v-if="previewResult.success"
            v-model="previewModel"
            :namespace="registry.rendererNamespace"
            v-bind="previewResult.renderer"
          />
        </slot>
      </section>
    </div>
  </div>
</template>
