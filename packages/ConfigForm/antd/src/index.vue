<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererExpose,
  ConfigFormRendererField,
  ConfigFormRendererNode,
} from '@moluoxixi/config-form'
import type {
  AntdConfigFormEmits,
  AntdConfigFormExpose,
  AntdConfigFormProps,
  AntdConfigFormSlots,
} from './types'
import { computed, useTemplateRef } from 'vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { resolveAntdConfigFormFieldBinding } from './bindings'
import './styles.scss'

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
const rendererFields = computed(() => props.fields as unknown as ConfigFormRendererNode<TValues>[])

const expose: AntdConfigFormExpose<TValues> = {
  clearValidate: fields => rendererRef.value!.clearValidate(fields),
  getErrors: () => rendererRef.value!.getErrors(),
  getValidating: () => rendererRef.value!.getValidating(),
  getValue: rendererGetValue as AntdConfigFormExpose<TValues>['getValue'],
  getValues: () => rendererRef.value!.getValues(),
  resetFields: fields => rendererRef.value!.resetFields(fields),
  scrollToField: field => rendererRef.value!.scrollToField(field),
  setValue: rendererSetValue,
  setValues: rendererSetValues,
  submit: () => rendererRef.value!.submit(),
  validate: () => rendererRef.value!.validate(),
  validateField: (field, trigger) => rendererRef.value!.validateField(field, trigger),
}

function resolveBinding(field: ConfigFormRendererField<TValues>) {
  return resolveAntdConfigFormFieldBinding(field)
}

function rendererGetValue(field: string): unknown {
  return rendererRef.value!.getValue(field)
}

function rendererSetValue(field: string, value: unknown): void {
  ;(rendererRef.value!.setValue as (field: string, value: unknown) => void)(field, value)
}

function rendererSetValues(values: Partial<TValues>, replace?: boolean): void {
  if (replace)
    rendererRef.value!.setValues(values as TValues, true)
  else
    rendererRef.value!.setValues(values)
}

defineExpose(expose)
</script>

<template>
  <ConfigFormRenderer
    ref="rendererRef"
    v-model="model"
    v-bind="$attrs"
    :cell-attrs="props.cellAttrs"
    :columns="props.columns"
    default-trigger="update:value"
    default-value-prop="value"
    :default-values="props.defaultValues"
    :field-span="props.fieldSpan"
    :fields="rendererFields"
    :form-attrs="props.formAttrs"
    :gap="props.gap"
    :inline="props.inline"
    namespace="mx-antd-config-form"
    :readonly="props.readonly"
    :readonly-render="props.readonlyRender"
    :resolve-binding="resolveBinding"
    :layout-attrs="props.layoutAttrs"
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
