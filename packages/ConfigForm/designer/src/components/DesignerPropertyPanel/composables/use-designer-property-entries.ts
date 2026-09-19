import type { FormSettings, SurfaceNode } from '@moluoxixi/config-form-model'
import type { InspectorSectionId, InspectorSectionProjection } from '../../../inspector'
import type { DesignerPropertySetterDefinition, DesignerSetterOption } from '../../../registry'
import type { DesignerPropertyFormEntry, DesignerPropertyPanelEmits, DesignerPropertyPanelProps } from '../types'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from '@moluoxixi/config-form-core'
import { FORM_GAP_MAX_PX } from '@moluoxixi/config-form-model'
import { computed } from 'vue'
import { areDesignerJsonValuesEqual, findDesignNode } from '../../../graph'
import { resolveInspectorCapabilities, resolveInspectorGridFraction } from '../../../inspector'
import { useDesignerLocale } from '../../../locale'

type PropertyTab = InspectorSectionId

interface UseDesignerPropertyEntriesCallbacks {
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
  const isRootNode = computed(() => selectedNodes.value.length > 0
    && selectedNodes.value.every(node => findDesignNode(props.graph, node.id)?.parentId === null))
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
      .filter(setter => !['validation', 'validateOn'].includes(setter.path[0] ?? ''))
      .map(setter => localizeSetter(setter)),
  ].filter((setter, index, entries) => entries
    .findIndex(entry => entry.path.join('.') === setter.path.join('.')) === index))

  const validationSetters = computed<DesignerPropertySetterDefinition[]>(() => (
    selectedNodes.value.length > 0 && selectedNodes.value.every(node => node.kind === 'field')
      ? [
          { key: 'validation', label: locale.t('property.rules', 'Rules'), path: ['validation'], control: 'validation' },
          { key: 'validateOn', label: locale.t('validation.triggers', 'Validate on'), path: ['validateOn'], control: 'validateOn' },
        ]
      : []
  ))

  const selectedDiagnostics = computed(() => {
    if (selectedNodes.value.length === 0)
      return props.diagnostics
    const selectedIds = new Set(selectedNodes.value.map(node => node.id))
    return props.diagnostics.filter(diagnostic => !diagnostic.nodeId || selectedIds.has(diagnostic.nodeId))
  })

  function sectionLabel(section: PropertyTab): string {
    return section === 'properties'
      ? locale.t('property.properties', 'Properties')
      : locale.t('property.validation', 'Validation')
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

  function readNodePath(node: SurfaceNode | undefined, path: string[]): unknown {
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
  }))

  const formEntries = computed(() => formSetters.value.map(setter => ({
    setter,
    value: readFormValue(setter),
  })))

  return {
    commitForm,
    commitNodePath,
    formEntries,
    primaryMaterial,
    propertyEntries,
    propertyTabs,
    sectionReadonly,
    selectedDiagnostics,
    selectedNodes,
  }
}
