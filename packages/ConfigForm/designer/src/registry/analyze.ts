import type { FieldNode, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerDiagnostic } from '../graph'
import type {
  DesignerDefaultValueKind,
  DesignerFieldMaterialDefinition,
  DesignerMaterialDefinition,
  DesignerMaterialSlotDefinition,
  DesignerPropertySetterDefinition,
  DesignerRegistry,
} from './types'
import {
  areDesignerJsonValuesEqual,
  designerDiagnostic,
  walkDesignGraph,
} from '../graph'

export interface AnalyzeDesignGraphOptions {
  includeDefaultDiagnostics?: boolean
  includeMaterialDiagnostics?: boolean
}

function readPath(node: object, path: string[]): unknown {
  let value: unknown = node
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

export function matchesDesignerDefaultValueKind(value: unknown, kind: DesignerDefaultValueKind): boolean {
  if (value === null)
    return true
  switch (kind) {
    case 'text':
    case 'date':
    case 'time': return typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'boolean': return typeof value === 'boolean'
    case 'select': return ['string', 'number', 'boolean'].includes(typeof value)
    case 'multiselect': return Array.isArray(value)
      && value.every(item => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
  }
}

export function resolveDesignerDefaultOptionValues(
  node: object,
  setter: DesignerPropertySetterDefinition,
): unknown[] | undefined {
  if (!setter.optionsPath)
    return undefined
  const source = setter.optionSourcePath ? readPath(node, setter.optionSourcePath) : undefined
  if (
    typeof source === 'object'
    && source !== null
    && !Array.isArray(source)
    && (source as Record<string, unknown>).kind !== 'static'
  ) {
    return undefined
  }

  const options = readPath(node, setter.optionsPath)
  if (!Array.isArray(options))
    return []
  return options.flatMap((option) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option) || !Object.hasOwn(option, 'value'))
      return []
    return [(option as Record<string, unknown>).value]
  })
}

function analyzeFieldDefault(
  node: FieldNode,
  material: DesignerFieldMaterialDefinition,
  path: Array<string | number>,
): DesignerDiagnostic[] {
  if (node.defaultValue === undefined)
    return []
  const setter = material.setters.find(candidate => candidate.key === 'defaultValue' && candidate.valueKind)
  if (!setter?.valueKind)
    return []

  const diagnostics: DesignerDiagnostic[] = []
  if (!matchesDesignerDefaultValueKind(node.defaultValue, setter.valueKind)) {
    diagnostics.push(designerDiagnostic(
      'DESIGNER_DEFAULT_KIND_INVALID',
      `Default value must match the ${setter.valueKind} field value kind`,
      [...path, 'defaultValue'],
      'error',
      node.id,
    ))
    return diagnostics
  }

  if (node.defaultValue === null)
    return diagnostics

  const values = resolveDesignerDefaultOptionValues(node, setter)
  if (values) {
    const defaults = setter.valueKind === 'multiselect' && Array.isArray(node.defaultValue)
      ? node.defaultValue
      : [node.defaultValue]
    if (defaults.some(value => !values.some(option => areDesignerJsonValuesEqual(option, value)))) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_DEFAULT_OPTION_UNKNOWN',
        'Default value is not present in the current options',
        [...path, 'defaultValue'],
        'error',
        node.id,
      ))
    }
  }
  return diagnostics
}

function validateSlotChild(
  child: PageNode,
  slot: DesignerMaterialSlotDefinition,
  path: Array<string | number>,
): DesignerDiagnostic[] {
  const diagnostics: DesignerDiagnostic[] = []
  if (slot.accepts && !slot.accepts.includes(child.kind)) {
    diagnostics.push(designerDiagnostic(
      'DESIGNER_SLOT_KIND_INVALID',
      `Slot ${slot.name} does not accept ${child.kind} nodes`,
      path,
      'error',
      child.id,
    ))
  }
  if (slot.materials && !slot.materials.includes(child.component)) {
    diagnostics.push(designerDiagnostic(
      'DESIGNER_SLOT_MATERIAL_INVALID',
      `Slot ${slot.name} does not accept component ${child.component}`,
      path,
      'error',
      child.id,
    ))
  }
  return diagnostics
}

