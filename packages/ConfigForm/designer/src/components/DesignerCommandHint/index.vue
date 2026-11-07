<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ name: 'DesignerCommandHint' })

const props = defineProps<{
  disabledReason?: string
  label: string
  renderer?: Component
  shortcut?: string
}>()
</script>

<template>
  <component
    :is="props.renderer"
    v-if="props.renderer"
    :disabled-reason="props.disabledReason"
    :label="props.label"
    :shortcut="props.shortcut"
  >
    <slot />
  </component>
  <slot v-else />
</template>
