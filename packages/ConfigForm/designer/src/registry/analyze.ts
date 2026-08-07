import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../document'
import type { DesignerMaterialSlotDefinition, DesignerRegistry } from './types'
import { designerDiagnostic, walkDesignerNodes } from '../document'

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

export function analyzeDesignerDocument(
  document: DesignerDocument,
  registry: DesignerRegistry,
): DesignerDiagnostic[] {
  const diagnostics: DesignerDiagnostic[] = []

  walkDesignerNodes(document.nodes, ({ node, path }) => {
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

    if (node.kind === 'field')
      return

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
