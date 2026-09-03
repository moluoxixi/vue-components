<script setup lang="ts">
import type { Component, CSSProperties } from 'vue'
import type { DesignerNodeAction } from '../../../DesignSurface/types'
import type { DesignerCanvasDesignPolicySpot, DesignerCanvasOverlayBox, DesignerOverlayMode } from '../../types'
import { TriangleAlert } from '@lucide/vue'
import { useDesignerLocale } from '../../../../locale'
import { DesignerCommandHint } from '../../../DesignerCommandHint'
import { DesignerCanvasNodeToolbar } from './components'

defineProps<{
  boxes: DesignerCanvasOverlayBox[]
  canResize: (nodeId: string) => boolean
  collapsedCandidateIndicator?: CSSProperties
  commandHint?: Component
  designPolicySpots: DesignerCanvasDesignPolicySpot[]
  isNodeKeyboardDragging: (nodeId: string) => boolean
  menuId: string
  menuNodeId?: string
  nodeLabel: (nodeId: string) => string
  overlayMode: DesignerOverlayMode
  readonly: boolean
  resizingNodeId?: string
}>()

const emit = defineEmits<{
  action: [action: DesignerNodeAction, nodeId: string]
  beginDrag: [event: PointerEvent, nodeId: string]
  beginResize: [event: PointerEvent, nodeId: string]
  dragKeydown: [event: KeyboardEvent, nodeId: string]
  menuAction: [action: DesignerNodeAction, nodeId: string]
  menuKeydown: [event: KeyboardEvent]
  toggleMenu: [nodeId: string]
  toolbarKeydown: [event: KeyboardEvent]
}>()

const locale = useDesignerLocale()
</script>

<template>
  <div class="mx-config-form-designer__editor-overlay">
    <div
      v-if="collapsedCandidateIndicator"
      class="mx-config-form-designer__collapsed-drop-indicator"
      :style="collapsedCandidateIndicator"
    />
    <div
      v-for="box in boxes"
      :key="box.id"
      class="mx-config-form-designer__selection-box"
      :class="{ 'is-primary': box.primary, 'is-resizing': overlayMode === 'resizing' && box.id === resizingNodeId }"
      :style="box.style"
      :aria-label="box.primary ? locale.t('node.select', 'Select {label}', { label: nodeLabel(box.id) }) : undefined"
      :data-editor-focus-node-id="box.primary ? box.id : undefined"
      :role="box.primary ? 'group' : undefined"
      :tabindex="box.primary ? -1 : undefined"
    >
      <DesignerCanvasNodeToolbar
        v-if="box.primary"
        :node-id="box.id"
        :readonly="readonly"
        :command-hint="commandHint"
        :keyboard-dragging="isNodeKeyboardDragging(box.id)"
        :menu-id="menuId"
        :menu-open="menuNodeId === box.id"
        @action="emit('action', $event, box.id)"
        @begin-drag="emit('beginDrag', $event, box.id)"
        @drag-keydown="emit('dragKeydown', $event, box.id)"
        @menu-action="emit('menuAction', $event, box.id)"
        @menu-keydown="emit('menuKeydown', $event)"
        @toggle-menu="emit('toggleMenu', box.id)"
        @toolbar-keydown="emit('toolbarKeydown', $event)"
      />
      <DesignerCommandHint v-if="box.primary && canResize(box.id)" :renderer="commandHint" :label="locale.t('node.resize', 'Resize node')">
        <button
          type="button"
          class="mx-config-form-designer__resize-handle"
          :aria-label="locale.t('node.resize', 'Resize node')"
          :title="locale.t('node.resize', 'Resize node')"
          aria-hidden="false"
          data-designer-editor-control
          @pointerdown="emit('beginResize', $event, box.id)"
        />
      </DesignerCommandHint>
    </div>
    <span
      v-for="spot in designPolicySpots"
      :key="`design-policy-${spot.id}`"
      class="mx-config-form-designer__design-policy-spot"
      :style="spot.style"
      :title="spot.message"
      :aria-label="spot.message"
      data-designer-editor-control
      role="img"
      tabindex="0"
    >
      <TriangleAlert :size="13" aria-hidden="true" />
    </span>
  </div>
</template>
