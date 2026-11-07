<script setup lang="ts">
import type { Component } from 'vue'
import type { DesignerCanvasCameraMode } from '../../types'
import { Scan, ZoomIn, ZoomOut } from '@lucide/vue'
import { useDesignerLocale } from '../../../../locale'
import { DesignerCommandHint } from '../../../DesignerCommandHint'

const props = defineProps<{
  commandHint?: Component
  maxScale: number
  minScale: number
  mode: DesignerCanvasCameraMode
  percent: number
  scale: number
}>()

const emit = defineEmits<{
  fit: []
  reset: []
  zoomIn: []
  zoomOut: []
}>()

const locale = useDesignerLocale()
</script>

<template>
  <div class="mx-config-form-designer__camera-controls" role="group" :aria-label="locale.t('canvas.camera', 'Canvas zoom and pan')" data-designer-editor-control>
    <DesignerCommandHint :renderer="props.commandHint" :label="locale.t('canvas.zoomOut', 'Zoom out')" shortcut="-" :disabled-reason="props.scale <= props.minScale ? locale.t('canvas.minimumZoom', 'Minimum zoom reached') : undefined">
      <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="props.scale <= props.minScale ? 'true' : undefined" aria-keyshortcuts="-" :aria-label="locale.t('canvas.zoomOut', 'Zoom out')" :title="locale.t('canvas.zoomOut', 'Zoom out')" @click="props.scale > props.minScale && emit('zoomOut')">
        <ZoomOut :size="16" aria-hidden="true" />
      </button>
    </DesignerCommandHint>
    <DesignerCommandHint :renderer="props.commandHint" :label="locale.t('canvas.actualSize', 'Actual size')" shortcut="0">
      <button type="button" class="mx-config-form-designer__camera-percent" aria-keyshortcuts="0" :aria-label="locale.t('canvas.actualSize', 'Actual size')" :title="locale.t('canvas.actualSizeHint', 'Actual size (100%)')" @click="emit('reset')">
        {{ props.percent }}%
      </button>
    </DesignerCommandHint>
    <DesignerCommandHint :renderer="props.commandHint" :label="locale.t('canvas.zoomIn', 'Zoom in')" shortcut="+" :disabled-reason="props.scale >= props.maxScale ? locale.t('canvas.maximumZoom', 'Maximum zoom reached') : undefined">
      <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="props.scale >= props.maxScale ? 'true' : undefined" aria-keyshortcuts="Shift+=" :aria-label="locale.t('canvas.zoomIn', 'Zoom in')" :title="locale.t('canvas.zoomIn', 'Zoom in')" @click="props.scale < props.maxScale && emit('zoomIn')">
        <ZoomIn :size="16" aria-hidden="true" />
      </button>
    </DesignerCommandHint>
    <span class="mx-config-form-designer__camera-separator" aria-hidden="true" />
    <DesignerCommandHint :renderer="props.commandHint" :label="locale.t('canvas.fit', 'Fit canvas')" shortcut="Shift+1">
      <button type="button" class="mx-config-form-designer__icon-button" :class="{ 'is-active': props.mode === 'fit' }" aria-keyshortcuts="Shift+1" :aria-label="locale.t('canvas.fit', 'Fit canvas')" :title="locale.t('canvas.fitHint', 'Fit canvas (Shift+1)')" :aria-pressed="props.mode === 'fit'" @click="emit('fit')">
        <Scan :size="16" aria-hidden="true" />
      </button>
    </DesignerCommandHint>
  </div>
</template>
