<script setup lang="ts">
import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerFormSettings,
  DesignerNode,
} from '../document'
import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
  DesignerSetterOption,
} from '../registry'
import { computed, ref } from 'vue'
import { useDesignerLocale } from '../locale'
import DesignerSetter from './DesignerSetter.vue'
import DesignerResponsiveSettings from './DesignerResponsiveSettings.vue'

const props = defineProps<{
  document: DesignerDocument
  node?: DesignerNode
  material?: DesignerMaterialDefinition
  diagnostics: DesignerDiagnostic[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  updatePath: [nodeId: string, path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
}>()

type PropertyTab = 'properties' | 'validation' | 'conditions'
const activeTab = ref<PropertyTab>('properties')
const locale = useDesignerLocale()

const commonSetters = computed<DesignerPropertySetterDefinition[]>(() => {
  if (!props.node)
    return []
  return [
    ...(props.node.kind === 'field'
      ? [
          { key: 'field', label: locale.t('property.field', 'Field'), path: ['field'], control: 'text' as const },
          { key: 'label', label: locale.t('property.label', 'Label'), path: ['label'], control: 'text' as const },
        ]
      : []),
    { key: 'span', label: locale.t('property.span', 'Span'), path: ['span'], control: 'number' as const, min: 1, max: 24, step: 1 },
  ]
})

const propertySetters = computed(() => [
  ...commonSetters.value,
  ...(props.material?.setters
    .filter(setter => !['condition', 'validation'].includes(setter.control))
    .map(setter => {
      const options = resolveSetterOptions(setter)
      return {
        ...setter,
        label: locale.materialSetterLabel(props.material!, setter.key, setter.label),
        options: options?.map(option => ({
          ...option,
          label: locale.materialSetterOptionLabel(props.material!, setter.key, option.value, option.label),
        })),
      }
    }) ?? []),
].filter((setter, index, entries) => entries.findIndex(entry => entry.path.join('.') === setter.path.join('.')) === index))

const conditionSetters = computed<DesignerPropertySetterDefinition[]>(() => {
  if (!props.node)
    return []
  const targets = props.node.kind === 'field'
    ? ['visible', 'hidden', 'required', 'disabled', 'readonly']
    : ['visible', 'hidden']
  return targets.map(target => ({
    key: `condition-${target}`,
    label: locale.t(`condition.target.${target}`, target[0]!.toUpperCase() + target.slice(1)),
    path: ['conditions', target],
    control: 'condition',
  }))
})

const validationSetters = computed<DesignerPropertySetterDefinition[]>(() => props.node?.kind === 'field'
  ? [{ key: 'validation', label: locale.t('property.rules', 'Rules'), path: ['validation'], control: 'validation' }]
  : [])

const selectedDiagnostics = computed(() => props.node
  ? props.diagnostics.filter(diagnostic => diagnostic.nodeId === props.node?.id)
  : props.diagnostics)

function readPath(path: string[]): unknown {
  let value: unknown = props.node
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function resolveSetterOptions(setter: DesignerPropertySetterDefinition): DesignerSetterOption[] | undefined {
  if (!setter.optionsPath)
    return setter.options

  const value = readPath(setter.optionsPath)
  if (!Array.isArray(value))
    return []

  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option))
      return []
    const record = option as Record<string, unknown>
    const value = record.value
    if (
      typeof record.label !== 'string'
      || !Object.hasOwn(record, 'value')
      || !['string', 'number', 'boolean'].includes(typeof value)
      || (typeof value === 'number' && !Number.isFinite(value))
      || (setter.valueKind === 'multiselect' && typeof value === 'boolean')
    )
      return []
    return [{ label: record.label, value: value as string | number | boolean }]
  })
}

function formSetter(
  key: keyof DesignerFormSettings,
  label: string,
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: Pick<DesignerPropertySetterDefinition, 'min' | 'max' | 'step'>,
): DesignerPropertySetterDefinition {
  return { key, label, path: [key], control, options, ...constraints }
}

const formSetters = computed(() => [
  formSetter('readonly', locale.t('property.readonly', 'Readonly'), 'boolean'),
  formSetter('inline', locale.t('property.inline', 'Inline'), 'boolean'),
  formSetter('labelPosition', locale.t('property.labelPosition', 'Label position'), 'select', [
    { label: locale.t('option.left', 'Left'), value: 'left' },
    { label: locale.t('option.top', 'Top'), value: 'top' },
  ]),
  formSetter('columns', locale.t('property.columns', 'Columns'), 'number', undefined, { min: 1, max: 24, step: 1 }),
  formSetter('gap', locale.t('property.gap', 'Gap'), 'text'),
  formSetter('fieldSpan', locale.t('property.fieldSpan', 'Field span'), 'number', undefined, { min: 1, max: 24, step: 1 }),
])

function readFormValue(setter: DesignerPropertySetterDefinition): unknown {
  return props.document.form[setter.key as keyof DesignerFormSettings]
}

function commitNodePath(value: unknown, setter: DesignerPropertySetterDefinition): void {
  if (props.node)
    emit('updatePath', props.node.id, setter.path, value)
}

function commitForm(value: unknown, setter: DesignerPropertySetterDefinition): void {
  emit('updateForm', { [setter.key]: value })
}

function commitResponsive(value: DesignerFormSettings['responsive']): void {
  emit('updateForm', { responsive: value })
}
</script>

<template>
  <aside class="mx-config-form-designer__properties" :aria-label="locale.t('property.properties', 'Properties')">
    <template v-if="node">
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ node.kind === 'field' ? (node.label || node.field) : material && locale.materialTitle(material) }}</strong>
        <code>{{ node.material }}</code>
      </div>
      <div class="mx-config-form-designer__tabs" role="tablist" :aria-label="locale.t('property.views', 'Property views')">
        <button type="button" role="tab" :aria-selected="activeTab === 'properties'" @click="activeTab = 'properties'">{{ locale.t('property.properties', 'Properties') }}</button>
        <button v-if="node.kind === 'field'" type="button" role="tab" :aria-selected="activeTab === 'validation'" @click="activeTab = 'validation'">{{ locale.t('property.validation', 'Validation') }}</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'conditions'" @click="activeTab = 'conditions'">{{ locale.t('property.conditions', 'Conditions') }}</button>
      </div>

      <div class="mx-config-form-designer__property-fields">
        <DesignerSetter
          v-for="setter in activeTab === 'properties' ? propertySetters : activeTab === 'validation' ? validationSetters : conditionSetters"
          :key="setter.key"
          :setter="setter"
          :value="readPath(setter.path)"
          :readonly="readonly"
          :node="node"
          @commit="commitNodePath($event, setter)"
        />
      </div>
    </template>

    <template v-else>
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ locale.t('property.form', 'Form') }}</strong>
      </div>
      <div class="mx-config-form-designer__property-fields">
        <DesignerSetter
          v-for="setter in formSetters"
          :key="setter.key"
          :setter="setter"
          :value="readFormValue(setter)"
          :readonly="readonly"
          @commit="commitForm($event, setter)"
        />
        <DesignerResponsiveSettings
          :form="document.form"
          :readonly="readonly"
          @commit="commitResponsive"
        />
      </div>
    </template>

    <ul v-if="selectedDiagnostics.length" class="mx-config-form-designer__property-diagnostics" :aria-label="locale.t('property.diagnostics', 'Diagnostics')">
      <li v-for="(diagnostic, index) in selectedDiagnostics" :key="`${diagnostic.code}-${index}`">
        {{ diagnostic.message }}
      </li>
    </ul>
  </aside>
</template>
