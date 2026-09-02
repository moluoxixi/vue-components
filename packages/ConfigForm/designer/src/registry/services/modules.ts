import type {
  DesignerMaterialCapabilities,
  DesignerMaterialDefinition,
  DesignerMaterialModule,
  DesignerMaterialModuleMap,
  DesignerMaterialModuleRegistry,
} from '../types'
import {
  createConfigFormModuleRegistry,
  defineConfigFormModule,
} from '@moluoxixi/config-form-core'
import { DesignerRegistryError } from '../../graph'

function materialRootNode(material: DesignerMaterialDefinition) {
  const created = material.createNode({
    id: '__registry_default__',
    ...(material.kind === 'field' ? { field: '__registry_field__' } : {}),
  })
  const root = 'root' in created ? created.root[0] : undefined
  const node = 'root' in created
    ? (root ? created.nodesById[root.nodeId] : undefined)
    : created
  if (!node || node.component !== material.key || node.kind !== material.kind) {
    throw new DesignerRegistryError(
      'DESIGNER_MATERIAL_FACTORY_INVALID',
      `Designer material factory returned an invalid root node: ${material.key}`,
      { key: material.key, nodeId: node?.id },
    )
  }
  return node
}

function projectMaterialCapabilities(material: DesignerMaterialDefinition): DesignerMaterialCapabilities {
  const node = materialRootNode(material)
  const valueProp = material.runtime.valueProp ?? 'modelValue'
  const trigger = material.runtime.trigger ?? `update:${valueProp}`
  const events = new Map<string, { name: string }>()
  if (material.kind === 'field')
    events.set(trigger, { name: trigger })
  material.events?.forEach(event => events.set(event.name, { name: event.name }))

  const properties = new Map<string, DesignerMaterialCapabilities['contract']['props'][number]>()
  material.setters.forEach((setter) => {
    if (setter.path[0] !== 'props')
      return
    properties.set(setter.key, {
      key: setter.key,
      path: [...setter.path],
      ...(setter.valueKind ? { valueKind: setter.valueKind } : {}),
    })
  })

  return {
    contract: {
      key: material.key,
      version: String(material.version),
      kind: material.kind,
      props: [...properties.values()],
      events: [...events.values()],
      bindings: material.kind === 'field' ? [{ name: 'value', valueProp, trigger }] : [],
      slots: (material.kind === 'layout' ? material.slots : []).map(slot => ({
        name: slot.name,
        ...(slot.accepts ? { accepts: [...slot.accepts] } : {}),
        ...(slot.materials ? { components: [...slot.materials] } : {}),
      })),
      allowedParents: (material.allowedParents ?? []).map(parent => ({
        component: parent.material,
        slot: parent.slot,
      })),
      defaults: structuredClone(node.props ?? {}),
    },
    runtime: {
      component: material.key,
      contractVersion: String(material.version),
      kind: material.kind,
      binding: material.runtime,
    },
    design: {
      component: material.key,
      contractVersion: String(material.version),
      kind: material.kind,
      title: material.title,
      category: material.category,
      ...(material.icon ? { icon: material.icon } : {}),
      setters: material.setters,
      events: material.events ?? [],
      slots: material.kind === 'layout' ? material.slots : [],
      ...(material.designPolicy ? { policy: material.designPolicy } : {}),
    },
    ...(material.source
      ? {
          source: {
            component: material.key,
            contractVersion: String(material.version),
            binding: structuredClone(material.source),
            ...(node.kind === 'field' && node.defaultValue !== undefined
              ? { defaultValue: structuredClone(node.defaultValue) }
              : {}),
            ...(material.runtime.trigger ? { trigger: material.runtime.trigger } : {}),
            ...(material.runtime.valueProp ? { valueProp: material.runtime.valueProp } : {}),
          },
        }
      : {}),
  }
}

export function defineDesignerMaterialModule(
  module: DesignerMaterialModule,
): DesignerMaterialModule {
  return defineConfigFormModule(module)
}

export function createDesignerMaterialModuleRegistry(
  modules: DesignerMaterialModuleMap,
): DesignerMaterialModuleRegistry {
  const registry = createConfigFormModuleRegistry(modules)
  const entries = registry.list()

  for (const entry of entries) {
    const material = entry.value?.material
    if (!material || typeof material !== 'object' || typeof material.key !== 'string') {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_MODULE_INVALID',
        `Designer material module ${entry.name} must provide a material definition`,
        { moduleName: entry.name, source: entry.source },
      )
    }

    const materialName = material.key.split('.').at(-1)
    if (materialName !== entry.name) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_MODULE_KEY_MISMATCH',
        `Designer material key ${entry.value.material.key} does not match module ${entry.name}`,
        {
          key: material.key,
          moduleName: entry.name,
          source: entry.source,
        },
      )
    }
  }

  const capabilities = entries.map(entry => projectMaterialCapabilities(entry.value.material))
  const capabilitiesByComponent = new Map(capabilities.map(entry => [entry.contract.key, entry]))

  return {
    modules: registry,
    materials: entries.map(entry => entry.value.material),
    capabilities,
    contracts: capabilities.map(entry => entry.contract),
    get: component => capabilitiesByComponent.get(component),
    locales: Object.fromEntries(entries.flatMap(entry => (
      entry.value.locale ? [[entry.value.material.key, entry.value.locale]] : []
    ))),
  }
}
