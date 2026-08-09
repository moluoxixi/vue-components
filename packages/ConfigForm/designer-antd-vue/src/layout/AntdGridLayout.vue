<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  columns?: number
  gap?: number
}>(), {
  columns: 2,
  gap: 12,
})

const style = computed(() => ({
  '--mx-antd-grid-columns': String(Math.max(1, Math.min(12, props.columns))),
  '--mx-antd-grid-gap': `${Math.max(0, props.gap)}px`,
}))
</script>

<template>
  <div class="mx-antd-grid-layout" :style="style">
    <slot />
  </div>
</template>
