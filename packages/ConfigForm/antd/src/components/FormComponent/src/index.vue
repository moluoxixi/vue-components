<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type { AntdConfigFormField } from '../../../types'
import type { FormComponentEmits, FormComponentProps } from './types'
import { markRaw, useSlots } from 'vue'
import { resolveConfigFormCondition } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'AntdConfigFormComponent',
})

const props = defineProps<FormComponentProps<TValues>>()
const emit = defineEmits<FormComponentEmits<TValues>>()
const slots = useSlots()

function getFieldValue(field: AntdConfigFormField<TValues>): unknown {
  return props.model[field.field]
}

function resolveFieldEventValue(field: AntdConfigFormField<TValues>, args: unknown[]): unknown {
  return field.getValueFromEvent ? field.getValueFromEvent(...args) : args[0]
}

function getFieldValueProp(field: AntdConfigFormField<TValues>): string {
  return field.valueProp ?? 'value'
}

function getFieldTrigger(field: AntdConfigFormField<TValues>): string {
  return field.trigger ?? 'update:value'
}

function emitFieldChange(field: AntdConfigFormField<TValues>, value: unknown): void {
  emit('fieldChange', {
    field: field.field,
    value,
  })
}

function getFieldComponentProps(field: AntdConfigFormField<TValues>): Record<string, unknown> {
  const componentProps = {
    ...field.props,
    [getFieldValueProp(field)]: getFieldValue(field),
  }

  if (resolveConfigFormCondition(field.disabled, props.model, false))
    componentProps.disabled = true

  return componentProps
}

function getFieldComponent(field: AntdConfigFormField<TValues>): AntdConfigFormField<TValues>['component'] {
  const component = field.component

  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as AntdConfigFormField<TValues>['component']

  return component
}

function getFieldComponentListeners(field: AntdConfigFormField<TValues>): Record<string, (...args: unknown[]) => void> {
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
