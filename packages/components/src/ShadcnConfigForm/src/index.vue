<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '../../ConfigForm'
import type {
  ShadcnConfigFormEmits,
  ShadcnConfigFormErrors,
  ShadcnConfigFormExpose,
  ShadcnConfigFormProps,
  ShadcnConfigFormSlots,
} from './types'
import { computed, reactive, useAttrs, useTemplateRef } from 'vue'
import FormLayout from './components/FormLayout'
import { collectConfigFormFields } from '../../ConfigForm'
import { collectShadcnFieldRules, getShadcnFieldErrorMessages } from './utils'
import './styles.scss'

defineOptions({
  name: 'ShadcnConfigForm',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ShadcnConfigFormProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  formProps: () => ({}),
  rowProps: () => ({}),
  rules: () => ({}),
})

const emit = defineEmits<ShadcnConfigFormEmits<TValues>>()
defineSlots<ShadcnConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const attrs = useAttrs()
const errors = reactive<ShadcnConfigFormErrors>({})
const initialValues = { ...model.value } as TValues

const formAttrs = computed<Record<string, unknown>>(() => ({
  ...attrs,
  ...props.formProps,
}))

function getValues(): TValues {
  return { ...model.value }
}

function getErrors(): ShadcnConfigFormErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, [...messages]]),
  )
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
  clearValidate(field)
  emit('fieldChange', { field, value, values })
  emit('change', values)
}

function setValues(values: Partial<TValues>, replace = false): void {
  commitValues((replace ? values : { ...model.value, ...values }) as TValues)
}

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  setValue(payload.field, payload.value)
}

async function validate(): Promise<boolean> {
  const fields = collectConfigFormFields(props.fields, model.value)
  const results = fields.map((field) => {
    const messages = getShadcnFieldErrorMessages(
      field,
      collectShadcnFieldRules(field, props.rules),
      model.value,
    )

    setFieldErrors(field.field, messages)
    return messages.length === 0
  })

  return results.every(Boolean)
}

async function validateField(fieldName: keyof TValues & string | string): Promise<boolean> {
  const field = collectConfigFormFields(props.fields, model.value).find(item => item.field === fieldName)!
  const messages = getShadcnFieldErrorMessages(
    field,
    collectShadcnFieldRules(field, props.rules),
    model.value,
  )

  setFieldErrors(field.field, messages)
  return messages.length === 0
}

async function submit(): Promise<boolean> {
  const valid = await validate()

  if (!valid) {
    emit('error', getErrors())
    return false
  }

  emit('submit', getValues())
  return true
}

function resetFields(fields?: keyof TValues & string | string | Array<keyof TValues & string | string>): void {
  const fieldNames = normalizeFieldNames(fields)

  if (fieldNames === undefined) {
    commitValues({ ...initialValues })
    clearValidate()
    return
  }

  const values = { ...model.value } as ConfigFormValues
  fieldNames.forEach((field) => {
    values[field] = initialValues[field]
  })
  commitValues(values as TValues)
  clearValidate(fieldNames)
}

function clearValidate(fields?: keyof TValues & string | string | Array<keyof TValues & string | string>): void {
  const fieldNames = normalizeFieldNames(fields)

  if (fieldNames === undefined) {
    Object.keys(errors).forEach((field) => {
      delete errors[field]
    })
    return
  }

  fieldNames.forEach((field) => {
    delete errors[field]
  })
}

function scrollToField(field: keyof TValues & string | string): void {
  formRef.value!.querySelector<HTMLElement>(`[data-field="${field}"]`)!.scrollIntoView()
}

function setFieldErrors(field: string, messages: string[]): void {
  if (messages.length === 0) {
    delete errors[field]
    return
  }

  errors[field] = messages
}

function normalizeFieldNames(
  fields?: keyof TValues & string | string | Array<keyof TValues & string | string>,
): string[] | undefined {
  if (fields === undefined)
    return undefined

  return ([] as string[]).concat(fields)
}

defineExpose<ShadcnConfigFormExpose<TValues>>({
  clearValidate,
  getErrors,
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
  <form
    ref="formRef"
    class="mx-shadcn-config-form"
    v-bind="formAttrs"
    @submit.prevent="submit"
  >
    <FormLayout
      :col-props="props.colProps"
      :errors="errors"
      :field-span="props.fieldSpan"
      :model="model"
      :nodes="props.fields"
      :row-props="props.rowProps"
      @field-change="handleFieldChange"
    />

    <slot
      v-bind="{ model, submit, resetFields }"
    />
  </form>
</template>
