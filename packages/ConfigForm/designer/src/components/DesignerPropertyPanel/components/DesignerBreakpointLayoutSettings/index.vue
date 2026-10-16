<script setup lang="ts">
import type { Component } from 'vue'
import { ElSwitch } from 'element-plus'

defineOptions({ name: 'DesignerBreakpointLayoutSettings' })

const props = defineProps<{
  baseLabel?: string
  enabled: boolean
  fraction: string
  fractionAria: string
  icon: Component
  commandsDisabled?: boolean
  title: string
  toggleLabel?: string
}>()

const emit = defineEmits<{
  toggle: [value: boolean]
}>()

function toggle(value: string | number | boolean): void {
  if (!props.commandsDisabled)
    emit('toggle', Boolean(value))
}
</script>

<template>
  <section class="mx-config-form-designer__breakpoint-layout">
    <header class="mx-config-form-designer__breakpoint-header">
      <span class="mx-config-form-designer__responsive-label">
        <component :is="icon" :size="15" aria-hidden="true" />
        {{ title }}
      </span>
      <ElSwitch
        v-if="toggleLabel"
        class="mx-config-form-designer__responsive-toggle-control"
        :model-value="enabled"
        :aria-label="toggleLabel"
        :disabled="commandsDisabled"
        @change="toggle"
      />
      <span v-else class="mx-config-form-designer__breakpoint-base">{{ baseLabel }}</span>
    </header>

    <output class="mx-config-form-designer__responsive-fraction" :aria-label="fractionAria">
      {{ fraction }}
    </output>

    <div v-if="enabled" class="mx-config-form-designer__breakpoint-fields">
      <slot />
    </div>
  </section>
</template>
