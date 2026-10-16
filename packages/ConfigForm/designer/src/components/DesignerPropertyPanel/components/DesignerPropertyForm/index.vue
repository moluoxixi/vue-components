<script setup lang="ts">
import type { ConfigFormComponentRegistry, ConfigFormFieldChangePayload, ConfigFormField } from '@moluoxixi/config-form-headless'
import type { SurfaceNode } from '@moluoxixi/config-form-model'
import type {
  DesignerPropertyControlDefinition,
  DesignerPropertyControlRegistry,
  DesignerPropertySetterDefinition,
  DesignerSetterControl,
  DesignerSimpleSetterControl,
} from '@designer/registry'
import type { DesignerPropertyFormEntry, DesignerPropertyParseResult } from '../../types'
import type { Component } from 'vue'
import { defineField } from '@moluoxixi/config-form-headless'
import { computed, markRaw, toRaw } from 'vue'
import { useDesignerLocale } from '@designer/locale'
import { DEFAULT_DESIGNER_PROPERTY_CONTROLS } from '../../constants/property-controls'
import { useDesignerPropertyFormState } from '../../composables'
import DesignerSetter from '../DesignerSetter/index.vue'

const props = defineProps<{
  entries: DesignerPropertyFormEntry[]
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  readonly?: boolean
  node?: SurfaceNode
  renderer: Component
  identity?: string
  columns?: number
  gap?: string
}>()

const emit = defineEmits<{
  commit: [value: unknown, setter: DesignerPropertySetterDefinition]
}>()

const locale = useDesignerLocale()
const formRenderer = computed(() => rawComponent(props.renderer))
const simpleControls = new Set<DesignerSetterControl>(['text', 'textarea', 'number', 'boolean', 'select'])
const propertySetterComponent = markRaw(DesignerSetter)

/** Designer chrome is Element Plus; host-provided entries still win. */
const controls = computed<DesignerPropertyControlRegistry>(() => ({
  ...DEFAULT_DESIGNER_PROPERTY_CONTROLS,
  ...props.controls,
}))

function rawComponent<T extends DesignerPropertyControlDefinition['component']>(component: T): T {
  return typeof component === 'object' && component !== null
    ? markRaw(toRaw(component)) as T
    : component
}

function isSimpleControl(control: DesignerSetterControl): control is DesignerSimpleSetterControl {
  return simpleControls.has(control)
}

function controlFor(entry: DesignerPropertyFormEntry): DesignerPropertyControlDefinition | undefined {
  if (entry.editor)
    return entry.editor.control
  if (isSimpleControl(entry.setter.control))
    return controls.value[entry.setter.control]
  return entry.setter.control === 'defaultValue' && entry.setter.valueKind
    ? controls.value.defaultValue
    : undefined
}

function fieldValue(entry: DesignerPropertyFormEntry): unknown {
  const value = controlFor(entry) && entry.value === undefined && entry.inheritedValue !== undefined
    ? entry.inheritedValue
    : entry.value
  if (entry.setter.control !== 'number' || entry.setter.unit !== 'px' || typeof value !== 'string')
    return value
  const match = /^(\d+)px$/.exec(value)
  return match ? Number(match[1]) : value
}

const { commit, entriesByField, errors, fieldKey, model, modelPort } = useDesignerPropertyFormState({
  entries: () => props.entries,
  identity: () => props.identity ?? props.node?.id,
  readonly: () => props.readonly,
  project: fieldValue,
  parse: parseValue,
  commit: (value, entry) => emit('commit', value, entry.setter),
})

function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter')
    return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).blur()
}

function commitTextDraft(entry: DesignerPropertyFormEntry): void {
  commit(entry, model.value[fieldKey(entry)])
}

