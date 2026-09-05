<script setup lang="ts">
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type {
  DesignerPropertyControlRegistry,
  DesignerPropertySetterDefinition,
} from '../../../registry'
import type { DesignerPropertyFormEntry } from '../types'
import DesignerPropertyForm from './DesignerPropertyForm.vue'

defineOptions({ name: 'DesignerBreakpointLayoutSettings' })

const props = defineProps<{
  baseLabel?: string
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  enabled: boolean
  entries: DesignerPropertyFormEntry[]
  fraction: string
  fractionAria: string
  icon: Component
  readonly?: boolean
  title: string
  toggleEntry?: DesignerPropertyFormEntry
}>()

const emit = defineEmits<{
  commit: [payload: { setter: DesignerPropertySetterDefinition, value: unknown }]
  toggle: [value: unknown]
}>()

function commitEntry(value: unknown, setter: DesignerPropertySetterDefinition): void {
  emit('commit', { setter, value })
}
</script>

<template>
  <section class="mx-config-form-designer__breakpoint-layout">
    <header class="mx-config-form-designer__breakpoint-header">
      <span class="mx-config-form-designer__responsive-label">
        <component :is="icon" :size="15" aria-hidden="true" />
        {{ title }}
      </span>
      <DesignerPropertyForm
        v-if="toggleEntry"
        class="mx-config-form-designer__responsive-toggle-control"
        :entries="[toggleEntry]"
        :components="components"
        :controls="controls"
        :readonly="readonly"
        @commit="emit('toggle', $event)"
      />
      <span v-else class="mx-config-form-designer__breakpoint-base">{{ baseLabel }}</span>
    </header>

    <output class="mx-config-form-designer__responsive-fraction" :aria-label="fractionAria">
      {{ fraction }}
    </output>

    <DesignerPropertyForm
      v-if="enabled"
      class="mx-config-form-designer__breakpoint-fields"
      :entries="entries"
      :components="components"
      :controls="controls"
      :readonly="readonly"
      @commit="commitEntry"
    />
  </section>
</template>
