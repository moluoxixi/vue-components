const CANONICAL_SURFACE_BASE_KEYS = [
  'form',
  'id',
  'interactions',
  'kind',
  'name',
  'nodesById',
  'outputs',
  'parameters',
  'props',
  'rootIds',
  'scopedFields',
  'valueScopes',
]
const CANONICAL_PAGE_SURFACE_KEYS = new Set([...CANONICAL_SURFACE_BASE_KEYS, 'route'])
const CANONICAL_OVERLAY_SURFACE_KEYS = new Set([...CANONICAL_SURFACE_BASE_KEYS, 'presentation'])
const CANONICAL_NODE_BASE_KEYS = [
  'component',
  'componentFingerprint',
  'componentVersion',
  'configuredProps',
  'datasetBindings',
  'extensions',
  'id',
  'kind',
  'placement',
  'props',
  'resourceBindings',
  'subtreeHash',
]
const CANONICAL_FIELD_NODE_KEYS = new Set([
  ...CANONICAL_NODE_BASE_KEYS,
  'defaultValue',
  'field',
  'label',
  'required',
  'requiredMessage',
  'validateOn',
  'validation',
])
const CANONICAL_LAYOUT_NODE_KEYS = new Set([
  ...CANONICAL_NODE_BASE_KEYS,
  'slots',
  'valueScope',
])
const CANONICAL_ELEMENT_NODE_KEYS = new Set(CANONICAL_NODE_BASE_KEYS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => keys.has(key))
}

/** Rejects additive fields from stale or future Canonical Surface contracts. */
export function hasOnlyCurrentCanonicalSurfaceKeys(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.nodesById))
    return false
  const surfaceKeys = value.kind === 'page'
    ? CANONICAL_PAGE_SURFACE_KEYS
    : value.kind === 'dialog' || value.kind === 'drawer'
      ? CANONICAL_OVERLAY_SURFACE_KEYS
      : undefined
  if (!surfaceKeys || !hasOnlyKeys(value, surfaceKeys))
    return false
  return Object.values(value.nodesById).every((node) => {
    if (!isRecord(node))
      return false
    if (node.kind === 'field')
      return hasOnlyKeys(node, CANONICAL_FIELD_NODE_KEYS)
    if (node.kind === 'layout')
      return hasOnlyKeys(node, CANONICAL_LAYOUT_NODE_KEYS)
    if (node.kind === 'element')
      return hasOnlyKeys(node, CANONICAL_ELEMENT_NODE_KEYS)
    return false
  })
}
