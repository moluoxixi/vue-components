<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormErrors,
  ConfigFormFieldValidateRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type {
  ElementConfigFormEmits,
  ElementConfigFormExpose,
  ElementConfigFormProps,
  ElementConfigFormSlots,
} from './types'
import { computed, shallowRef, useAttrs, useTemplateRef } from 'vue'
import FormLayout from './components/FormLayout'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
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
})

const emit = defineEmits<ElementConfigFormEmits<TValues>>()
defineSlots<ElementConfigFormSlots<TValues>>()
const model = defineModel<TValues>({ required: true })
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const attrs = useAttrs()
const errors = shallowRef<ConfigFormErrors>({})
const {
  applyFieldChange: handleFieldChange,
  clearValidate,
  getErrors,
  getValidating,
  getValue,
  getValues,
  resetFields,
  setValue,
  setValues,
  submit,
  validate,
  validateField,
} = createConfigFormController<TValues>({
  defaultValues: props.defaultValues,
  fields: () => props.fields,
  model: {
    read: () => model.value,
    write: (values) => {
      model.value = values
    },
  },
  onChange: values => emit('change', values),
  onError: formErrors => emit('error', formErrors),
  onErrorsChange: (formErrors) => {
    errors.value = formErrors
  },
  onFieldChange: payload => emit('fieldChange', payload),
  onSubmit: values => emit('submit', values),
  readonly: () => props.readonly,
})

const inlineLayout = computed(() => props.inline === true)

const formAttrs = computed<Record<string, unknown>>(() => {
  const nextAttrs: Record<string, unknown> = {
    ...attrs,
    ...props.formProps,
  }

  return nextAttrs
})

function scrollToField(field: keyof TValues & string | string): void {
  formRef.value!.querySelector<HTMLElement>(`[data-field="${field}"]`)!.scrollIntoView()
}

function handleFieldValidate(request: ConfigFormFieldValidateRequest<TValues>): void {
  void validateField(request.field, request.trigger)
}

defineExpose<ElementConfigFormExpose<TValues>>({
  clearValidate,
  getErrors,
  getValidating,
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
    class="mx-element-config-form"
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
      :readonly="props.readonly"
      :readonly-render="props.readonlyRender"
      :row-props="props.rowProps"
      @field-change="handleFieldChange"
      @field-validate="handleFieldValidate"
    />

    <slot
      v-bind="{ model, submit, resetFields }"
    />
  </form>
</template>
