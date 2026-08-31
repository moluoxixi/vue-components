import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
} from '@moluoxixi/config-form-headless'
import type { NodeSubgraph, PageNode } from '@moluoxixi/config-form-model'
import type {
  DesignerMaterialDefinition,
  DesignerPropertyControlDefinition,
  DesignerRegistry,
  DesignerRegistryLayer,
  DesignerRegistryOptions,
  DesignerSimpleSetterControl,
} from './types'
import { DesignerRegistryError } from '../graph'

const UNSAFE_COMPONENT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const UNSAFE_EVENT_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

function normalizeNode(node: PageNode | Record<string, unknown>): PageNode {
  return {
    ...structuredClone(node),
    props: structuredClone((node.props as PageNode['props'] | undefined) ?? {}),
    events: structuredClone((node.events as PageNode['events'] | undefined) ?? {}),
    bindings: structuredClone((node.bindings as PageNode['bindings'] | undefined) ?? {}),
  } as PageNode
}

function isControlledAdapter(value: unknown): boolean {
  return typeof value === 'string'
    ? value.trim().length > 0
    : (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function assertDesignPolicy(definition: DesignerMaterialDefinition, layerName: string): void {
  const policy = definition.designPolicy
  if (!policy)
    return

  const valid = (value: unknown, allowed: readonly string[]): boolean => value === undefined || allowed.includes(value as string)
  if (!valid(policy.render, ['runtime', 'adapter'])
    || !valid(policy.interaction, ['preview', 'blocked'])
    || !valid(policy.async, ['blocked', 'adapter'])
    || !valid(policy.sideEffects, ['blocked', 'adapter'])
    || !valid(policy.visualEquivalence, ['runtime-geometry'])
    || (policy.diagnostic !== undefined && (typeof policy.diagnostic !== 'string' || !policy.diagnostic.trim()))
    || (policy.adapter !== undefined && !isControlledAdapter(policy.adapter))) {
    throw new DesignerRegistryError(
      'DESIGNER_DESIGN_POLICY_INVALID',
      `Designer material ${definition.key} has an invalid design policy`,
      { key: definition.key, layerName },
    )
  }

  const adapterRequired = policy.render === 'adapter'
    || policy.async === 'adapter'
    || policy.sideEffects === 'adapter'
  if (adapterRequired && !isControlledAdapter(policy.adapter)) {
    throw new DesignerRegistryError(
      'DESIGNER_DESIGN_POLICY_ADAPTER_REQUIRED',
      `Designer material ${definition.key} requires a controlled design adapter`,
      { key: definition.key, layerName },
    )
  }
  if (adapterRequired && policy.visualEquivalence !== 'runtime-geometry') {
    throw new DesignerRegistryError(
      'DESIGNER_DESIGN_POLICY_EQUIVALENCE_REQUIRED',
      `Designer material ${definition.key} must declare runtime geometry equivalence for its design adapter`,
      { key: definition.key, layerName },
    )
  }
  if (policy.render === 'runtime' && (policy.async === 'adapter' || policy.sideEffects === 'adapter')) {
    throw new DesignerRegistryError(
      'DESIGNER_DESIGN_POLICY_INVALID',
      `Designer material ${definition.key} cannot use a runtime render policy with adapter-only capabilities`,
      { key: definition.key, layerName },
    )
  }
}

const SOURCE_TAG_RE = /^[a-z][a-z0-9-]*$/

function assertSourceBinding(definition: DesignerMaterialDefinition, layerName: string): void {
  const source = definition.source
  if (!source)
    return

  const libraryValid = source.library === undefined
    || (source.library.packageName.trim().length > 0
      && source.library.plugin.trim().length > 0
      && (source.library.stylesheet === undefined || source.library.stylesheet.trim().length > 0))
  const optionsValid = source.options === undefined
    || (source.options.mode === 'prop'
      ? source.options.optionTag === undefined
      : !!source.options.optionTag && SOURCE_TAG_RE.test(source.options.optionTag))

  if (!source.configComponent.trim()
    || !SOURCE_TAG_RE.test(source.tag)
    || !['component', 'layout-flex', 'layout-grid', 'section'].includes(source.render)
    || !libraryValid
    || !optionsValid) {
    throw new DesignerRegistryError(
      'DESIGNER_SOURCE_BINDING_INVALID',
      `Designer material ${definition.key} has an invalid source binding`,
      { key: definition.key, layerName },
    )
  }
}

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
  assertDesignPolicy(definition, layerName)
  assertSourceBinding(definition, layerName)
  const seenEvents = new Set<string>()
  for (const event of definition.events ?? []) {
    const name = event && typeof event === 'object' && typeof event.name === 'string'
      ? event.name
      : ''
    const title = event && typeof event === 'object' && typeof event.title === 'string'
      ? event.title
      : ''
    if (!name
      || name.trim() !== name
      || /\s/.test(name)
      || !title.trim()
      || UNSAFE_EVENT_NAMES.has(name)
      || seenEvents.has(name)) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_EVENT_INVALID',
        `Designer material ${definition.key} has an invalid component event`,
        { event, key: definition.key, layerName },
      )
    }
    seenEvents.add(name)
  }
  const seenParents = new Set<string>()
  for (const parent of definition.allowedParents ?? []) {
    const key = `${parent.material}:${parent.slot}`
    if (!parent.material.trim() || !parent.slot.trim() || seenParents.has(key)) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_PARENT_INVALID',
        `Designer material ${definition.key} has an invalid parent placement`,
        { key: definition.key, layerName, parent },
      )
    }
    seenParents.add(key)
  }
}

