<script setup lang="ts">
import type { DesignerCompileResult } from '../compiler'
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
import { computed, nextTick, ref, shallowRef } from 'vue'
import { useDesignerController } from '../composables'
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

const rootRef = ref<HTMLElement>()
const previewResult = shallowRef<DesignerCompileResult>()
const previewOpen = ref(false)
const previewModel = ref<Record<string, unknown>>({})
const transferMode = ref<'import' | 'export'>()
const transferText = ref('')
const transferError = ref('')

const controller = useDesignerController({
  document: () => props.document,
  registry: () => props.registry,
  historyLimit: () => props.historyLimit,
  readonly: () => props.readonly,
  onDocumentChange: document => emit('update:document', document),
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
  dispatch({ type: 'updateNodePath', nodeId, path, value })
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
    previewModel.value = {}
    previewOpen.value = true
  }
  return result
}

function openImport(): void {
  transferMode.value = 'import'
  transferText.value = ''
  transferError.value = ''
}

function openExport(): void {
  transferMode.value = 'export'
  transferText.value = controller.exportDocument()
  transferError.value = ''
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
    transferError.value = 'Invalid JSON'
    return false
  }
  if (!controller.importDocument(input)) {
    transferError.value = controller.diagnostics.value[0]?.message ?? 'Import failed'
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
      <strong>Form Designer</strong>
      <slot name="toolbar" v-bind="toolbarScope">
        <div class="mx-config-form-designer__toolbar-actions" role="toolbar" aria-label="Designer commands">
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canUndo.value" title="Undo" aria-label="Undo" @click="handleUndo">
            <Undo2 :size="17" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canRedo.value" title="Redo" aria-label="Redo" @click="handleRedo">
            <Redo2 :size="17" aria-hidden="true" />
          </button>
          <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
          <button type="button" class="mx-config-form-designer__icon-button" title="Preview" aria-label="Preview form" @click="handlePreview">
            <Eye :size="17" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Import" aria-label="Import document" @click="openImport">
            <FileUp :size="17" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" title="Export" aria-label="Export document" @click="openExport">
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
      >
        <DesignerCanvas
          :key="controller.renderVersion.value"
          :document="controller.document.value"
          :registry="registry"
          :selected-id="controller.selectedId.value"
          :readonly="readonly"
          @select="controller.select($event || undefined)"
          @move="handleMove"
          @add-material="handleAddMaterial"
          @action="handleAction"
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
          :readonly="readonly"
          @update-path="handleUpdatePath"
          @update-form="handleUpdateForm"
        />
      </slot>
    </div>

    <footer class="mx-config-form-designer__status" aria-live="polite">
      <slot name="diagnostics" :diagnostics="controller.diagnostics.value">
        <span v-if="controller.diagnostics.value.length">
          {{ controller.diagnostics.value.length }} issue{{ controller.diagnostics.value.length === 1 ? '' : 's' }} · {{ controller.diagnostics.value[0]?.message }}
        </span>
        <span v-else>Ready</span>
      </slot>
    </footer>

    <div v-if="transferMode" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="closeTransfer">
      <section class="mx-config-form-designer__dialog" role="dialog" aria-modal="true" :aria-label="transferMode === 'import' ? 'Import document' : 'Export document'">
        <header>
          <strong>{{ transferMode === 'import' ? 'Import document' : 'Export document' }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" title="Close" aria-label="Close" @click="closeTransfer">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <textarea v-model="transferText" rows="18" spellcheck="false" :readonly="transferMode === 'export'" autofocus />
        <p v-if="transferError" class="mx-config-form-designer__dialog-error" role="alert">{{ transferError }}</p>
        <footer>
          <template v-if="transferMode === 'import'">
            <button type="button" class="mx-config-form-designer__command-button is-secondary" @click="closeTransfer">Cancel</button>
            <button type="button" class="mx-config-form-designer__command-button" @click="applyImport">Apply</button>
          </template>
          <template v-else>
            <button type="button" class="mx-config-form-designer__command-button is-secondary" @click="copyExport">
              <Clipboard :size="15" aria-hidden="true" /> Copy
            </button>
            <button type="button" class="mx-config-form-designer__command-button" @click="downloadExport">
              <Download :size="15" aria-hidden="true" /> Download
            </button>
          </template>
        </footer>
      </section>
    </div>

    <div v-if="previewOpen && previewResult" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="previewOpen = false">
      <section class="mx-config-form-designer__dialog is-preview" role="dialog" aria-modal="true" aria-label="Form preview">
        <header>
          <strong>Preview</strong>
          <button type="button" class="mx-config-form-designer__icon-button" title="Close" aria-label="Close preview" @click="previewOpen = false">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <slot name="preview" :result="previewResult" :close="() => previewOpen = false">
          <ConfigFormRenderer
            v-if="previewResult.success"
            v-model="previewModel"
            v-bind="previewResult.renderer"
          />
        </slot>
      </section>
    </div>
  </div>
</template>
