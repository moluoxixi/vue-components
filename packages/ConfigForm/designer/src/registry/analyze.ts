import type { DesignerDiagnostic, DesignerDocument, DesignerFieldNode, DesignerNode } from '../document'
import type {
  DesignerDefaultValueKind,
  DesignerFieldMaterialDefinition,
  DesignerMaterialDefinition,
  DesignerMaterialSlotDefinition,
  DesignerPropertySetterDefinition,
  DesignerRegistry,
} from './types'
import { areDesignerJsonValuesEqual, designerDiagnostic, walkDesignerNodes } from '../document'

export interface AnalyzeDesignerDocumentOptions {
  includeDefaultDiagnostics?: boolean
  includeMaterialDiagnostics?: boolean
}

function readPath(node: DesignerNode, path: string[]): unknown {
  let value: unknown = node
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function matchesDefaultKind(value: unknown, kind: DesignerDefaultValueKind): boolean {
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

function optionValues(node: DesignerFieldNode, setter: DesignerPropertySetterDefinition): unknown[] | undefined {
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
  node: DesignerFieldNode,
  material: DesignerFieldMaterialDefinition,
  path: (string | number)[],
): DesignerDiagnostic[] {
  if (node.defaultValue === undefined)
    return []
  const setter = material.setters.find(candidate => candidate.key === 'defaultValue' && candidate.valueKind)
  if (!setter?.valueKind)
    return []

  const diagnostics: DesignerDiagnostic[] = []
  if (!matchesDefaultKind(node.defaultValue, setter.valueKind)) {
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

  const values = optionValues(node, setter)
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
  child: DesignerNode,
  slot: DesignerMaterialSlotDefinition,
  path: (string | number)[],
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
  if (slot.materials && !slot.materials.includes(child.material)) {
    diagnostics.push(designerDiagnostic(
      'DESIGNER_SLOT_MATERIAL_INVALID',
      `Slot ${slot.name} does not accept material ${child.material}`,
      path,
      'error',
      child.id,
    ))
  }
  return diagnostics
}

export function isDesignerMaterialPlacementAllowed(
  material: DesignerMaterialDefinition,
  parentMaterial?: string,
  slot?: string,
): boolean {
  if (!material.allowedParents || material.allowedParents.length === 0)
    return true
  if (!parentMaterial || !slot)
    return false
  return material.allowedParents.some(parent => parent.material === parentMaterial && parent.slot === slot)
}

export function analyzeDesignerDocument(
  document: DesignerDocument,
  registry: DesignerRegistry,
  options: AnalyzeDesignerDocumentOptions = {},
): DesignerDiagnostic[] {
  const diagnostics: DesignerDiagnostic[] = []
  const includeDefaultDiagnostics = options.includeDefaultDiagnostics ?? true
  const includeMaterialDiagnostics = options.includeMaterialDiagnostics ?? true

  walkDesignerNodes(document.nodes, ({ node, path, parent, slot }) => {
    const material = registry.getMaterial(node.material)
    if (!material) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_UNKNOWN',
        `Unknown designer material: ${node.material}`,
        [...path, 'material'],
        'error',
        node.id,
      ))
      return
    }
    if (material.kind !== node.kind) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_KIND_MISMATCH',
        `Material ${node.material} cannot render a ${node.kind} node`,
        [...path, 'material'],
        'error',
        node.id,
      ))
      return
    }
    if (!isDesignerMaterialPlacementAllowed(material, parent?.material, slot)) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_MATERIAL_PARENT_INVALID',
        `Material ${node.material} is not allowed at this parent slot`,
        [...path, 'material'],
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
        'DESIGNER_CONTAINER_CONDITION_INVALID',
        'Container nodes only support visible and hidden conditions',
        [...path, 'conditions'],
        'error',
        node.id,
      ))
    }

    if (material.kind !== 'container')
      return
    if (includeMaterialDiagnostics)
      diagnostics.push(...(material.analyze?.(node, path) ?? []))
    const slots = new Map(material.slots.map(slot => [slot.name, slot]))
    for (const [slotName, children] of Object.entries(node.slots)) {
      const slot = slots.get(slotName)
      if (!slot) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_UNKNOWN',
          `Unknown slot ${slotName} on material ${material.key}`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
        continue
      }
      if (slot.min !== undefined && children.length < slot.min) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MIN_UNMET',
          `Slot ${slotName} requires at least ${slot.min} children`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
      }
      if (slot.max !== undefined && children.length > slot.max) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MAX_EXCEEDED',
          `Slot ${slotName} accepts at most ${slot.max} children`,
          [...path, 'slots', slotName],
          'error',
          node.id,
        ))
      }
      children.forEach((child, index) => {
        diagnostics.push(...validateSlotChild(child, slot, [...path, 'slots', slotName, index]))
      })
    }
    for (const slot of material.slots) {
      if (slot.min !== undefined && slot.min > 0 && !Object.hasOwn(node.slots, slot.name)) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_SLOT_MIN_UNMET',
          `Slot ${slot.name} requires at least ${slot.min} children`,
          [...path, 'slots', slot.name],
          'error',
          node.id,
        ))
      }
    }
  })

  return diagnostics
}
