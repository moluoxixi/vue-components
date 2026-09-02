/** Serialize JSON-compatible data with deterministic object-key ordering. */
export function stableConfigFormJsonStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(item => stableConfigFormJsonStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableConfigFormJsonStringify(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Fast deterministic identity for cache keys. It is not a cryptographic integrity hash. */
export function getConfigFormJsonSemanticHash(value: unknown): string {
  const serialized = stableConfigFormJsonStringify(value)
  let hash = 0x811C9DC5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
