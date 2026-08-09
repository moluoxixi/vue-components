<script setup lang="ts">
import type { DesignerCompileResult } from '../compiler'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type {
  ConfigFormDesignerEmits,
  ConfigFormDesignerExpose,
  ConfigFormDesignerProps,
  ConfigFormDesignerSlots,
  DesignerNodeAction,
} from './types'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import {
  Clipboard,
  Download,
  Eye,
  FileDown,
  FileUp,
  Redo2,
  Undo2,
  X,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch } from 'vue'
import { useDesignerController } from '../composables'
import { createDesignerPreviewModel } from '../document'
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

watch(() => props.locale, value => {
  Object.assign(locale, createDesignerLocale(value))
}, { deep: true })

const rootRef = ref<HTMLElement>()
const previewResult = shallowRef<DesignerCompileResult>()
const previewOpen = ref(false)
const previewModel = ref<Record<string, unknown>>(createDesignerPreviewModel(props.document))
const linkagePreview = ref(false)
const transferMode = ref<'import' | 'export'>()
const transferText = ref('')
const transferError = ref('')
const activeBreakpoint = ref<ConfigFormBreakpoint>(recommendedBreakpoint())
let breakpointManuallySelected = false

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

onMounted(() => {
  syncBreakpointToViewport()
  window.addEventListener('resize', syncBreakpointToViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncBreakpointToViewport)
})

const controller = useDesignerController({
  document: () => props.document,
  registry: () => props.registry,
  historyLimit: () => props.historyLimit,
  readonly: () => props.readonly,
  onDocumentChange: (document) => {
    if (!linkagePreview.value)
      previewModel.value = createDesignerPreviewModel(document)
    emit('update:document', document)
  },
  onCommand: (command, document) => emit('command', command, document),
  onDiagnostics: diagnostics => emit('diagnostics', diagnostics),
  onSelectionChange: nodeId => emit('selectionChange', nodeId),
})

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
  controller.addMaterial(materialKey, target)
}

function handleUpdatePath(nodeId: string, path: string[], value: unknown): void {
  const changed = dispatch({ type: 'updateNodePath', nodeId, path, value })
  if (changed && path[0] === 'conditions' && !linkagePreview.value) {
    linkagePreview.value = true
    previewModel.value = createDesignerPreviewModel(controller.document.value)
  }
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
      previewModel.value = createDesignerPreviewModel(result.document)
    previewOpen.value = true
  }
  return result
}

function toggleLinkagePreview(): void {
  linkagePreview.value = !linkagePreview.value
  previewModel.value = createDesignerPreviewModel(controller.document.value)
}

function updatePreviewField(field: string, value: unknown): void {
  previewModel.value = { ...previewModel.value, [field]: value }
}

function openImport(): void {
  transferMode.value = 'import'
  transferText.value = ''
  transferError.value = ''
}

function openExport(): void {
  transferMode.value = 'export'
  transferText.value = controller.exportDocument()
  transferError.value = transferText.value
    ? ''
    : controller.diagnostics.value[0]?.message ?? locale.t('error.exportFailed', 'Export validation failed')
  if (transferText.value)
    emit('export', transferText.value)
}

function closeTransfer(): void {
  transferMode.value = undefined
  transferError.value = ''
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
  <div ref="rootRef" class="mx-config-form-designer" @keydown="handleRootKeydown">
    <header class="mx-config-form-designer__toolbar">
      <strong>{{ locale.t('designer.title', 'Form Designer') }}</strong>
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
    </header>

    <div class="mx-config-form-designer__workspace">
      <slot
        name="palette"
        :materials="registry.listMaterials()"
        :add-material="controller.addMaterial"
        :readonly="readonly"
      >
        <DesignerPalette
          :materials="registry.listMaterials()"
          :readonly="readonly"
          @add-material="controller.addMaterial"
        />
      </slot>

      <slot
        name="canvas"
        :document="controller.document.value"
        :selected-id="controller.selectedId.value"
        :select="controller.select"
        :move="handleMove"
        :breakpoint="activeBreakpoint"
        :interactive="linkagePreview"
        :model="previewModel"
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
          @select="controller.select($event || undefined)"
          @move="handleMove"
          @add-material="handleAddMaterial"
          @action="handleAction"
          @update-breakpoint="selectBreakpoint"
          @toggle-interactive="toggleLinkagePreview"
          @update-field="updatePreviewField"
        />
      </slot>

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
          :validator-options="registry.listValidators()"
          :readonly="readonly"
          @update-path="handleUpdatePath"
          @update-form="handleUpdateForm"
        />
      </slot>
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
      <section class="mx-config-form-designer__dialog" role="dialog" aria-modal="true" :aria-label="transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document')">
        <header>
          <strong>{{ transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.close', 'Close')" @click="closeTransfer">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <textarea v-model="transferText" rows="18" spellcheck="false" :readonly="transferMode === 'export'" autofocus />
        <p v-if="transferError" class="mx-config-form-designer__dialog-error" role="alert">{{ transferError }}</p>
        <footer>
          <template v-if="transferMode === 'import'">
            <button type="button" class="mx-config-form-designer__command-button is-secondary" @click="closeTransfer">{{ locale.t('action.cancel', 'Cancel') }}</button>
            <button type="button" class="mx-config-form-designer__command-button" @click="applyImport">{{ locale.t('action.apply', 'Apply') }}</button>
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

    <div v-if="previewOpen && previewResult" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="previewOpen = false">
      <section class="mx-config-form-designer__dialog is-preview" role="dialog" aria-modal="true" :aria-label="locale.t('dialog.preview', 'Form preview')">
        <header>
          <strong>{{ locale.t('action.preview', 'Preview') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.closePreview', 'Close preview')" @click="previewOpen = false">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <slot name="preview" :result="previewResult" :close="() => previewOpen = false">
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
