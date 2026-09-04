import type { I18nDiagnostic, JsonFormatMetadata, JsonObject, JsonValue } from '../types'

export function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function parseJsonSource(content: string, resourceId: string): {
  diagnostics: I18nDiagnostic[]
  format?: JsonFormatMetadata
  tree?: JsonObject
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  }
  catch {
    return {
      diagnostics: [{
        code: 'INVALID_JSON',
        message: 'The locale resource is not valid JSON.',
        resourceId,
        severity: 'error',
      }],
    }
  }

  if (!isJsonObject(parsed)) {
    return {
      diagnostics: [{
        code: 'ROOT_NOT_OBJECT',
        message: 'The locale resource root must be a JSON object.',
        resourceId,
        severity: 'error',
      }],
    }
  }

  const indentMatch = content.match(/(?:\r\n|\n)([\t ]+)"/)
  return {
    diagnostics: [],
    format: {
      eol: content.includes('\r\n') ? '\r\n' : '\n',
      indent: indentMatch?.[1] ?? '  ',
      rootKeyOrder: Object.keys(parsed),
      trailingNewline: /(?:\r\n|\n)$/.test(content),
    },
    tree: parsed,
  }
}

export function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value))
    return value.map(item => cloneJson(item)) as T
  if (!isJsonObject(value))
    return value

  const clone = Object.create(null) as JsonObject
  for (const [key, child] of Object.entries(value))
    Object.defineProperty(clone, key, { configurable: true, enumerable: true, value: cloneJson(child), writable: true })
  return clone as T
}

export function getJsonPath(root: JsonObject, path: readonly string[]): JsonValue | undefined {
  let current: JsonValue = root
  for (const segment of path) {
    if (!isJsonObject(current) || !Object.hasOwn(current, segment))
      return undefined
    current = current[segment]
  }
  return current
}

export function setJsonPath(root: JsonObject, path: readonly string[], value: string): boolean {
  if (path.length === 0)
    return false

  let current = root
  for (const segment of path.slice(0, -1)) {
    const child = current[segment]
    if (child === undefined) {
      const next = Object.create(null) as JsonObject
      Object.defineProperty(current, segment, { configurable: true, enumerable: true, value: next, writable: true })
      current = next
      continue
    }
    if (!isJsonObject(child))
      return false
    current = child
  }

  Object.defineProperty(current, path.at(-1)!, { configurable: true, enumerable: true, value, writable: true })
  return true
}

export function serializeJson(tree: JsonObject, format: JsonFormatMetadata): string {
  const json = JSON.stringify(tree, null, format.indent)
  const normalized = format.eol === '\n' ? json : json.replaceAll('\n', format.eol)
  return format.trailingNewline ? `${normalized}${format.eol}` : normalized
}
