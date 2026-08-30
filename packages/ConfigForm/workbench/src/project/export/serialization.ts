export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function quoteKey(key: string): string {
  return /^[A-Z_$][\w$]*$/i.test(key) ? key : JSON.stringify(key)
}

export function formatStaticValue(value: unknown, depth = 0): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string')
    return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '[]'
    const indent = '  '.repeat(depth + 1)
    return `[\n${value.map(item => `${indent}${formatStaticValue(item, depth + 1)}`).join(',\n')}\n${'  '.repeat(depth)}]`
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (entries.length === 0)
      return '{}'
    const indent = '  '.repeat(depth + 1)
    return `{\n${entries.map(([key, item]) => `${indent}${quoteKey(key)}: ${formatStaticValue(item, depth + 1)}`).join(',\n')}\n${'  '.repeat(depth)}}`
  }
  throw new Error('Config contains a value that cannot be represented as static TypeScript.')
}

export function formatDefineField(node: Record<string, unknown>, depth: number): string {
  const entries = Object.entries(node)
  const indent = '  '.repeat(depth + 1)
  const closingIndent = '  '.repeat(depth)
  const properties = entries.map(([key, value]) => {
    if (key !== 'slots')
      return `${indent}${quoteKey(key)}: ${formatStaticValue(value, depth + 1)}`
    if (!isRecord(value))
      throw new Error('Config slots must be a static object.')
    const slotEntries = Object.entries(value).map(([slotName, children]) => {
      if (!Array.isArray(children))
        throw new Error('Config slot content must be an array.')
      const childIndent = '  '.repeat(depth + 3)
      const renderedChildren = children.length === 0
        ? '[]'
        : `[\n${children.map(child => `${childIndent}${formatDefineField(child as Record<string, unknown>, depth + 3)}`).join(',\n')}\n${'  '.repeat(depth + 2)}]`
      return `${'  '.repeat(depth + 2)}${quoteKey(slotName)}: ${renderedChildren}`
    })
    return `${indent}slots: ${slotEntries.length === 0 ? '{}' : `{\n${slotEntries.join(',\n')}\n${indent}}`}`
  })
  return `defineField({\n${properties.join(',\n')}\n${closingIndent}})`
}

function valueType(value: unknown): string {
  if (value === null)
    return 'unknown'
  if (Array.isArray(value))
    return 'unknown[]'
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return typeof value
    case 'object':
      return 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

export function formatValueModel(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
  if (entries.length === 0)
    return 'export type PageFormValues = Record<string, unknown>'
  return `export interface PageFormValues {\n${entries.map(([key, value]) => `  ${quoteKey(key)}: ${valueType(value)}`).join('\n')}\n}`
}

/** Escape JSON embedded in script blocks before an HTML/SFC parser sees it. */
export function scriptJson(value: unknown, space?: number): string {
  return (JSON.stringify(value, null, space) ?? 'undefined')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function escapeHtml(value: string): string {
  const entities: Readonly<Record<string, string>> = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  })
  return value.replace(/[&<>'"]/g, character => entities[character]!)
}

export function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}
