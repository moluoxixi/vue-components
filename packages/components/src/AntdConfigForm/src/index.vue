<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormFieldValue, ConfigFormValues } from '@moluoxixi/config-form-headless'
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
import { useTemplateRef } from 'vue'
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

const expose: AntdConfigFormExpose<TValues> = {
  clearValidate: fields => rendererRef.value!.clearValidate(fields),
  getErrors: () => rendererRef.value!.getErrors(),
  getValidating: () => rendererRef.value!.getValidating(),
  getValue: rendererGetValue,
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

function rendererGetValue<TField extends string>(
  field: TField,
): ConfigFormFieldValue<TValues, TField> {
  return rendererRef.value!.getValue(field)
}

function rendererSetValue<TField extends string>(
  field: TField,
  value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
): void {
  rendererRef.value!.setValue(field, value)
}

function rendererSetValues(values: Partial<TValues>, replace?: false): void
function rendererSetValues(values: TValues, replace: true): void
function rendererSetValues(
  ...args: [values: Partial<TValues>, replace?: false] | [values: TValues, replace: true]
): void {
  if (args[1] === true)
    rendererRef.value!.setValues(args[0], true)
  else
    rendererRef.value!.setValues(args[0])
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
    :fields="props.fields"
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
