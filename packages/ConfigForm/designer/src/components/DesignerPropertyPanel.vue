<script setup lang="ts">
import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerFormSettings,
  DesignerNode,
} from '../document'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type {
  DesignerMaterialDefinition,
  DesignerPropertyControlRegistry,
  DesignerPropertySetterDefinition,
  DesignerSetterOption,
} from '../registry'
import { resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { computed, ref } from 'vue'
import { walkDesignerNodes } from '../document'
import { findDesignerNode } from '../history'
import { useDesignerLocale } from '../locale'
import DesignerPropertyForm from './DesignerPropertyForm.vue'
import DesignerResponsiveSettings from './DesignerResponsiveSettings.vue'

const props = defineProps<{
  document: DesignerDocument
  node?: DesignerNode
  material?: DesignerMaterialDefinition
  diagnostics: DesignerDiagnostic[]
  breakpoint?: ConfigFormBreakpoint
  validatorOptions?: string[]
  components?: ConfigFormComponentRegistry
  propertyControls?: DesignerPropertyControlRegistry
  readonly?: boolean
}>()

const emit = defineEmits<{
  updatePath: [nodeId: string, path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
}>()

type PropertyTab = 'properties' | 'validation' | 'conditions'
const activeTab = ref<PropertyTab>('properties')
const locale = useDesignerLocale()
const resolvedLayout = computed(() => resolveConfigFormLayout(
  props.document.form.columns,
  props.document.form.fieldSpan,
  props.document.form.responsive,
  props.breakpoint ?? 'desktop',
))
const fieldOptions = computed(() => {
  const fields: string[] = []
  walkDesignerNodes(props.document.nodes, ({ node }) => {
    if (node.kind === 'field')
      fields.push(node.field)
  })
  return fields
})
const isRootNode = computed(() => {
  if (!props.node)
    return false
  const location = findDesignerNode(props.document, props.node.id)
  return Boolean(location && location.parent === undefined)
})

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
    ...(isRootNode.value
      ? [{ key: 'span', label: locale.t('property.span', 'Span'), path: ['span'], control: 'number' as const, min: 1, max: 24, step: 1 }]
      : []),
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

function inheritedValue(setter: DesignerPropertySetterDefinition): unknown {
  return setter.key === 'span' && readPath(setter.path) === undefined
    ? resolvedLayout.value.fieldSpan
    : undefined
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
  {
    key: 'responsive',
    label: locale.t('property.responsive', 'Responsive layout'),
    path: ['responsive'],
    control: 'custom' as const,
    component: DesignerResponsiveSettings,
    componentProps: {
      columns: props.document.form.columns,
      fieldSpan: props.document.form.fieldSpan,
      showHeading: false,
    },
  },
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

const activePropertySetters = computed(() => activeTab.value === 'properties'
  ? propertySetters.value
  : activeTab.value === 'validation'
    ? validationSetters.value
    : conditionSetters.value)

const propertyEntries = computed(() => activePropertySetters.value.map(setter => ({
  setter,
  value: readPath(setter.path),
  inheritedValue: inheritedValue(setter),
})))

const formEntries = computed(() => formSetters.value.map(setter => ({
  setter,
  value: readFormValue(setter),
})))
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
        <DesignerPropertyForm
          :entries="propertyEntries"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          :node="node"
          :field-options="fieldOptions"
          :validator-options="validatorOptions"
          @commit="commitNodePath"
        />
      </div>
    </template>

    <template v-else>
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ locale.t('property.form', 'Form') }}</strong>
      </div>
      <div class="mx-config-form-designer__property-fields">
        <DesignerPropertyForm
          :entries="formEntries"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          @commit="commitForm"
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
