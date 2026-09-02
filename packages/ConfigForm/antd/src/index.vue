<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererExpose,
  ConfigFormRendererField,
} from '@moluoxixi/config-form'
import type {
  AntdConfigFormEmits,
  AntdConfigFormExpose,
  AntdConfigFormProps,
  AntdConfigFormSlots,
} from './types'
import { computed, useTemplateRef } from 'vue'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '@moluoxixi/config-form'
import { resolveAntdConfigFormFieldBinding } from './adapters'
import { ANTD_CONFIG_FORM_COMPONENTS } from './registries'
import './styles/index.scss'

defineOptions({
  name: 'AntdConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<AntdConfigFormProps<TValues>>(), {
  cellAttrs: () => ({}),
  columns: 24,
  fieldSpan: 24,
  formAttrs: () => ({}),
  gap: '16px',
  layoutAttrs: () => ({}),
})

const emit = defineEmits<AntdConfigFormEmits<TValues>>()
defineSlots<AntdConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const rendererRef = useTemplateRef<ConfigFormRendererExpose<TValues>>('rendererRef')
const expose: AntdConfigFormExpose<TValues> = createConfigFormRendererExpose(rendererRef)
const components = computed(() => ({
  ...ANTD_CONFIG_FORM_COMPONENTS,
  ...(props.components ?? {}),
}))

function resolveBinding(field: ConfigFormRendererField<TValues>) {
  return resolveAntdConfigFormFieldBinding(field)
}

defineExpose(expose)
</script>

<template>
  <ConfigFormRenderer
    ref="rendererRef"
    v-model="model"
    v-bind="{ ...$attrs, ...props }"
    :components="components"
    default-trigger="update:value"
    default-value-prop="value"
    namespace="mx-antd-config-form"
    :resolve-binding="resolveBinding"
    @change="emit('change', $event)"
    @error="emit('error', $event)"
    @field-change="emit('fieldChange', $event)"
    @meta-change="emit('metaChange', $event)"
    @submit="emit('submit', $event)"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ConfigFormRenderer>
</template>
