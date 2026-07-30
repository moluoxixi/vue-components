<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
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
import { collectConfigFormFields, createConfigFormController } from '@moluoxixi/config-form-headless'
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
  onFieldChange: payload => emit('fieldChange', payload),
})

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

const inlineLayout = computed(() => props.inline === true || props.formProps.inline === true)

const formAttrs = computed<Record<string, unknown>>(() => {
  const nextAttrs: Record<string, unknown> = {
    ...attrs,
    ...props.formProps,
  }

  if (props.inline === true)
    nextAttrs.inline = true

  return nextAttrs
})

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

function validate(...args: Parameters<FormInstance['validate']>): ReturnType<FormInstance['validate']> {
  return formRef.value!.validate(...args)
}

function validateField(...args: Parameters<FormInstance['validateField']>): ReturnType<FormInstance['validateField']> {
  return formRef.value!.validateField(...args)
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
      :inline-layout="inlineLayout"
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
