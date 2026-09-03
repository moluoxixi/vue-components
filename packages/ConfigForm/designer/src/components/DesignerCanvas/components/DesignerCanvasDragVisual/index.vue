<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useTemplateRef } from 'vue'

defineProps<{
  html: string
  overlayStyle?: CSSProperties
  useSlot: boolean
}>()

const root = useTemplateRef<HTMLElement>('root')

defineExpose({
  getElement: () => root.value,
})
</script>

<template>
  <div
    ref="root"
    v-show="overlayStyle"
    class="mx-config-form-designer__drag-overlay"
    :style="overlayStyle"
    aria-hidden="true"
    data-designer-drag-overlay
  >
    <slot v-if="useSlot" />
    <div v-else-if="html" class="mx-config-form-designer__drag-overlay-content" v-html="html" />
  </div>
</template>
