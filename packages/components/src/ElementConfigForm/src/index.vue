<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererExpose,
} from '@moluoxixi/config-form/renderer'
import type {
  ElementConfigFormEmits,
  ElementConfigFormExpose,
  ElementConfigFormProps,
  ElementConfigFormSlots,
} from './types'
import { useTemplateRef } from 'vue'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'
import './styles.scss'

defineOptions({
  name: 'ElementConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ElementConfigFormProps<TValues>>(), {
  cellAttrs: () => ({}),
  columns: 24,
  fieldSpan: 24,
  formAttrs: () => ({}),
  gap: '16px',
  layoutAttrs: () => ({}),
})

const emit = defineEmits<ElementConfigFormEmits<TValues>>()
defineSlots<ElementConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const rendererRef = useTemplateRef<ConfigFormRendererExpose<TValues>>('rendererRef')
const expose: ElementConfigFormExpose<TValues> = createConfigFormRendererExpose(rendererRef)

defineExpose(expose)
</script>

<template>
  <ConfigFormRenderer
    ref="rendererRef"
    v-model="model"
    v-bind="{ ...$attrs, ...props }"
    namespace="mx-element-config-form"
    @change="emit('change', $event)"
    @error="emit('error', $event)"
    @field-change="emit('fieldChange', $event)"
    @submit="emit('submit', $event)"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ConfigFormRenderer>
</template>
