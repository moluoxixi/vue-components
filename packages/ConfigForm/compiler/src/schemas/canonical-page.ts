const CANONICAL_PAGE_KEYS = new Set([
  'form',
  'id',
  'name',
  'nodesById',
  'props',
  'rootIds',
  'route',
  'runtime',
  'scopedFields',
  'valueScopes',
])
const CANONICAL_NODE_BASE_KEYS = [
  'bindings',
  'component',
  'componentFingerprint',
  'componentVersion',
  'conditions',
  'configuredProps',
  'extensions',
  'id',
  'kind',
  'placement',
  'props',
  'reactions',
  'subtreeHash',
]
const CANONICAL_FIELD_NODE_KEYS = new Set([
  ...CANONICAL_NODE_BASE_KEYS,
  'defaultValue',
  'field',
  'label',
  'optionSource',
  'validateOn',
  'validation',
])
const CANONICAL_LAYOUT_NODE_KEYS = new Set([
  ...CANONICAL_NODE_BASE_KEYS,
  'slots',
  'valueScope',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => keys.has(key))
}

/** Rejects additive fields from stale or future Canonical page contracts. */
export function hasOnlyCurrentCanonicalPageKeys(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.nodesById) || !hasOnlyKeys(value, CANONICAL_PAGE_KEYS))
    return false
  return Object.values(value.nodesById).every((node) => {
    if (!isRecord(node))
      return false
    if (node.kind === 'field')
      return hasOnlyKeys(node, CANONICAL_FIELD_NODE_KEYS)
    if (node.kind === 'layout')
      return hasOnlyKeys(node, CANONICAL_LAYOUT_NODE_KEYS)
    return false
  })
}
