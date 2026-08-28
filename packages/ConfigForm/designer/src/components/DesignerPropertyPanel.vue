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
import type { LowCodeComponentDefinition, LowCodeNode, ModelOperation } from '../model'
import { resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { areDesignerJsonValuesEqual, cloneDesignerJsonValue, walkDesignerNodes } from '../document'
import { findDesignerNode } from '../history'
import { useDesignerLocale } from '../locale'
import DesignerPropertyForm from './DesignerPropertyForm.vue'
import DesignerResponsiveSettings from './DesignerResponsiveSettings.vue'

const props = defineProps<{
  document: DesignerDocument
  node?: DesignerNode
  nodes?: DesignerNode[]
  material?: DesignerMaterialDefinition
  modelNodes?: LowCodeNode[]
  componentDefinition?: LowCodeComponentDefinition
  diagnostics: DesignerDiagnostic[]
  breakpoint?: ConfigFormBreakpoint
  validatorOptions?: string[]
  components?: ConfigFormComponentRegistry
  propertyControls?: DesignerPropertyControlRegistry
  readonly?: boolean
}>()

const emit = defineEmits<{
  updatePath: [nodeId: string, path: string[], value: unknown]
  updatePaths: [nodeIds: string[], path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
  modelOperation: [operation: ModelOperation]
}>()

type PropertyTab = 'properties' | 'events' | 'bindings' | 'validation' | 'conditions' | 'reactions'
const activeTab = ref<PropertyTab>('properties')
const locale = useDesignerLocale()
const propertyPanelRef = ref<HTMLElement>()
const propertyTabsId = useId()
const propertyTabs = computed(() => [
  { id: 'properties' as const, label: locale.t('property.properties', 'Properties') },
  ...(props.node?.kind === 'field'
    ? [{ id: 'validation' as const, label: locale.t('property.validation', 'Validation') }]
    : []),
  ...(props.componentDefinition?.events.length
    ? [{ id: 'events' as const, label: locale.t('property.events', 'Events') }]
    : []),
  ...(props.componentDefinition?.bindings.length
    ? [{ id: 'bindings' as const, label: locale.t('property.bindings', 'Bindings') }]
    : []),
  { id: 'conditions' as const, label: locale.t('property.conditions', 'Conditions') },
  { id: 'reactions' as const, label: locale.t('property.reactions', 'Reactions') },
])
const selectedNodes = computed(() => props.nodes?.length ? props.nodes : props.node ? [props.node] : [])
const compatibleSelection = computed(() => selectedNodes.value.length <= 1
  || selectedNodes.value.every(node => node.material === props.node?.material && node.kind === props.node?.kind))
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
const reactionIds = computed(() => {
  const ids: string[] = []
  walkDesignerNodes(props.document.nodes, ({ node }) => {
    node.reactions?.forEach(reaction => ids.push(reaction.id))
  })
  return ids
})
const isRootNode = computed(() => {
  if (selectedNodes.value.length === 0)
    return false
  return selectedNodes.value.every((node) => {
    const location = findDesignerNode(props.document, node.id)
    return Boolean(location && location.parent === undefined)
  })
})

const commonSetters = computed<DesignerPropertySetterDefinition[]>(() => {
  if (!props.node)
    return []
  return [
    ...(props.node.kind === 'field' && selectedNodes.value.length === 1
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
  ...(compatibleSelection.value ? props.material?.setters
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
    }) ?? [] : []),
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

const reactionSetters = computed<DesignerPropertySetterDefinition[]>(() => props.node
  ? [{ key: 'reactions', label: locale.t('property.reactions', 'Reactions'), path: ['reactions'], control: 'reaction' }]
  : [])

const eventSetters = computed<DesignerPropertySetterDefinition[]>(() =>
  compatibleSelection.value
    ? props.componentDefinition?.events.map(event => ({
        key: event.name,
        label: event.displayName,
        path: ['events', event.name],
        control: 'text',
      })) ?? []
    : [])

const bindingSetters = computed<DesignerPropertySetterDefinition[]>(() =>
  compatibleSelection.value
    ? props.componentDefinition?.bindings.map(binding => ({
        key: binding.name,
        label: binding.displayName,
        path: ['bindings', binding.name],
        control: 'text',
      })) ?? []
    : [])

const selectedDiagnostics = computed(() => props.node
  ? props.diagnostics.filter(diagnostic => diagnostic.nodeId === props.node?.id)
  : props.diagnostics)

function readNodePath(node: DesignerNode | undefined, path: string[]): unknown {
  let value: unknown = node
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function readPath(path: string[]): unknown {
  const values = selectedNodes.value.map(node => readNodePath(node, path))
  return values.length > 1 && values.some(value => !areDesignerJsonValuesEqual(value, values[0]))
    ? undefined
    : values[0]
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
  const nodeIds = selectedNodes.value.map(node => node.id)
  if (nodeIds.length > 1)
    emit('updatePaths', nodeIds, setter.path, value)
  else if (nodeIds[0])
    emit('updatePath', nodeIds[0], setter.path, value)
}

function commitForm(value: unknown, setter: DesignerPropertySetterDefinition): void {
  emit('updateForm', { [setter.key]: value })
}

function commonModelValue(values: unknown[]): unknown {
  return values.length > 1 && values.some(value => !areDesignerJsonValuesEqual(value, values[0]))
    ? undefined
    : values[0]
}

function eventValue(name: string): unknown {
  return commonModelValue((props.modelNodes ?? []).map(node =>
    node.events[name]?.map(action => action.action).join(', ')))
}

function bindingValue(name: string): unknown {
  return commonModelValue((props.modelNodes ?? []).map(node => node.bindings[name]?.source))
}

function batchModelOperations(operations: ModelOperation[]): ModelOperation | undefined {
  if (operations.length === 0)
    return undefined
  return operations.length === 1 ? operations[0] : { type: 'batch', operations }
}

function commitEvent(value: unknown, setter: DesignerPropertySetterDefinition): void {
  const actions = typeof value === 'string'
    ? value.split(',').map(action => action.trim()).filter(Boolean).map(action => ({ action }))
    : []
  const operation = batchModelOperations((props.modelNodes ?? []).map((node) => {
    const events = cloneDesignerJsonValue(node.events) as LowCodeNode['events']
    if (actions.length > 0)
      events[setter.key] = actions
    else
      delete events[setter.key]
    return { type: 'updateEvents', nodeId: node.id, events }
  }))
  if (operation)
    emit('modelOperation', operation)
}

function commitBinding(value: unknown, setter: DesignerPropertySetterDefinition): void {
  const source = typeof value === 'string' ? value.trim() : ''
  const operation = batchModelOperations((props.modelNodes ?? []).map((node) => {
    const bindings = cloneDesignerJsonValue(node.bindings) as LowCodeNode['bindings']
    if (source)
      bindings[setter.key] = { source }
    else
      delete bindings[setter.key]
    return { type: 'updateBindings', nodeId: node.id, bindings }
  }))
  if (operation)
    emit('modelOperation', operation)
}

const propertyEntries = computed<Record<PropertyTab, Array<{
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue: unknown
}>>>(() => ({
  properties: propertySetters.value.map(toPropertyEntry),
  events: eventSetters.value.map(setter => ({ setter, value: eventValue(setter.key), inheritedValue: undefined })),
  bindings: bindingSetters.value.map(setter => ({ setter, value: bindingValue(setter.key), inheritedValue: undefined })),
  validation: validationSetters.value.map(toPropertyEntry),
  conditions: conditionSetters.value.map(toPropertyEntry),
  reactions: reactionSetters.value.map(toPropertyEntry),
}))

const formEntries = computed(() => formSetters.value.map(setter => ({
  setter,
  value: readFormValue(setter),
})))

watch(() => props.node?.kind, () => {
  if (!propertyTabs.value.some(tab => tab.id === activeTab.value))
    activeTab.value = 'properties'
})

function propertyTabId(tab: PropertyTab): string {
  return `${propertyTabsId}-tab-${tab}`
}

function propertyTabPanelId(tab: PropertyTab): string {
  return `${propertyTabsId}-panel-${tab}`
}

function toPropertyEntry(setter: DesignerPropertySetterDefinition): {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue: unknown
} {
  return {
    setter,
    value: readPath(setter.path),
    inheritedValue: inheritedValue(setter),
  }
}

function selectPropertyTab(tab: PropertyTab): void {
  activeTab.value = tab
}

function handlePropertyTabKeydown(event: KeyboardEvent, tab: PropertyTab): void {
  const index = propertyTabs.value.findIndex(item => item.id === tab)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % propertyTabs.value.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + propertyTabs.value.length) % propertyTabs.value.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = propertyTabs.value.length - 1
  else
    return
  event.preventDefault()
  const nextTab = propertyTabs.value[nextIndex]!.id
  selectPropertyTab(nextTab)
  void nextTick(() => propertyPanelRef.value
    ?.querySelector<HTMLButtonElement>(`[data-property-tab="${nextTab}"]`)
    ?.focus())
}
</script>

<template>
  <aside ref="propertyPanelRef" class="mx-config-form-designer__properties" :aria-label="locale.t('property.properties', 'Properties')">
    <template v-if="node">
      <div class="mx-config-form-designer__property-heading">
        <strong>{{ selectedNodes.length > 1 ? `${selectedNodes.length} selected` : node.kind === 'field' ? (node.label || node.field) : material && locale.materialTitle(material) }}</strong>
        <code>{{ compatibleSelection ? node.material : 'Mixed components' }}</code>
      </div>
      <div class="mx-config-form-designer__tabs" role="tablist" :aria-label="locale.t('property.views', 'Property views')">
        <button
          v-for="tab in propertyTabs"
          :id="propertyTabId(tab.id)"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-controls="propertyTabPanelId(tab.id)"
          :aria-selected="activeTab === tab.id"
          :data-property-tab="tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="selectPropertyTab(tab.id)"
          @keydown="handlePropertyTabKeydown($event, tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-for="tab in propertyTabs"
        :id="propertyTabPanelId(tab.id)"
        :key="tab.id"
        class="mx-config-form-designer__property-fields"
        role="tabpanel"
        :aria-labelledby="propertyTabId(tab.id)"
        :hidden="activeTab !== tab.id"
        :inert="activeTab !== tab.id ? true : undefined"
        :tabindex="activeTab === tab.id ? 0 : -1"
      >
        <DesignerPropertyForm
          v-if="tab.id === 'events'"
          :entries="propertyEntries.events"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          @commit="commitEvent"
        />
        <DesignerPropertyForm
          v-else-if="tab.id === 'bindings'"
          :entries="propertyEntries.bindings"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          @commit="commitBinding"
        />
        <DesignerPropertyForm
          v-else
          :entries="propertyEntries[tab.id]"
          :components="components"
          :controls="propertyControls"
          :readonly="readonly"
          :node="node"
          :field-options="fieldOptions"
          :reaction-ids="reactionIds"
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