function simpleField(
  entry: DesignerPropertyFormEntry,
  control: DesignerPropertyControlDefinition,
): ConfigFormField {
  const { setter } = entry
  const key = fieldKey(entry)
  const controlClass = setter.control === 'defaultValue' ? 'default-value' : setter.control
  const inheritedLabel = entry.value === undefined && entry.inheritedValue !== undefined
    ? locale.t('setter.inherited', 'Inherited')
    : undefined
  const description = [inheritedLabel, entry.hint].filter(Boolean).join(' · ') || undefined
  const visualHint = entry.hint
    ? [inheritedLabel, entry.hint].filter(Boolean).join(' · ')
    : undefined
  const componentProps: Record<string, unknown> = entry.editor ? {
    ...control.props,
    disabled: props.readonly,
    error: errors.value[key],
    onCommit: (value: unknown) => commit(entry, value),
  } : {
    ...control.props,
    'aria-description': description,
    'aria-label': setter.label,
    'class': [
      control.props?.class,
      'mx-config-form-designer__property-control',
      `is-${controlClass}`,
    ],
    'disabled': props.readonly,
    ...(setter.control === 'textarea' ? { rows: 3 } : {}),
    ...(setter.control === 'number'
      ? {
          min: setter.min,
          max: setter.max,
          step: setter.step,
          ...(setter.integer ? { precision: 0 } : {}),
        }
      : {}),
    ...(setter.control === 'select' ? { options: setter.options ?? [] } : {}),
    ...(setter.control === 'defaultValue'
      ? { kind: setter.valueKind, options: setter.options ?? [] }
      : {}),
    ...(setter.control === 'text' ? { onKeydown: handleTextKeydown } : {}),
    ...(['text', 'textarea'].includes(setter.control)
      ? { onBlur: () => commitTextDraft(entry) }
      : {}),
  }

  return defineField({
    id: key,
    field: key,
    ...(entry.editor ? {} : { label: setter.label }),
    component: rawComponent(control.component),
    valueProp: control.valueProp,
    trigger: control.trigger,
    blurTrigger: control.blurTrigger,
    getValueFromEvent: control.getValueFromEvent,
    ...(entry.span === undefined ? {} : { span: entry.span }),
    props: componentProps,
    fieldAttrs: {
      class: [
        'mx-config-form-designer-property-form__field',
        entry.editor ? 'is-editor' : 'is-simple',
        `is-control-${controlClass}`,
      ],
      title: setter.label,
      ...(inheritedLabel ? { 'data-inherited-label': inheritedLabel } : {}),
      ...(visualHint ? { 'data-hint-label': visualHint } : {}),
    } as Record<string, unknown>,
  })
}

function customField(
  entry: DesignerPropertyFormEntry,
): ConfigFormField {
  const key = fieldKey(entry)
  const setter = entry.setter.component
    ? { ...entry.setter, component: rawComponent(entry.setter.component) }
    : entry.setter
  return defineField({
    id: key,
    field: key,
    component: propertySetterComponent,
    valueProp: 'value',
    trigger: 'commit',
    props: {
      setter,
      hint: entry.hint,
      inheritedValue: entry.inheritedValue,
      readonly: props.readonly,
      node: props.node,
    },
    fieldAttrs: {
      class: 'mx-config-form-designer-property-form__field is-custom',
    },
  })
}

const fields = computed<ConfigFormField[]>(() => props.entries.map((entry) => {
  const control = controlFor(entry)
  return control ? simpleField(entry, control) : customField(entry)
}))

const invalidNumber = Symbol('invalid-number')

function normalizeValue(setter: DesignerPropertySetterDefinition, value: unknown): unknown | typeof invalidNumber {
  if (setter.control === 'text' || setter.control === 'textarea')
    return value === '' || value === null ? undefined : value

  if (setter.control === 'number') {
    if (value === '' || value === null || value === undefined)
      return undefined
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric))
      return invalidNumber
    const constrained = Math.min(
      setter.max ?? Number.POSITIVE_INFINITY,
      Math.max(setter.min ?? Number.NEGATIVE_INFINITY, numeric),
    )
    return setter.integer ? Math.round(constrained) : constrained
  }

  return value
}

function parseValue(entry: DesignerPropertyFormEntry, value: unknown): DesignerPropertyParseResult {
  if (entry.editor?.parse)
    return entry.editor.parse(value)
  const normalized = normalizeValue(entry.setter, value)
  return normalized === invalidNumber ? { valid: false } : {
    valid: true,
    value: entry.setter.unit === 'px' && typeof normalized === 'number' ? `${normalized}px` : normalized,
  }
}

function handleFieldChange(payload: ConfigFormFieldChangePayload<Record<string, unknown>>): void {
  const entry = entriesByField.value.get(String(payload.field))
  if (!entry)
    return
  if (entry.editor?.commitOn === 'explicit')
    return
  if (
    (entry.setter.control === 'text' || entry.setter.control === 'textarea')
    && !entry.editor && controlFor(entry)
  )
    return
  commit(entry, payload.value)
}
</script>

<template>
  <component
    :is="formRenderer"
    :model="modelPort"
    :components="components"
    :fields="fields"
    :columns="columns ?? 1"
    :field-span="1"
    :gap="gap ?? '13px'"
    label-position="top"
    namespace="mx-config-form-designer-property-form"
    @field-change="handleFieldChange"
  />
</template>
