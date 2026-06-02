<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type { ConfigFormFieldEmits, ConfigFormFieldProps } from './types'
import { computed, useSlots } from 'vue'
import FormComponent from '../../FormComponent'
import { resolveConfigFormCondition } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'ShadcnConfigFormField',
})

const props = defineProps<ConfigFormFieldProps<TValues>>()
const emit = defineEmits<ConfigFormFieldEmits<TValues>>()
const slots = useSlots()

const fieldErrors = computed<string[]>(() => props.errors[props.field.field] ?? [])

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
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
    class="mx-shadcn-config-form__field"
    :data-field="field.field"
    :data-required="isFieldRequired()"
    v-bind="field.formItemProps"
  >
    <label
      class="mx-shadcn-config-form__label"
      :for="field.field"
    >
      {{ field.label }}
    </label>

    <div class="mx-shadcn-config-form__control">
      <FormComponent
        :field="field"
        :model="model"
        @field-change="handleFieldChange"
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
      v-for="message in fieldErrors"
      :key="message"
      class="mx-shadcn-config-form__error"
    >
      {{ message }}
    </p>
  </div>
</template>
