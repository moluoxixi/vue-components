import type { DesignerMaterialDefinition } from '../types'
import { DesignerRegistryError, isDesignerSetterPathAllowed } from '../../graph'

const SOURCE_TAG_RE = /^[a-z][a-z0-9-]*$/

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
    || !['component', 'dataset-list', 'dataset-table', 'layout-flex', 'layout-grid', 'section'].includes(source.render)
    || !libraryValid
    || !optionsValid) {
    throw new DesignerRegistryError(
      'DESIGNER_SOURCE_BINDING_INVALID',
      `Designer material ${definition.key} has an invalid source binding`,
      { key: definition.key, layerName },
    )
  }
}

export function assertDesignerMaterialDefinition(
  definition: DesignerMaterialDefinition,
  layerName: string,
): void {
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

  for (const setter of definition.setters) {
    if (!isDesignerSetterPathAllowed(setter.path)) {
      throw new DesignerRegistryError(
        'DESIGNER_SETTER_PATH_FORBIDDEN',
        `Designer material ${definition.key} declares a setter outside the default Designer boundary`,
        { key: definition.key, layerName, path: setter.path, setterKey: setter.key },
      )
    }
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

export function assertDesignerMaterialParents(
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
