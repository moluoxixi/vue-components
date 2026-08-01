<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormFieldValidateRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormFieldEmits, ConfigFormFieldProps } from './types'
import { computed, useId, useSlots } from 'vue'
import FormComponent from '../../FormComponent'
import { resolveConfigFormCondition } from '@moluoxixi/config-form-headless'

defineOptions({
  name: 'ConfigFormField',
})

const props = defineProps<ConfigFormFieldProps<TValues>>()

const emit = defineEmits<ConfigFormFieldEmits<TValues>>()
const slots = useSlots()
const fieldId = useId()
const fieldErrors = computed<string[]>(() => props.errors[props.field.field] ?? [])
const controlId = computed(() => {
  const configuredId = props.field.props?.id
  return typeof configuredId === 'string' && configuredId ? configuredId : `${fieldId}-control`
})
const errorId = `${fieldId}-error`

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function handleFieldValidate(payload: ConfigFormFieldValidateRequest<TValues>): void {
  emit('fieldValidate', payload)
}

function getForwardedSlotNames(): string[] {
  return Object.keys(slots)
}

function isFieldRequired(): boolean {
  return resolveConfigFormCondition(props.field.required, props.model, false)
}
</script>

<template>
  <div
    class="mx-element-config-form__field"
    :data-field="field.field"
    :data-required="isFieldRequired()"
    v-bind="field.formItemProps"
  >
    <label
      class="mx-element-config-form__label"
      :for="controlId"
    >
      {{ field.label }}
    </label>
    <div class="mx-element-config-form__control">
      <FormComponent
        :control-id="controlId"
        :error-id="errorId"
        :errors="errors"
        :field="field"
        :model="model"
        :readonly="readonly"
        :readonly-render="readonlyRender"
        @field-change="handleFieldChange"
        @field-validate="handleFieldValidate"
      >
        <template
          v-for="slotName in getForwardedSlotNames()"
          #[slotName]="slotProps"
        >
          <slot
            :name="slotName"
            v-bind="slotProps ?? {}"
          />
        </template>
      </FormComponent>
    </div>
    <p
      v-for="(message, index) in fieldErrors"
      :id="index === 0 ? errorId : undefined"
      :key="`${message}-${index}`"
      class="mx-element-config-form__error"
    >
      {{ message }}
    </p>
  </div>
</template>
