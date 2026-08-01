<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ShadcnConfigFormField } from '../../../types'
import type { FormComponentEmits, FormComponentProps } from './types'
import { defineComponent, h, markRaw, useSlots } from 'vue'
import {
  formatConfigFormReadonlyValue,
  isConfigFormFieldReadonly,
  resolveConfigFormCondition,
  resolveConfigFormReadonlyRender,
} from '@moluoxixi/config-form-headless'

defineOptions({
  name: 'ShadcnConfigFormComponent',
})

const props = defineProps<FormComponentProps<TValues>>()
const emit = defineEmits<FormComponentEmits<TValues>>()
const slots = useSlots()
const ReadonlyContent = defineComponent({
  name: 'ShadcnConfigFormReadonlyContent',
  setup: () => () => {
    const field = props.field
    const render = resolveConfigFormReadonlyRender(field, props.readonlyRender)
    if (render) {
      return render({
        componentProps: field.props ?? {},
        field,
        model: props.model,
        value: getFieldValue(field),
      })
    }

    return h('span', { class: 'mx-shadcn-config-form__readonly' }, formatConfigFormReadonlyValue(getFieldValue(field)))
  },
})

function getFieldValue(field: ShadcnConfigFormField<TValues>): unknown {
  return props.model[field.field]
}

function resolveFieldEventValue(field: ShadcnConfigFormField<TValues>, args: unknown[]): unknown {
  return field.getValueFromEvent ? field.getValueFromEvent(...args) : args[0]
}

function getFieldValueProp(field: ShadcnConfigFormField<TValues>): string {
  return field.valueProp ?? 'modelValue'
}

function getFieldTrigger(field: ShadcnConfigFormField<TValues>): string {
  return field.trigger ?? 'update:modelValue'
}

function emitFieldChange(field: ShadcnConfigFormField<TValues>, value: unknown): void {
  emit('fieldChange', {
    field: field.field,
    value,
  })
}

function getFieldComponentProps(field: ShadcnConfigFormField<TValues>): Record<string, unknown> {
  const componentProps = {
    ...field.props,
    [getFieldValueProp(field)]: getFieldValue(field),
  }

  if (props.controlId)
    componentProps.id ??= props.controlId

  if (resolveConfigFormCondition(field.disabled, props.model, false))
    componentProps.disabled = true
  if ((props.errors[field.field]?.length ?? 0) > 0) {
    componentProps['aria-invalid'] = true
    if (props.errorId)
      componentProps['aria-describedby'] = props.errorId
  }

  return componentProps
}

function getFieldComponent(field: ShadcnConfigFormField<TValues>): ShadcnConfigFormField<TValues>['component'] {
  const component = field.component

  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as ShadcnConfigFormField<TValues>['component']

  return component
}

function getFieldComponentListeners(field: ShadcnConfigFormField<TValues>): Record<string, (...args: unknown[]) => void> {
  const listeners: Record<string, (...args: unknown[]) => void> = {
    [getFieldTrigger(field)]: (...args: unknown[]) => {
      emitFieldChange(field, resolveFieldEventValue(field, args))
    },
  }
  const blurTrigger = field.blurTrigger ?? 'blur'
  const existing = listeners[blurTrigger]
  listeners[blurTrigger] = (...args: unknown[]) => {
    existing?.(...args)
    emit('fieldValidate', { field: field.field, trigger: 'blur' })
  }
  return listeners
}

function isReadonly(): boolean {
  return isConfigFormFieldReadonly(props.field, props.model, props.readonly)
}

function getForwardedSlotNames(): string[] {
  return Object.keys(slots)
}
</script>

<template>
  <ReadonlyContent v-if="isReadonly()" />
  <component
    v-else
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
