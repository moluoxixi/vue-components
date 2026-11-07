<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = defineProps<{
  overlayStyle?: CSSProperties
}>()
</script>

<template>
  <div
    v-show="props.overlayStyle"
    class="mx-config-form-designer__drag-overlay"
    :style="props.overlayStyle"
    aria-hidden="true"
    inert
    data-designer-drag-overlay
  >
    <slot />
  </div>
</template>
