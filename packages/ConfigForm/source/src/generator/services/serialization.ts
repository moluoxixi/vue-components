function canonicalValue(value: unknown): unknown {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value
  }
  if (Array.isArray(value))
    return value.map(item => canonicalValue(item))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    )
  }
  throw new TypeError('Source JSON values must be finite JSON data.')
}

export function sourceJson(value: unknown, space = 2): string {
  return JSON.stringify(canonicalValue(value), null, space).replaceAll('<', '\\u003c')
}

export function sourceString(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

export function sourceAttributeString(value: string): string {
  const content = JSON.stringify(value)
    .slice(1, -1)
    .replaceAll('\\"', '\\u0022')
    .replaceAll("'", "\\'")
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  return `'${content}'`
}

function attributeValueSource(value: unknown): string {
  if (value === null)
    return 'null'
  if (typeof value === 'string')
    return sourceAttributeString(value)
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value)
  if (Array.isArray(value))
    return `[${value.map(item => attributeValueSource(item)).join(', ')}]`
  return `{ ${Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${sourceAttributeString(key)}: ${attributeValueSource(item)}`)
    .join(', ')} }`
}

export function sourceAttributeJson(value: unknown): string {
  return attributeValueSource(canonicalValue(value))
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function safeSlug(value: string, fallback: string): string {
  const normalized = value.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function uniqueSlugs(ids: readonly string[]): ReadonlyMap<string, string> {
  const used = new Set<string>()
  const result = new Map<string, string>()
  for (const id of ids) {
    const base = safeSlug(id, 'surface')
    let slug = base
    let suffix = 2
    while (used.has(slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }
    used.add(slug)
    result.set(id, slug)
  }
  return result
}

export function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase()
}

export function packageNameFromSpecifier(specifier: string): string | undefined {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/'))
    return undefined
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

export function isPortableVersion(version: string): boolean {
  return version.trim().length > 0 && !/^(?:workspace|catalog|file|link|portal|patch):/i.test(version.trim())
}

export function sortedRecord<T>(input: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)))
}
