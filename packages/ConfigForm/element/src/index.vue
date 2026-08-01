<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererExpose,
} from '@moluoxixi/config-form'
import type {
  ElementConfigFormEmits,
  ElementConfigFormExpose,
  ElementConfigFormProps,
  ElementConfigFormSlots,
} from './types'
import { useTemplateRef } from 'vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
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

const expose: ElementConfigFormExpose<TValues> = {
  clearValidate: fields => rendererRef.value!.clearValidate(fields),
  getErrors: () => rendererRef.value!.getErrors(),
  getValidating: () => rendererRef.value!.getValidating(),
  getValue: rendererGetValue as ElementConfigFormExpose<TValues>['getValue'],
  getValues: () => rendererRef.value!.getValues(),
  resetFields: fields => rendererRef.value!.resetFields(fields),
  scrollToField: field => rendererRef.value!.scrollToField(field),
  setValue: rendererSetValue,
  setValues: rendererSetValues,
  submit: () => rendererRef.value!.submit(),
  validate: () => rendererRef.value!.validate(),
  validateField: (field, trigger) => rendererRef.value!.validateField(field, trigger),
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
    :default-values="props.defaultValues"
    :field-span="props.fieldSpan"
    :fields="props.fields"
    :form-attrs="props.formAttrs"
    :gap="props.gap"
    :inline="props.inline"
    namespace="mx-element-config-form"
    :readonly="props.readonly"
    :readonly-render="props.readonlyRender"
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
