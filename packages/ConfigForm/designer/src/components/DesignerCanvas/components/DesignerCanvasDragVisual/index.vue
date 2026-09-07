<script setup lang="ts">
import type { CSSProperties } from 'vue'

defineProps<{
  overlayStyle?: CSSProperties
}>()
</script>

<template>
  <div
    v-show="overlayStyle"
    class="mx-config-form-designer__drag-overlay"
    :style="overlayStyle"
    aria-hidden="true"
    inert
    data-designer-drag-overlay
  >
    <slot />
  </div>
</template>
