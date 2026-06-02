<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '../../ConfigForm'
import type {
  AntdConfigFormEmits,
  AntdConfigFormExpose,
  AntdConfigFormProps,
  AntdConfigFormSlots,
} from './types'
import type { FormInstance, FormProps } from 'ant-design-vue'
import { Form as AForm } from 'ant-design-vue'
import { computed, useAttrs, useTemplateRef } from 'vue'
import FormLayout from './components/FormLayout'
import { collectConfigFormFields } from '../../ConfigForm'
import './styles.scss'

defineOptions({
  name: 'antdConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<AntdConfigFormProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  formProps: () => ({}),
  rowProps: () => ({ gutter: 16 }),
  rules: () => ({}),
})

const emit = defineEmits<AntdConfigFormEmits<TValues>>()
defineSlots<AntdConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const formRef = useTemplateRef<FormInstance>('formRef')
const attrs = useAttrs()

const formRules = computed<FormProps['rules']>(() => {
  const fieldRules = Object.fromEntries(
    collectConfigFormFields(props.fields, model.value)
      .filter(field => field.rules)
      .map(field => [field.field, field.rules]),
  )

  return {
    ...props.rules,
    ...fieldRules,
  } as FormProps['rules']
})

const formAttrs = computed<Record<string, unknown>>(() => ({
  ...attrs,
  ...props.formProps,
}))

function getValues(): TValues {
  return { ...model.value }
}

function getValue<K extends keyof TValues & string>(field: K): TValues[K]
function getValue(field: string): unknown
function getValue(field: string): unknown {
  return model.value[field]
}

function commitValues(values: TValues): void {
  model.value = values
  emit('change', values)
}

function setValue<K extends keyof TValues & string>(field: K, value: TValues[K]): void
function setValue(field: string, value: unknown): void
function setValue(field: string, value: unknown): void {
  const values = {
    ...model.value,
    [field]: value,
  } as TValues

  model.value = values
  emit('fieldChange', { field, value, values })
  emit('change', values)
}

function setValues(values: Partial<TValues>, replace = false): void {
  commitValues((replace ? values : { ...model.value, ...values }) as TValues)
}

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  setValue(payload.field, payload.value)
}

async function submit(): Promise<boolean> {
  try {
    await formRef.value!.validate()
  }
  catch (error) {
    emit('error', error)
    return false
  }

  emit('submit', getValues())
  return true
}

function validate(): ReturnType<FormInstance['validate']> {
  return formRef.value!.validate()
}

function validateFields(...args: Parameters<FormInstance['validateFields']>): ReturnType<FormInstance['validateFields']> {
  return formRef.value!.validateFields(...args)
}

function resetFields(name?: Parameters<FormInstance['resetFields']>[0]): void {
  formRef.value!.resetFields(name)
}

function clearValidate(name?: Parameters<FormInstance['clearValidate']>[0]): void {
  formRef.value!.clearValidate(name)
}

function scrollToField(field: keyof TValues & string | string): void {
  formRef.value!.scrollToField(field)
}

defineExpose<AntdConfigFormExpose<TValues>>({
  clearValidate,
  getValue,
  getValues,
  resetFields,
  scrollToField,
  setValue,
  setValues,
  submit,
  validate,
  validateFields,
})
</script>

<template>
  <AForm
    ref="formRef"
    class="mx-antd-config-form"
    v-bind="formAttrs"
    :model="model"
    :rules="formRules"
    @submit.prevent="submit"
  >
    <FormLayout
      :col-props="props.colProps"
      :field-span="props.fieldSpan"
      :model="model"
      :nodes="props.fields"
      :row-props="props.rowProps"
      @field-change="handleFieldChange"
    />

    <slot
      v-bind="{ model, submit, resetFields }"
    />
  </AForm>
</template>
