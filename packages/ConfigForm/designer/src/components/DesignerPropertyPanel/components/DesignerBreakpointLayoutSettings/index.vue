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
        <component :is="props.icon" :size="15" aria-hidden="true" />
        {{ props.title }}
      </span>
      <ElSwitch
        v-if="props.toggleLabel"
        class="mx-config-form-designer__responsive-toggle-control"
        :model-value="props.enabled"
        :aria-label="props.toggleLabel"
        :disabled="props.commandsDisabled"
        @change="toggle"
      />
      <span v-else class="mx-config-form-designer__breakpoint-base">{{ props.baseLabel }}</span>
    </header>

    <output class="mx-config-form-designer__responsive-fraction" :aria-label="props.fractionAria">
      {{ props.fraction }}
    </output>

    <div v-if="props.enabled" class="mx-config-form-designer__breakpoint-fields">
      <slot />
    </div>
  </section>
</template>
