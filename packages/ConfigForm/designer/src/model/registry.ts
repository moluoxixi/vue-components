import type { Component } from 'vue'
import type {
  DesignerMaterialSlotDefinition,
  DesignerPropertySetterDefinition,
  DesignerRegistry,
  DesignerRuntimeMaterialBinding,
} from '../registry'
import type { LowCodeNode } from './types'
import { designerDocumentToConfigModel } from './transform'

const PORTABLE_SOURCE_COMPONENTS: Readonly<Record<string, string>> = Object.freeze({
  'auto-complete': 'text',
  'checkbox': 'boolean',
  'date': 'text',
  'input': 'text',
  'input-number': 'number',
  'password': 'text',
  'radio': 'select',
  'rate': 'number',
  'search': 'text',
  'select': 'select',
  'slider': 'number',
  'switch': 'boolean',
  'textarea': 'textarea',
  'time': 'text',
})

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
  defaults: Omit<LowCodeNode, 'id'>
  runtime: DesignerRuntimeMaterialBinding
  sourceComponent?: string
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
  const materialName = material.key.split('.').at(-1) ?? material.key
  const sourceComponent = material.kind === 'container'
    ? 'div'
    : PORTABLE_SOURCE_COMPONENTS[materialName]

  return {
    component: material.key,
    displayName: material.title,
    category: material.category,
    icon: material.icon,
    kind: material.kind === 'container' ? 'layout' : 'component',
    props: material.setters,
    events: material.kind === 'field'
      ? [{ name: trigger, displayName: 'Value change' }]
      : [],
    bindings: material.kind === 'field'
      ? [{ name: 'value', displayName: 'Value', valueProp, trigger }]
      : [],
    layout: { span: { min: 1, max: 24 } },
    slots: material.kind === 'container' ? material.slots : [],
    defaults: nodeDefaults,
    runtime: material.runtime,
    ...(sourceComponent ? { sourceComponent } : {}),
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
