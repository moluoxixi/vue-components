<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ShadcnConfigFormEmits,
  ShadcnConfigFormErrors,
  ShadcnConfigFormExpose,
  ShadcnConfigFormProps,
  ShadcnConfigFormSlots,
} from './types'
import { computed, reactive, useAttrs, useTemplateRef } from 'vue'
import FormLayout from './components/FormLayout'
import { collectConfigFormFields, createConfigFormController } from '@moluoxixi/config-form-headless'
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
const {
  applyFieldChange: handleFieldChange,
  getValue,
  getValues,
  setValue,
  setValues,
} = createConfigFormController<TValues>({
  model: {
    read: () => model.value,
    write: (values) => {
      model.value = values
    },
  },
  onChange: values => emit('change', values),
  onFieldChange: (payload) => {
    clearValidate(payload.field)
    emit('fieldChange', payload)
  },
})

const inlineLayout = computed(() => props.inline === true)

const formAttrs = computed<Record<string, unknown>>(() => ({
  ...attrs,
  ...props.formProps,
}))

function getErrors(): ShadcnConfigFormErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, [...messages]]),
  )
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
    setValues({ ...initialValues }, true)
    clearValidate()
    return
  }

  const values = { ...model.value } as ConfigFormValues
  fieldNames.forEach((field) => {
    values[field] = initialValues[field]
  })
  setValues(values as TValues, true)
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
      :inline-layout="inlineLayout"
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