function assertMaterialParents(
  definition: DesignerMaterialDefinition,
  materials: ReadonlyMap<string, DesignerMaterialDefinition>,
): void {
  for (const placement of definition.allowedParents ?? []) {
    const parent = materials.get(placement.material)
    const slot = parent?.kind === 'layout'
      ? parent.slots.find(candidate => candidate.name === placement.slot)
      : undefined
    const acceptsKind = !slot?.accepts || slot.accepts.includes(definition.kind)
    const acceptsMaterial = !slot?.materials || slot.materials.includes(definition.key)
    if (!parent || parent.kind !== 'layout' || !slot || !acceptsKind || !acceptsMaterial) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_PARENT_INVALID',
        `Designer material ${definition.key} references an incompatible parent placement`,
        { key: definition.key, parent: placement },
      )
    }
  }
}

export function createDesignerRegistry(
  layers: DesignerRegistryLayer[],
  options: DesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = new Map<string, DesignerMaterialDefinition>()
  const components = new Map<string, ConfigFormComponentRegistry[string]>()
  const propertyControls = new Map<DesignerSimpleSetterControl, DesignerPropertyControlDefinition>()
  const validators = new Map<string, NonNullable<DesignerRegistryLayer['validators']>[string]>()

  for (const layer of layers) {
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
      if (!components.has(key))
        components.set(key, registration)
    }

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

  for (const material of materials.values())
    assertMaterialParents(material, materials)

  return {
    rendererNamespace: options.rendererNamespace?.trim() || 'mx-config-form',
    components: Object.fromEntries(components),
    propertyControls: Object.fromEntries(propertyControls),
    getMaterial: key => materials.get(key),
    getValidator: key => validators.get(key),
    listMaterials: () => [...materials.values()],
    listValidators: () => [...validators.keys()],
    createSubgraph: (key, context) => {
      const material = materials.get(key)
      if (!material) {
        throw new DesignerRegistryError(
          'DESIGNER_MATERIAL_UNKNOWN',
          `Unknown designer material: ${key}`,
          { key },
        )
      }
      const created = material.createNode(context)
      const subgraph: NodeSubgraph = 'root' in created
        ? {
            root: structuredClone(created.root),
            nodesById: Object.fromEntries(Object.entries(created.nodesById).map(([id, node]) => [id, normalizeNode(node)])),
          }
        : {
            root: [{ nodeId: created.id, placement: {} }],
            nodesById: { [created.id]: normalizeNode(created) },
          }
      const root = subgraph.root[0]
      const node = root ? subgraph.nodesById[root.nodeId] : undefined
      if (!node
        || subgraph.root.length !== 1
        || node.component !== material.key
        || node.kind !== material.kind
        || node.id !== context.id) {
        throw new DesignerRegistryError(
          'DESIGNER_MATERIAL_FACTORY_INVALID',
          `Designer material factory returned an invalid node: ${key}`,
          { key, nodeId: node?.id },
        )
      }
      return subgraph
    },
  }
}
