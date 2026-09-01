<script setup lang="ts">
import type { ConfigFormComponentRegistry, ConfigFormFieldChangePayload } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererField } from '@moluoxixi/config-form/renderer'
import type { PageNode } from '@moluoxixi/config-form-model'
import type {
  DesignerPropertyControlDefinition,
  DesignerPropertyControlRegistry,
  DesignerPropertySetterDefinition,
  DesignerSetterControl,
  DesignerSimpleSetterControl,
} from '../registry'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { computed, markRaw, shallowRef, toRaw, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import DesignerSetter from './DesignerSetter.vue'

export interface DesignerPropertyFormEntry {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
}

const props = defineProps<{
  entries: DesignerPropertyFormEntry[]
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  readonly?: boolean
  node?: PageNode
  fieldOptions?: string[]
  reactionIds?: string[]
  validatorOptions?: string[]
}>()

const emit = defineEmits<{
  commit: [value: unknown, setter: DesignerPropertySetterDefinition]
}>()

const locale = useDesignerLocale()
const model = shallowRef<Record<string, unknown>>({})
const simpleControls = new Set<DesignerSetterControl>(['text', 'textarea', 'number', 'boolean', 'select'])
const propertySetterComponent = markRaw(DesignerSetter)

function rawComponent<T extends DesignerPropertyControlDefinition['component']>(component: T): T {
  return typeof component === 'object' && component !== null
    ? markRaw(toRaw(component)) as T
    : component
}

function isSimpleControl(control: DesignerSetterControl): control is DesignerSimpleSetterControl {
  return simpleControls.has(control)
}

function fieldKey(entry: DesignerPropertyFormEntry, index: number): string {
  return `setter:${index}:${entry.setter.key}`
}

function controlFor(entry: DesignerPropertyFormEntry): DesignerPropertyControlDefinition | undefined {
  return isSimpleControl(entry.setter.control) && !entry.hint
    ? props.controls?.[entry.setter.control]
    : undefined
}

function fieldValue(entry: DesignerPropertyFormEntry): unknown {
  return controlFor(entry) && entry.value === undefined && entry.inheritedValue !== undefined
    ? entry.inheritedValue
    : entry.value
}

const projectedModel = computed<Record<string, unknown>>(() => Object.fromEntries(
  props.entries.map((entry, index) => [fieldKey(entry, index), fieldValue(entry)]),
))

watch(projectedModel, value => {
  model.value = value
}, { deep: true, immediate: true })

function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter')
    return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).blur()
}

function commitTextDraft(entry: DesignerPropertyFormEntry, index: number): void {
  const value = normalizeValue(entry.setter, model.value[fieldKey(entry, index)])
  const current = normalizeValue(entry.setter, entry.value)
  if (value !== invalidNumber && !Object.is(value, current))
    emit('commit', value, entry.setter)
}

function simpleField(
  entry: DesignerPropertyFormEntry,
  index: number,
  control: DesignerPropertyControlDefinition,
): ConfigFormRendererField<Record<string, unknown>> {
  const { setter } = entry
  const inheritedLabel = entry.value === undefined && entry.inheritedValue !== undefined
    ? locale.t('setter.inherited', 'Inherited')
    : undefined
  const componentProps: Record<string, unknown> = {
    ...control.props,
    'aria-description': inheritedLabel,
    'aria-label': setter.label,
    'class': [
      control.props?.class,
      'mx-config-form-designer__property-control',
      `is-${setter.control}`,
    ],
    'disabled': props.readonly,
    ...(setter.control === 'textarea' ? { rows: 3 } : {}),
    ...(setter.control === 'number'
      ? { min: setter.min, max: setter.max, step: setter.step }
      : {}),
    ...(setter.control === 'select' ? { options: setter.options ?? [] } : {}),
    ...(setter.control === 'text' ? { onKeydown: handleTextKeydown } : {}),
    ...(['text', 'textarea'].includes(setter.control)
      ? { onBlur: () => commitTextDraft(entry, index) }
      : {}),
  }

  return {
    field: fieldKey(entry, index),
    label: setter.label,
    component: rawComponent(control.component),
    valueProp: control.valueProp,
    trigger: control.trigger,
    blurTrigger: control.blurTrigger,
    getValueFromEvent: control.getValueFromEvent,
    props: componentProps,
    fieldAttrs: {
      class: [
        'mx-config-form-designer-property-form__field',
        'is-simple',
        `is-control-${setter.control}`,
      ],
      title: setter.label,
      ...(inheritedLabel ? { 'data-inherited-label': inheritedLabel } : {}),
    } as ConfigFormRendererField<Record<string, unknown>>['fieldAttrs'],
  }
}

function customField(
  entry: DesignerPropertyFormEntry,
  index: number,
): ConfigFormRendererField<Record<string, unknown>> {
  const setter = entry.setter.component
    ? { ...entry.setter, component: rawComponent(entry.setter.component) }
    : entry.setter
  return {
    field: fieldKey(entry, index),
    component: propertySetterComponent,
    valueProp: 'value',
    trigger: 'commit',
    props: {
      setter,
      hint: entry.hint,
      inheritedValue: entry.inheritedValue,
      readonly: props.readonly,
      node: props.node,
      fieldOptions: props.fieldOptions,
      reactionIds: props.reactionIds,
      validatorOptions: props.validatorOptions,
    },
    fieldAttrs: {
      class: 'mx-config-form-designer-property-form__field is-custom',
    },
  }
}

const fields = computed<ConfigFormRendererField<Record<string, unknown>>[]>(() => props.entries.map((entry, index) => {
  const control = controlFor(entry)
  return control ? simpleField(entry, index, control) : customField(entry, index)
}))

const entriesByField = computed(() => new Map(
  props.entries.map((entry, index) => [fieldKey(entry, index), entry]),
))

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
    return Math.min(
      setter.max ?? Number.POSITIVE_INFINITY,
      Math.max(setter.min ?? Number.NEGATIVE_INFINITY, numeric),
    )
  }

  return value
}

function handleFieldChange(payload: ConfigFormFieldChangePayload<Record<string, unknown>>): void {
  const entry = entriesByField.value.get(String(payload.field))
  if (!entry)
    return
  if (
    (entry.setter.control === 'text' || entry.setter.control === 'textarea')
    && controlFor(entry)
  )
    return
  const value = normalizeValue(entry.setter, payload.value)
  if (value !== invalidNumber)
    emit('commit', value, entry.setter)
}
</script>

<template>
  <ConfigFormRenderer
    v-model="model"
    :components="components"
    :fields="fields"
    :columns="1"
    :field-span="1"
    gap="13px"
    label-position="top"
    namespace="mx-config-form-designer-property-form"
    @field-change="handleFieldChange"
  />
</template>
