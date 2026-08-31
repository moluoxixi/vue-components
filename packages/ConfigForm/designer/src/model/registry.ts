import type { Component } from 'vue'
import type {
  DesignerMaterialParentDefinition,
  DesignerMaterialSlotDefinition,
  DesignerPropertySetterDefinition,
  DesignerRegistry,
  DesignerResolvedDesignPolicy,
  DesignerRuntimeMaterialBinding,
  DesignerSourceMaterialBinding,
} from '../registry'
import type { LowCodeNode } from './types'
import { resolveDesignerDesignPolicy } from '../registry'
import { designerDocumentToConfigModel } from './transform'

export interface LowCodeEventSchema {
  name: string
  displayName: string
}

export interface LowCodeBindingSchema {
  name: string
  displayName: string
  valueProp: string
  trigger: string
}

export interface LowCodeLayoutSchema {
  span?: {
    min: number
    max: number
  }
}

export interface LowCodeComponentDefinition {
  component: string
  displayName: string
  category: string
  icon?: Component
  kind: 'component' | 'layout'
  props: DesignerPropertySetterDefinition[]
  events: LowCodeEventSchema[]
  bindings: LowCodeBindingSchema[]
  layout: LowCodeLayoutSchema
  slots: DesignerMaterialSlotDefinition[]
  allowedParents: DesignerMaterialParentDefinition[]
  defaults: Omit<LowCodeNode, 'id'>
  designPolicy: DesignerResolvedDesignPolicy
  runtime: DesignerRuntimeMaterialBinding
  source: DesignerSourceMaterialBinding
}

export interface LowCodeComponentRegistry {
  get: (component: string) => LowCodeComponentDefinition | undefined
  list: () => LowCodeComponentDefinition[]
  createNode: (component: string, context: { id: string, field?: string }) => LowCodeNode
  designer: DesignerRegistry
}

function definitionFor(
  registry: DesignerRegistry,
  component: string,
): LowCodeComponentDefinition {
  const material = registry.getMaterial(component)
  if (!material)
    throw new Error(`Unknown low-code component: ${component}`)
  if (!material.source)
    throw new Error(`Designer material "${component}" is missing its source binding.`)

  const designerNode = registry.createNode(component, {
    id: '__registry_default__',
    field: material.kind === 'field' ? '__registry_field__' : undefined,
  })
  const defaults = designerDocumentToConfigModel({
    version: 1,
    form: {},
    nodes: [designerNode],
  }).nodes[0]!
  const { id: _defaultId, ...nodeDefaults } = defaults
  const valueProp = material.runtime.valueProp ?? 'modelValue'
  const trigger = material.runtime.trigger ?? `update:${valueProp}`
  const events = new Map<string, LowCodeEventSchema>()
  if (material.kind === 'field')
    events.set(trigger, { name: trigger, displayName: 'Value change' })
  for (const event of material.events ?? [])
    events.set(event.name, { name: event.name, displayName: event.title })
  return {
    component: material.key,
    displayName: material.title,
    category: material.category,
    icon: material.icon,
    kind: material.kind === 'container' ? 'layout' : 'component',
    props: material.setters,
    events: [...events.values()],
    bindings: material.kind === 'field'
      ? [{ name: 'value', displayName: 'Value', valueProp, trigger }]
      : [],
    layout: { span: { min: 1, max: 24 } },
    slots: material.kind === 'container' ? material.slots : [],
    allowedParents: material.allowedParents?.map(parent => ({ ...parent })) ?? [],
    defaults: nodeDefaults,
    designPolicy: resolveDesignerDesignPolicy(material.designPolicy),
    runtime: material.runtime,
    source: structuredClone(material.source),
  }
}

export function createLowCodeComponentRegistry(
  designer: DesignerRegistry,
): LowCodeComponentRegistry {
  const definitions = designer.listMaterials().map(material => definitionFor(designer, material.key))
  const byComponent = new Map(definitions.map(definition => [definition.component, definition]))

  return {
    designer,
    get: component => byComponent.get(component),
    list: () => [...definitions],
    createNode(component, context) {
      const node = designer.createNode(component, context)
      return designerDocumentToConfigModel({ version: 1, form: {}, nodes: [node] }).nodes[0]!
    },
  }
}
