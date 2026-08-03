<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererExpose,
} from '@moluoxixi/config-form/renderer'
import type {
  ShadcnConfigFormEmits,
  ShadcnConfigFormExpose,
  ShadcnConfigFormProps,
  ShadcnConfigFormSlots,
} from './types'
import { useTemplateRef } from 'vue'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'
import './styles.scss'

defineOptions({
  name: 'ShadcnConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ShadcnConfigFormProps<TValues>>(), {
  cellAttrs: () => ({}),
  columns: 24,
  fieldSpan: 24,
  formAttrs: () => ({}),
  gap: '16px',
  layoutAttrs: () => ({}),
})

const emit = defineEmits<ShadcnConfigFormEmits<TValues>>()
defineSlots<ShadcnConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const rendererRef = useTemplateRef<ConfigFormRendererExpose<TValues>>('rendererRef')
const expose: ShadcnConfigFormExpose<TValues> = createConfigFormRendererExpose(rendererRef)

defineExpose(expose)
</script>

<template>
  <ConfigFormRenderer
    ref="rendererRef"
    v-model="model"
    v-bind="{ ...$attrs, ...props }"
    namespace="mx-shadcn-config-form"
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
