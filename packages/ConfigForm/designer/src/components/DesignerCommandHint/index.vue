<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ name: 'DesignerCommandHint' })

defineProps<{
  disabledReason?: string
  label: string
  renderer?: Component
  shortcut?: string
}>()
</script>

<template>
  <component
    :is="renderer"
    v-if="renderer"
    :disabled-reason="disabledReason"
    :label="label"
    :shortcut="shortcut"
  >
    <slot />
  </component>
  <slot v-else />
</template>