export function isDesignerMaterialPlacementAllowed(
  material: DesignerMaterialDefinition,
  parentComponent?: string,
  slot?: string,
): boolean {
  if (!material.allowedParents || material.allowedParents.length === 0)
    return true
  if (!parentComponent || !slot)
    return false
  return material.allowedParents.some(parent => parent.material === parentComponent && parent.slot === slot)
}

export function analyzeDesignGraph(
  graph: PageGraph,
  registry: DesignerRegistry,
  options: AnalyzeDesignGraphOptions = {},
): DesignerDiagnostic[] {
  const diagnostics: DesignerDiagnostic[] = []
  const includeDefaultDiagnostics = options.includeDefaultDiagnostics ?? true
  const includeMaterialDiagnostics = options.includeMaterialDiagnostics ?? true

  walkDesignGraph(graph, ({ node, path, parent, slot }) => {
    const material = registry.getMaterial(node.component)
    if (!material) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_UNKNOWN',
        `Unknown designer component: ${node.component}`,
        [...path, 'component'],
        'error',
        node.id,
      ))
      return
    }
    if (material.kind !== node.kind) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_KIND_MISMATCH',
        `Component ${node.component} cannot render a ${node.kind} node`,
        [...path, 'component'],
        'error',
        node.id,
      ))
      return
    }
    if (!isDesignerMaterialPlacementAllowed(material, parent?.component, slot)) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_PARENT_INVALID',
        `Component ${node.component} is not allowed at this parent slot`,
        [...path, 'component'],
        'error',
        node.id,
      ))
      return
    }

    if (node.kind === 'field') {
      if (material.kind === 'field') {
        if (includeDefaultDiagnostics)
          diagnostics.push(...analyzeFieldDefault(node, material, path))
        if (includeMaterialDiagnostics)
          diagnostics.push(...(material.analyze?.(node, path) ?? []))
      }
      return
    }

    if (node.conditions?.required || node.conditions?.disabled || node.conditions?.readonly) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_LAYOUT_CONDITION_INVALID',
        'Layout nodes only support visible and hidden conditions',
        [...path, 'conditions'],
        'error',
        node.id,
      ))
    }

    if (material.kind !== 'layout')
      return
    if (includeMaterialDiagnostics)
      diagnostics.push(...(material.analyze?.(node, path) ?? []))
    const registeredSlots = new Map(material.slots.map(slotDefinition => [slotDefinition.name, slotDefinition]))
    for (const [slotName, items] of Object.entries(node.slots)) {
      const slotDefinition = registeredSlots.get(slotName)
      if (!slotDefinition) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_UNKNOWN',
          `Unknown slot ${slotName} on component ${material.key}`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
        continue
      }
      if (slotDefinition.min !== undefined && items.length < slotDefinition.min) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MIN_UNMET',
          `Slot ${slotName} requires at least ${slotDefinition.min} children`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
      }
      if (slotDefinition.max !== undefined && items.length > slotDefinition.max) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MAX_EXCEEDED',
          `Slot ${slotName} accepts at most ${slotDefinition.max} children`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
      }
      items.forEach((item, index) => {
        const child = graph.nodesById[item.nodeId]
        if (child)
          diagnostics.push(...validateSlotChild(child, slotDefinition, [...path, 'slots', slotName, index]))
      })
    }
    for (const slotDefinition of material.slots) {
      if (slotDefinition.min !== undefined
        && slotDefinition.min > 0
        && !Object.hasOwn(node.slots, slotDefinition.name)) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MIN_UNMET',
          `Slot ${slotDefinition.name} requires at least ${slotDefinition.min} children`,
          [...path, 'slots', slotDefinition.name],
          'error',
          node.id,
        ))
      }
    }
  })

  return diagnostics
}
