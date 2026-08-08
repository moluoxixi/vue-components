<script setup lang="ts">
import type { DesignerDocument } from '../document'
import type { DesignerDropTarget } from '../history'
import type { DesignerRegistry } from '../registry'
import type { DesignerNodeAction } from './types'
import { useDesignerLocale } from '../locale'
import DesignerNodeList from './DesignerNodeList.vue'

defineProps<{
  document: DesignerDocument
  registry: DesignerRegistry
  selectedId?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
}>()
const locale = useDesignerLocale()

function forwardMove(nodeId: string, target: DesignerDropTarget): void {
  emit('move', nodeId, target)
}

function forwardAddMaterial(materialKey: string, target: DesignerDropTarget): void {
  emit('addMaterial', materialKey, target)
}

function forwardAction(action: DesignerNodeAction, nodeId: string): void {
  emit('action', action, nodeId)
}
</script>

<template>
  <main class="mx-config-form-designer__canvas" :aria-label="locale.t('canvas.form', 'Form canvas')" @click.self="emit('select', '')">
    <div class="mx-config-form-designer__canvas-sheet">
      <DesignerNodeList
        :nodes="document.nodes"
        :parent-id="null"
        :registry="registry"
        :label-position="document.form.labelPosition ?? 'left'"
        :selected-id="selectedId"
        :readonly="readonly"
        @select="emit('select', $event)"
        @move="forwardMove"
        @add-material="forwardAddMaterial"
        @action="forwardAction"
      />
    </div>
  </main>
</template>
