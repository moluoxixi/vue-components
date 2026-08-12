<script setup lang="ts">
import type { DesignerDocument } from '../document'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerDropTarget } from '../history'
import type { DesignerRegistry } from '../registry'
import type { DesignerNodeAction } from './types'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import { Monitor, Smartphone, Tablet, Workflow } from '@lucide/vue'
import { useDesignerLocale } from '../locale'
import DesignerNodeList from './DesignerNodeList.vue'

defineProps<{
  document: DesignerDocument
  registry: DesignerRegistry
  selectedId?: string
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  interactive?: boolean
  model?: Record<string, unknown>
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  updateBreakpoint: [breakpoint: ConfigFormBreakpoint]
  toggleInteractive: []
  updateField: [field: string, value: unknown]
}>()
const locale = useDesignerLocale()
const breakpoints: Array<{ key: ConfigFormBreakpoint, icon: typeof Monitor }> = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]

function breakpointTitle(breakpoint: ConfigFormBreakpoint): string {
  if (breakpoint === 'tablet')
    return locale.t('breakpoint.tablet', 'Tablet')
  if (breakpoint === 'mobile')
    return locale.t('breakpoint.mobile', 'Mobile')
  return locale.t('breakpoint.desktop', 'Desktop')
}

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
</script>

<template>
  <main class="mx-config-form-designer__canvas" :aria-label="locale.t('canvas.form', 'Form canvas')" :data-preview-breakpoint="breakpoint ?? 'desktop'" @click="emit('select', '')">
    <div class="mx-config-form-designer__canvas-tools mx-config-form-designer__segmented" role="group" :aria-label="locale.t('canvas.breakpoint', 'Preview breakpoint')">
      <button
        v-for="item in breakpoints"
        :key="item.key"
        type="button"
        :class="{ 'is-active': (breakpoint ?? 'desktop') === item.key }"
        :aria-label="breakpointTitle(item.key)"
        :title="breakpointTitle(item.key)"
        :aria-pressed="(breakpoint ?? 'desktop') === item.key"
        @click.stop="emit('updateBreakpoint', item.key)"
      >
        <component :is="item.icon" :size="15" aria-hidden="true" />
      </button>
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
        :readonly="readonly"
        :breakpoint="breakpoint"
        :interactive="interactive"
        :model="model"
        :reaction-props="reactionProps"
        :reaction-states="reactionStates"
        @select="emit('select', $event)"
        @move="forwardMove"
        @add-material="forwardAddMaterial"
        @action="forwardAction"
        @update-field="forwardUpdateField"
      />
    </div>
  </main>
</template>
