import type {
  DesignerMaterialDefinition,
  DesignerPropertyControlDefinition,
  DesignerRegistry,
  DesignerRegistryLayer,
  DesignerRegistryOptions,
  DesignerSimpleSetterControl,
} from './types'
import { DesignerRegistryError } from '../document'

function assertMaterialDefinition(definition: DesignerMaterialDefinition, layerName: string): void {
  if (!definition.key.trim()) {
    throw new DesignerRegistryError(
      'DESIGNER_MATERIAL_KEY_REQUIRED',
      'Designer material keys cannot be empty',
      { layerName },
    )
  }
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new DesignerRegistryError(
      'DESIGNER_MATERIAL_VERSION_INVALID',
      `Designer material ${definition.key} must have a positive integer version`,
      { key: definition.key, layerName, version: definition.version },
    )
  }
}

export function createDesignerRegistry(
  layers: DesignerRegistryLayer[],
  options: DesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = new Map<string, DesignerMaterialDefinition>()
  const propertyControls = new Map<DesignerSimpleSetterControl, DesignerPropertyControlDefinition>()
  const validators = new Map<string, NonNullable<DesignerRegistryLayer['validators']>[string]>()

  for (const layer of layers) {
    const layerMaterialKeys = new Set<string>()
    for (const material of layer.materials ?? []) {
      assertMaterialDefinition(material, layer.name)
      if (layerMaterialKeys.has(material.key)) {
        throw new DesignerRegistryError(
          'DESIGNER_MATERIAL_DUPLICATE',
          `Duplicate designer material in ${layer.name}: ${material.key}`,
          { key: material.key, layerName: layer.name },
        )
      }
      layerMaterialKeys.add(material.key)
      if (!materials.has(material.key))
        materials.set(material.key, material)
    }

    for (const [key, validator] of Object.entries(layer.validators ?? {})) {
      if (!key.trim()) {
        throw new DesignerRegistryError(
          'DESIGNER_VALIDATOR_KEY_REQUIRED',
          'Designer validator keys cannot be empty',
          { layerName: layer.name },
        )
      }
      if (!validators.has(key))
        validators.set(key, validator)
    }

    for (const [control, definition] of Object.entries(layer.propertyControls ?? {}) as Array<[
      DesignerSimpleSetterControl,
      DesignerPropertyControlDefinition,
    ]>) {
      if (!propertyControls.has(control))
        propertyControls.set(control, definition)
    }
  }

  return {
    rendererNamespace: options.rendererNamespace?.trim() || 'mx-config-form',
    propertyControls: Object.fromEntries(propertyControls),
    getMaterial: key => materials.get(key),
    getValidator: key => validators.get(key),
    listMaterials: () => [...materials.values()],
    listValidators: () => [...validators.keys()],
    createNode: (key, context) => {
      const material = materials.get(key)
      if (!material) {
        throw new DesignerRegistryError(
          'DESIGNER_MATERIAL_UNKNOWN',
          `Unknown designer material: ${key}`,
          { key },
        )
      }
      const node = material.createNode(context)
      if (node.material !== material.key || node.kind !== material.kind || node.id !== context.id) {
        throw new DesignerRegistryError(
          'DESIGNER_MATERIAL_FACTORY_INVALID',
          `Designer material factory returned an invalid node: ${key}`,
          { key, nodeId: node.id },
        )
      }
      return node
    },
  }
}
