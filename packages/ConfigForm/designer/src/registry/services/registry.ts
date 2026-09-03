import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
} from '@moluoxixi/config-form-headless'
import type {
  DesignerMaterialDefinition,
  DesignerPropertyControlDefinition,
  DesignerRegistry,
  DesignerRegistryLayer,
  DesignerRegistryOptions,
  DesignerSimpleSetterControl,
} from '../types'
import { DesignerRegistryError } from '../../graph'
import {
  assertDesignerMaterialDefinition,
  assertDesignerMaterialParents,
} from '../validation'
import { createDesignerMaterialSubgraph } from './subgraph'

const UNSAFE_COMPONENT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function registerComponents(
  target: Map<string, ConfigFormComponentRegistry[string]>,
  layer: DesignerRegistryLayer,
): void {
  for (const [key, registration] of Object.entries(layer.components ?? {}) as Array<[
    string,
    ConfigFormComponentRegistration['component'] | ConfigFormComponentRegistration,
  ]>) {
    if (!key.trim()) {
      throw new DesignerRegistryError(
        'DESIGNER_COMPONENT_KEY_REQUIRED',
        'Designer component keys cannot be empty',
        { layerName: layer.name },
      )
    }
    if (UNSAFE_COMPONENT_KEYS.has(key)) {
      throw new DesignerRegistryError(
        'DESIGNER_COMPONENT_KEY_UNSAFE',
        `Designer component key is unsafe: ${key}`,
        { key, layerName: layer.name },
      )
    }
    if (!target.has(key))
      target.set(key, registration)
  }
}

function registerMaterials(
  target: Map<string, DesignerMaterialDefinition>,
  definitions: Iterable<DesignerMaterialDefinition> | undefined,
  scope: string,
): void {
  const seen = new Set<string>()
  for (const material of definitions ?? []) {
    assertDesignerMaterialDefinition(material, scope)
    if (seen.has(material.key)) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_DUPLICATE',
        `Duplicate designer material in ${scope}: ${material.key}`,
        { key: material.key, layerName: scope },
      )
    }
    seen.add(material.key)
    if (!target.has(material.key))
      target.set(material.key, material)
  }
}

function registerValidators(
  target: Map<string, NonNullable<DesignerRegistryLayer['validators']>[string]>,
  layer: DesignerRegistryLayer,
): void {
  for (const [key, validator] of Object.entries(layer.validators ?? {})) {
    if (!key.trim()) {
      throw new DesignerRegistryError(
        'DESIGNER_VALIDATOR_KEY_REQUIRED',
        'Designer validator keys cannot be empty',
        { layerName: layer.name },
      )
    }
    if (!target.has(key))
      target.set(key, validator)
  }
}

function registerPropertyControls(
  target: Map<DesignerSimpleSetterControl, DesignerPropertyControlDefinition>,
  layer: DesignerRegistryLayer,
): void {
  for (const [control, definition] of Object.entries(layer.propertyControls ?? {}) as Array<[
    DesignerSimpleSetterControl,
    DesignerPropertyControlDefinition,
  ]>) {
    if (!target.has(control))
      target.set(control, definition)
  }
}

export function createDesignerRegistry(
  options: DesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = new Map<string, DesignerMaterialDefinition>()
  const components = new Map<string, ConfigFormComponentRegistry[string]>()
  const propertyControls = new Map<DesignerSimpleSetterControl, DesignerPropertyControlDefinition>()
  const validators = new Map<string, NonNullable<DesignerRegistryLayer['validators']>[string]>()

  registerMaterials(materials, options.materials, 'materials')
  for (const layer of options.layers ?? []) {
    registerComponents(components, layer)
    registerMaterials(materials, layer.materials, layer.name)
    registerValidators(validators, layer)
    registerPropertyControls(propertyControls, layer)
  }

  for (const material of materials.values())
    assertDesignerMaterialParents(material, materials)

  return {
    rendererNamespace: options.rendererNamespace?.trim() || 'mx-config-form',
    components: Object.fromEntries(components),
    propertyControls: Object.fromEntries(propertyControls),
    getMaterial: key => materials.get(key),
    getValidator: key => validators.get(key),
    listMaterials: () => [...materials.values()],
    listValidators: () => [...validators.keys()],
    createSubgraph: (key, context) => createDesignerMaterialSubgraph(materials, key, context),
  }
}
