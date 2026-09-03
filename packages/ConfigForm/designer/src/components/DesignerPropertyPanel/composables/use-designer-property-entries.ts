import type { FormSettings, PageNode } from '@moluoxixi/config-form-model'
import type { InspectorSectionId, InspectorSectionProjection, InspectorStaleConfigItem } from '../../../inspector'
import type { DesignerPropertySetterDefinition, DesignerSetterOption } from '../../../registry'
import type { DesignerPropertyFormEntry, DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from '../types'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from '@moluoxixi/config-form'
import { FORM_GAP_MAX_PX } from '@moluoxixi/config-form-model'
import { computed } from 'vue'
import { areDesignerJsonValuesEqual, findDesignNode, walkDesignGraph } from '../../../graph'
import { resolveInspectorCapabilities, resolveInspectorGridFraction } from '../../../inspector'
import { useDesignerLocale } from '../../../locale'

type PropertyTab = InspectorSectionId

interface UseDesignerPropertyEntriesCallbacks {
  onConfigureEvent: (...args: DesignerPropertyPanelEmits['configureEvent']) => void
  onRemoveStoredConfig: (...args: DesignerPropertyPanelEmits['removeStoredConfig']) => void
  onUpdateForm: (...args: DesignerPropertyPanelEmits['updateForm']) => void
  onUpdatePath: (...args: DesignerPropertyPanelEmits['updatePath']) => void
  onUpdatePaths: (...args: DesignerPropertyPanelEmits['updatePaths']) => void
}

export function useDesignerPropertyEntries(
  props: Readonly<DesignerPropertyPanelProps>,
  callbacks: UseDesignerPropertyEntriesCallbacks,
) {
  const locale = useDesignerLocale()
  const selectedNodes = computed(() => props.nodes?.length ? props.nodes : props.node ? [props.node] : [])
  const capabilityInputs = computed(() => selectedNodes.value.map(node => ({
    node,
    material: node.id === props.node?.id && props.material
      ? props.material
      : props.getMaterial?.(node.component),
    contract: node.id === props.node?.id && props.componentDefinition
      ? props.componentDefinition
      : props.getComponentDefinition?.(node.component),
  })))
  const projection = computed(() => resolveInspectorCapabilities(capabilityInputs.value))
  const primaryMaterial = computed(() => capabilityInputs.value[0]?.material)
  const propertyTabs = computed(() => projection.value.sections.map(section => ({
    ...section,
    label: sectionLabel(section.id),
  })))
  const resolvedLayout = computed(() => resolveConfigFormLayout(
    props.graph.form.columns,
    props.graph.form.fieldSpan,
    props.graph.form.responsive,
    props.breakpoint ?? 'desktop',
  ))
  const fieldOptions = computed(() => {
    const fields: string[] = []
    walkDesignGraph(props.graph, ({ node }) => {
      if (node.kind === 'field')
        fields.push(node.field)
    })
    return fields
  })
  const reactionIds = computed(() => {
    const ids: string[] = []
    walkDesignGraph(props.graph, ({ node }) => {
      node.reactions?.forEach(reaction => ids.push(reaction.id))
    })
    return ids
  })
  const isRootNode = computed(() => {
    if (selectedNodes.value.length === 0)
      return false
    return selectedNodes.value.every(node => findDesignNode(props.graph, node.id)?.parentId === null)
  })
  const spanFractionHint = computed(() => {
    if (!isRootNode.value)
      return undefined
    const spans = selectedNodes.value.map((node) => {
      const placementSpan = findDesignNode(props.graph, node.id)?.placement.span
      const numericSpan = typeof placementSpan === 'number' ? placementSpan : undefined
      return resolveConfigFormNodeSpan(numericSpan, resolvedLayout.value)
    })
    if (spans.length === 0 || spans.some(span => span !== spans[0]))
      return locale.t('property.mixedWidths', 'Mixed widths')
    return resolveInspectorGridFraction(spans[0]!, resolvedLayout.value.columns).label
  })
  const basePropertySetters = computed<DesignerPropertySetterDefinition[]>(() => {
    if (!props.node || !sectionEditable('properties'))
      return []
    return [
      ...(props.node.kind === 'field' && selectedNodes.value.length === 1
        ? [
            { key: 'field', label: locale.t('property.field', 'Field'), path: ['field'], control: 'text' as const },
            { key: 'label', label: locale.t('property.label', 'Label'), path: ['label'], control: 'text' as const },
          ]
        : []),
      ...(isRootNode.value
        ? [{
            key: 'span',
            label: locale.t('property.span', 'Span'),
            path: ['span'],
            control: 'number' as const,
            min: 1,
            max: resolvedLayout.value.columns,
            step: 1,
          }]
        : []),
    ]
  })

  const propertySetters = computed(() => [
    ...basePropertySetters.value,
    ...projection.value.commonSetters
      .filter(setter => !['condition', 'validation'].includes(setter.control))
      .map(setter => localizeSetter(setter)),
  ].filter((setter, index, entries) => entries
    .findIndex(entry => entry.path.join('.') === setter.path.join('.')) === index))

  const conditionSetters = computed<DesignerPropertySetterDefinition[]>(() => projection.value.commonConditionTargets
    .map(target => ({
      key: `condition-${target}`,
      label: locale.t(`condition.target.${target}`, target[0]!.toUpperCase() + target.slice(1)),
      path: ['conditions', target],
      control: 'condition',
    })))

  const validationSetters = computed<DesignerPropertySetterDefinition[]>(() => props.node?.kind === 'field'
    ? [{ key: 'validation', label: locale.t('property.rules', 'Rules'), path: ['validation'], control: 'validation' }]
    : [])

  const reactionSetters = computed<DesignerPropertySetterDefinition[]>(() => props.node && selectedNodes.value.length === 1
    ? [{ key: 'reactions', label: locale.t('property.reactions', 'Reactions'), path: ['reactions'], control: 'reaction' }]
    : [])

  const bindingSetters = computed<DesignerPropertySetterDefinition[]>(() => projection.value.commonBindings.map(binding => ({
    key: binding.name,
    label: binding.name,
    path: ['bindings', binding.name],
    control: 'text',
  })))

  const selectedDiagnostics = computed(() => {
    if (selectedNodes.value.length === 0)
      return props.diagnostics
    const selectedIds = new Set(selectedNodes.value.map(node => node.id))
    return props.diagnostics.filter(diagnostic => !diagnostic.nodeId || selectedIds.has(diagnostic.nodeId))
  })

  function sectionLabel(section: PropertyTab): string {
    const fallbacks: Record<PropertyTab, string> = {
      properties: 'Properties',
      validation: 'Validation',
      events: 'Events',
      bindings: 'Bindings',
      conditions: 'Conditions',
      reactions: 'Reactions',
    }
    return locale.t(`property.${section}`, fallbacks[section])
  }

  function sectionProjection(section: PropertyTab): InspectorSectionProjection | undefined {
    return projection.value.sections.find(candidate => candidate.id === section)
  }

  function sectionEditable(section: PropertyTab): boolean {
    return !props.readonly && sectionProjection(section)?.editable === true
  }

  function sectionReadonly(section: PropertyTab): boolean {
    return !sectionEditable(section)
  }

  function staleItemsFor(section: PropertyTab): InspectorStaleConfigItem[] {
    return projection.value.staleItems.filter(item => item.section === section)
  }

  function staleKindLabel(item: InspectorStaleConfigItem): string {
    const labels: Record<InspectorStaleConfigItem['kind'], [string, string]> = {
      'event-unknown': ['property.stale.eventUnknown', 'Unknown event'],
      'binding-unknown': ['property.stale.bindingUnknown', 'Unknown binding'],
      'condition-inapplicable': ['property.stale.conditionInapplicable', 'Inapplicable condition'],
      'selection-incompatible': ['property.stale.selectionIncompatible', 'Not editable for this selection'],
      'validation-incompatible': ['property.stale.validationIncompatible', 'Validation cannot be edited safely'],
    }
    const [key, fallback] = labels[item.kind]
    return locale.t(key, fallback)
  }

  function staleReason(item: InspectorStaleConfigItem): string {
    if (item.reason === 'not-declared')
      return locale.t('property.stale.notDeclared', 'The current component contract does not declare this key.')
    if (item.reason === 'not-applicable')
      return locale.t('property.stale.notApplicable', 'This configuration does not apply to the current node kind.')
    if (item.reason === 'metadata-missing')
      return locale.t('property.stale.metadataMissing', 'Matching material and component contract metadata is unavailable.')
    return locale.t('property.stale.notCommon', 'This configuration cannot be edited safely across the current selection.')
  }

  function removeStaleItem(item: InspectorStaleConfigItem): void {
    if (props.readonly || !item.removal)
      return
    callbacks.onRemoveStoredConfig(item.nodeId, item.removal.path)
  }

  function staleNodeLabel(item: InspectorStaleConfigItem): string {
    const node = props.graph.nodesById[item.nodeId]
    if (node?.kind === 'field')
      return node.label || node.field
    return primaryMaterial.value && primaryMaterial.value.key === item.nodeComponent
      ? locale.materialTitle(primaryMaterial.value)
      : item.nodeComponent
  }

  function formatStaleValue(value: unknown): string {
    const formatted = JSON.stringify(value, null, 2)
    return formatted === undefined ? String(value) : formatted
  }

  function readNodePath(node: PageNode | undefined, path: string[]): unknown {
    if (node && path.length === 1 && path[0] === 'span')
      return findDesignNode(props.graph, node.id)?.placement.span
    let value: unknown = node
    for (const segment of path) {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        return undefined
      value = (value as Record<string, unknown>)[segment]
    }
    return value
  }

  function resolveMaterialEventTitle(eventName: string): string {
    return primaryMaterial.value?.events?.find(candidate => candidate.name === eventName)?.title ?? eventName
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
      const optionValue = record.value
      if (typeof record.label !== 'string'
        || !Object.hasOwn(record, 'value')
        || !['string', 'number', 'boolean'].includes(typeof optionValue)
        || (typeof optionValue === 'number' && !Number.isFinite(optionValue))
        || (setter.valueKind === 'multiselect' && typeof optionValue === 'boolean')) {
        return []
      }
      return [{ label: record.label, value: optionValue as string | number | boolean }]
    })
  }

  function localizeSetter(setter: DesignerPropertySetterDefinition): DesignerPropertySetterDefinition {
    const material = primaryMaterial.value
    if (!material)
      return setter
    const options = resolveSetterOptions(setter)
    return {
      ...setter,
      label: locale.materialSetterLabel(material, setter.key, setter.label),
      options: options?.map(option => ({
        ...option,
        label: locale.materialSetterOptionLabel(material, setter.key, option.value, option.label),
      })),
    }
  }

  function formSetter(
    key: keyof FormSettings,
    label: string,
    control: DesignerPropertySetterDefinition['control'],
    options?: DesignerPropertySetterDefinition['options'],
    constraints?: Pick<DesignerPropertySetterDefinition, 'integer' | 'min' | 'max' | 'step' | 'unit'>,
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
    formSetter('gap', `${locale.t('property.gap', 'Gap')} (px)`, 'number', undefined, {
      integer: true,
      min: 0,
      max: FORM_GAP_MAX_PX,
      step: 1,
      unit: 'px',
    }),
  ])

  function readFormValue(setter: DesignerPropertySetterDefinition): unknown {
    return props.graph.form[setter.key as keyof FormSettings]
  }

  function commitNodePath(value: unknown, setter: DesignerPropertySetterDefinition): void {
    const nodeIds = selectedNodes.value.map(node => node.id)
    if (nodeIds.length > 1)
      callbacks.onUpdatePaths(nodeIds, setter.path, value)
    else if (nodeIds[0])
      callbacks.onUpdatePath(nodeIds[0], setter.path, value)
  }

  function commitForm(value: unknown, setter: DesignerPropertySetterDefinition): void {
    callbacks.onUpdateForm({ [setter.key]: value })
  }

  function commonModelValue(values: unknown[]): unknown {
    return values.length > 1 && values.some(value => !areDesignerJsonValuesEqual(value, values[0]))
      ? undefined
      : values[0]
  }

  function bindingValue(name: string): unknown {
    return commonModelValue(selectedNodes.value.map(node => node.bindings[name]?.source))
  }

  function configureEvent(eventName: string): void {
    if (props.node)
      callbacks.onConfigureEvent({ nodeId: props.node.id, eventName })
  }

  function commitBinding(value: unknown, setter: DesignerPropertySetterDefinition): void {
    const source = typeof value === 'string' ? value.trim() : ''
    const nodeIds = selectedNodes.value.map(node => node.id)
    if (nodeIds.length > 1)
      callbacks.onUpdatePaths(nodeIds, ['bindings', setter.key], source ? { source } : undefined)
    else if (nodeIds[0])
      callbacks.onUpdatePath(nodeIds[0], ['bindings', setter.key], source ? { source } : undefined)
  }

  function toPropertyEntry(setter: DesignerPropertySetterDefinition): DesignerPropertyFormEntry {
    return {
      setter,
      value: readPath(setter.path),
      inheritedValue: inheritedValue(setter),
      ...(setter.key === 'span' && spanFractionHint.value ? { hint: spanFractionHint.value } : {}),
    }
  }

  const propertyEntries = computed<Record<PropertyTab, DesignerPropertyFormEntry[]>>(() => ({
    properties: propertySetters.value.map(toPropertyEntry),
    validation: validationSetters.value.map(toPropertyEntry),
    events: [],
    bindings: bindingSetters.value.map(setter => ({ setter, value: bindingValue(setter.key), inheritedValue: undefined })),
    conditions: conditionSetters.value.map(toPropertyEntry),
    reactions: reactionSetters.value.map(toPropertyEntry),
  }))

  const formEntries = computed(() => formSetters.value.map(setter => ({
    setter,
    value: readFormValue(setter),
  })))

  return {
    commitBinding,
    commitForm,
    commitNodePath,
    configureEvent,
    fieldOptions,
    formEntries,
    formatStaleValue,
    primaryMaterial,
    projection,
    propertyEntries,
    propertyTabs,
    reactionIds,
    removeStaleItem,
    resolveMaterialEventTitle,
    sectionReadonly,
    selectedDiagnostics,
    selectedNodes,
    staleItemsFor,
    staleKindLabel,
    staleNodeLabel,
    staleReason,
  }
}
