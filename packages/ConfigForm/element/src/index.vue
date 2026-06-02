<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type {
  ElementConfigFormEmits,
  ElementConfigFormExpose,
  ElementConfigFormProps,
  ElementConfigFormSlots,
} from './types'
import type { FormInstance, FormItemProp, FormRules } from 'element-plus'
import { ElForm } from 'element-plus'
import { computed, useAttrs, useTemplateRef } from 'vue'
import FormLayout from './components/FormLayout'
import { collectConfigFormFields } from '@moluoxixi/config-form-core'
import './styles.scss'

defineOptions({
  name: 'ElementConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ElementConfigFormProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  formProps: () => ({}),
  rowProps: () => ({ gutter: 16 }),
  rules: () => ({}),
})

const emit = defineEmits<ElementConfigFormEmits<TValues>>()
defineSlots<ElementConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const formRef = useTemplateRef<FormInstance>('formRef')
const attrs = useAttrs()

const formRules = computed<FormRules<TValues>>(() => {
  const fieldRules = Object.fromEntries(
    collectConfigFormFields(props.fields, model.value)
      .filter(field => field.rules)
      .map(field => [field.field, field.rules]),
  )

  return {
    ...props.rules,
    ...fieldRules,
  } as FormRules<TValues>
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
  let invalidFields: unknown
  const valid = await formRef.value!.validate((isValid, fields) => {
    invalidFields = fields
  })

  if (!valid) {
    emit('error', invalidFields)
    return false
  }

  emit('submit', getValues())
  return true
}

function validate(): ReturnType<FormInstance['validate']> {
  return formRef.value!.validate()
}

function validateField(props?: Parameters<FormInstance['validateField']>[0]): ReturnType<FormInstance['validateField']> {
  return formRef.value!.validateField(props)
}

function resetFields(props?: Parameters<FormInstance['resetFields']>[0]): void {
  formRef.value!.resetFields(props)
}

function clearValidate(props?: Parameters<FormInstance['clearValidate']>[0]): void {
  formRef.value!.clearValidate(props)
}

function scrollToField(field: keyof TValues & string | FormItemProp): void {
  formRef.value!.scrollToField(field)
}

defineExpose<ElementConfigFormExpose<TValues>>({
  clearValidate,
  getValue,
  getValues,
  resetFields,
  scrollToField,
  setValue,
  setValues,
  submit,
  validate,
  validateField,
})
</script>

<template>
  <ElForm
    ref="formRef"
    class="mx-element-config-form"
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
  </ElForm>
</template>
