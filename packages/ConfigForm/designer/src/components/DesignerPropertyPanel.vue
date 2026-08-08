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
} from '../registry'
import { computed, ref } from 'vue'
import DesignerSetter from './DesignerSetter.vue'

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

const commonSetters = computed<DesignerPropertySetterDefinition[]>(() => {
  if (!props.node)
    return []
  return [
    ...(props.node.kind === 'field'
      ? [
          { key: 'field', label: 'Field', path: ['field'], control: 'text' as const },
          { key: 'label', label: 'Label', path: ['label'], control: 'text' as const },
        ]
      : []),
    { key: 'span', label: 'Span', path: ['span'], control: 'number' as const, min: 1, max: 12, step: 1 },
  ]
})

const propertySetters = computed(() => [
  ...commonSetters.value,
  ...(props.material?.setters.filter(setter => !['condition', 'validation'].includes(setter.control)) ?? []),
].filter((setter, index, entries) => entries.findIndex(entry => entry.path.join('.') === setter.path.join('.')) === index))

const conditionSetters = computed<DesignerPropertySetterDefinition[]>(() => {
  if (!props.node)
    return []
  const targets = props.node.kind === 'field'
    ? ['visible', 'hidden', 'required', 'disabled', 'readonly']
    : ['visible', 'hidden']
  return targets.map(target => ({
    key: `condition-${target}`,
    label: target[0]!.toUpperCase() + target.slice(1),
    path: ['conditions', target],
    control: 'condition',
  }))
})

const validationSetters = computed<DesignerPropertySetterDefinition[]>(() => props.node?.kind === 'field'
  ? [{ key: 'validation', label: 'Rules', path: ['validation'], control: 'validation' }]
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

function formSetter(
  key: keyof DesignerFormSettings,
  label: string,
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: Pick<DesignerPropertySetterDefinition, 'min' | 'max' | 'step'>,
): DesignerPropertySetterDefinition {
  return { key, label, path: [key], control, options, ...constraints }
}

const formSetters = [
  formSetter('inline', 'Inline', 'boolean'),
  formSetter('labelPosition', 'Label position', 'select', [
    { label: 'Left', value: 'left' },
    { label: 'Top', value: 'top' },
  ]),
  formSetter('columns', 'Columns', 'number', undefined, { min: 1, max: 12, step: 1 }),
  formSetter('gap', 'Gap', 'text'),
  formSetter('fieldSpan', 'Field span', 'number', undefined, { min: 1, max: 12, step: 1 }),
]

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
</script>

<template>
  <aside class="mx-config-form-designer__properties" aria-label="Properties">
    <template v-if="node">
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ node.kind === 'field' ? (node.label || node.field) : material?.title }}</strong>
        <code>{{ node.material }}</code>
      </div>
      <div class="mx-config-form-designer__tabs" role="tablist" aria-label="Property views">
        <button type="button" role="tab" :aria-selected="activeTab === 'properties'" @click="activeTab = 'properties'">Properties</button>
        <button v-if="node.kind === 'field'" type="button" role="tab" :aria-selected="activeTab === 'validation'" @click="activeTab = 'validation'">Validation</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'conditions'" @click="activeTab = 'conditions'">Conditions</button>
      </div>

      <div class="mx-config-form-designer__property-fields">
        <DesignerSetter
          v-for="setter in activeTab === 'properties' ? propertySetters : activeTab === 'validation' ? validationSetters : conditionSetters"
          :key="setter.key"
          :setter="setter"
          :value="readPath(setter.path)"
          :readonly="readonly"
          @commit="commitNodePath($event, setter)"
        />
      </div>
    </template>

    <template v-else>
      <div class="mx-config-form-designer__property-heading">
        <strong>Form</strong>
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
      </div>
    </template>

    <ul v-if="selectedDiagnostics.length" class="mx-config-form-designer__property-diagnostics" aria-label="Diagnostics">
      <li v-for="(diagnostic, index) in selectedDiagnostics" :key="`${diagnostic.code}-${index}`">
        {{ diagnostic.message }}
      </li>
    </ul>
  </aside>
</template>
