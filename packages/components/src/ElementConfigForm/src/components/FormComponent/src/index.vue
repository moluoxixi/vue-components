<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormValues,
} from '../../../../../ConfigForm'
import type {
  ElementConfigFormField,
} from '../../../types'
import type { FormComponentEmits, FormComponentProps } from './types'
import { markRaw, useSlots } from 'vue'
import { resolveConfigFormCondition } from '../../../../../ConfigForm'

defineOptions({
  name: 'FormComponent',
})

const props = defineProps<FormComponentProps<TValues>>()
const emit = defineEmits<FormComponentEmits<TValues>>()
const slots = useSlots()

function getFieldValue(field: ElementConfigFormField<TValues>): unknown {
  return props.model[field.field]
}

function resolveFieldEventValue(field: ElementConfigFormField<TValues>, args: unknown[]): unknown {
  return field.getValueFromEvent ? field.getValueFromEvent(...args) : args[0]
}

function getFieldValueProp(field: ElementConfigFormField<TValues>): string {
  return field.valueProp ?? 'modelValue'
}

function getFieldTrigger(field: ElementConfigFormField<TValues>): string {
  return field.trigger ?? 'update:modelValue'
}

function emitFieldChange(field: ElementConfigFormField<TValues>, value: unknown): void {
  emit('fieldChange', {
    field: field.field,
    value,
  })
}

function getFieldComponentProps(field: ElementConfigFormField<TValues>): Record<string, unknown> {
  const componentProps = {
    ...field.props,
    [getFieldValueProp(field)]: getFieldValue(field),
  }

  if (resolveConfigFormCondition(field.disabled, props.model, false))
    componentProps.disabled = true

  return componentProps
}

function getFieldComponent(field: ElementConfigFormField<TValues>): ElementConfigFormField<TValues>['component'] {
  const component = field.component

  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as ElementConfigFormField<TValues>['component']

  return component
}

function getFieldComponentListeners(field: ElementConfigFormField<TValues>): Record<string, (...args: unknown[]) => void> {
  return {
    [getFieldTrigger(field)]: (...args: unknown[]) => {
      emitFieldChange(field, resolveFieldEventValue(field, args))
    },
  }
}

function getForwardedSlotNames(): string[] {
  return Object.keys(slots)
}
</script>

<template>
  <component
    :is="getFieldComponent(field)"
    v-bind="getFieldComponentProps(field)"
    v-on="getFieldComponentListeners(field)"
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
  </component>
</template>
