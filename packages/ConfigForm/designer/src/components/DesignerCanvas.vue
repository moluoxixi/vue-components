<script setup lang="ts">
import type { DesignerDocument } from '../document'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerDropTarget } from '../history'
import type { DesignerRegistry } from '../registry'
import type { DesignerNodeAction } from './types'
import type { DesignerSelectionMode } from '../composables'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import { Workflow } from '@lucide/vue'
import { useDesignerLocale } from '../locale'
import DesignerNodeList from './DesignerNodeList.vue'

defineProps<{
  document: DesignerDocument
  registry: DesignerRegistry
  selectedId?: string
  selectedIds?: string[]
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  interactive?: boolean
  model?: Record<string, unknown>
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
}>()

const emit = defineEmits<{
  select: [nodeId: string, mode?: DesignerSelectionMode]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  toggleInteractive: []
  updateField: [field: string, value: unknown]
  resize: [nodeId: string, span: number]
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

function forwardUpdateField(field: string, value: unknown): void {
  emit('updateField', field, value)
}

function forwardSelect(nodeId: string, mode?: DesignerSelectionMode): void {
  emit('select', nodeId, mode)
}

function forwardResize(nodeId: string, span: number): void {
  emit('resize', nodeId, span)
}
</script>

<template>
  <main class="mx-config-form-designer__canvas" :aria-label="locale.t('canvas.form', 'Form canvas')" :data-preview-breakpoint="breakpoint ?? 'desktop'" @click="emit('select', '')">
    <div class="mx-config-form-designer__canvas-tools mx-config-form-designer__segmented" role="group" :aria-label="locale.t('canvas.tools', 'Canvas tools')">
      <button
        type="button"
        :class="{ 'is-active': interactive }"
        :aria-label="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :title="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :aria-pressed="Boolean(interactive)"
        @click.stop="emit('toggleInteractive')"
      >
        <Workflow :size="15" aria-hidden="true" />
      </button>
    </div>
    <div class="mx-config-form-designer__canvas-sheet" :data-sheet-breakpoint="breakpoint ?? 'desktop'">
      <DesignerNodeList
        :nodes="document.nodes"
        :parent-id="null"
        :registry="registry"
        :form="document.form"
        :selected-id="selectedId"
        :selected-ids="selectedIds"
        :readonly="readonly"
        :breakpoint="breakpoint"
        :interactive="interactive"
        :model="model"
        :reaction-props="reactionProps"
        :reaction-states="reactionStates"
        @select="forwardSelect"
        @move="forwardMove"
        @add-material="forwardAddMaterial"
        @action="forwardAction"
        @update-field="forwardUpdateField"
        @resize="forwardResize"
      />
    </div>
  </main>
</template>
