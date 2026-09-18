const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_DEPTH = 64
const MAX_ENTRIES = 10_000

export class ConfigFormDataValueError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string, options?: ErrorOptions) {
    super(message, options)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

/** Clone bounded data values crossing host/runtime boundaries. */
export function cloneConfigFormDataValue<T>(value: T): T {
  const ancestors = new Set<object>()
  let entries = 0

  const clone = (current: unknown, depth: number, path: string): unknown => {
    entries += 1
    if (entries > MAX_ENTRIES || depth > MAX_DEPTH) {
      throw new ConfigFormDataValueError(
        'CONFIG_FORM_DATA_VALUE_LIMIT_EXCEEDED',
        'Data value exceeds the supported size or depth.',
        path,
      )
    }
    if (current === null || current === undefined || typeof current === 'string' || typeof current === 'boolean')
      return current
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        throw new ConfigFormDataValueError(
          'CONFIG_FORM_DATA_VALUE_NON_FINITE',
          'Data value numbers must be finite.',
          path,
        )
      }
      return current
    }
    if (typeof current !== 'object') {
      throw new ConfigFormDataValueError(
        'CONFIG_FORM_DATA_VALUE_UNSUPPORTED',
        'Data value contains an unsupported value.',
        path,
      )
    }
    if (current instanceof Date)
      return new Date(current.getTime())
    if (ancestors.has(current)) {
      throw new ConfigFormDataValueError(
        'CONFIG_FORM_DATA_VALUE_CIRCULAR',
        'Data value contains a circular reference.',
        path,
      )
    }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      throw new ConfigFormDataValueError(
        'CONFIG_FORM_DATA_VALUE_OBJECT_UNSUPPORTED',
        'Data value contains an unsupported object.',
        path,
      )
    }

    ancestors.add(current)
    try {
      if (Array.isArray(current))
        return current.map((item, index) => clone(item, depth + 1, appendPath(path, String(index))))
      const result: Record<string, unknown> = {}
      Object.entries(current).forEach(([key, item]) => {
        const itemPath = appendPath(path, key)
        if (UNSAFE_KEYS.has(key)) {
          throw new ConfigFormDataValueError(
            'CONFIG_FORM_DATA_VALUE_KEY_INVALID',
            `Data value key is not allowed: ${key}`,
            itemPath,
          )
        }
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value: clone(item, depth + 1, itemPath),
          writable: true,
        })
      })
      return result
    }
    finally {
      ancestors.delete(current)
    }
  }

  try {
    return clone(value, 0, '') as T
  }
  catch (cause) {
    if (cause instanceof ConfigFormDataValueError)
      throw cause
    throw new ConfigFormDataValueError(
      'CONFIG_FORM_DATA_VALUE_UNREADABLE',
      cause instanceof Error ? cause.message : 'Data value could not be read.',
      undefined,
      { cause },
    )
  }
}

function appendPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}
