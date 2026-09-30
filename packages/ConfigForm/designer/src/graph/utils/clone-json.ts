import { toRaw } from 'vue'

/** Detach JSON authoring state, including proxies nested inside plain containers. */
export function cloneDesignerJson<T>(value: T): T {
  const ancestors = new WeakSet<object>()
  const invalid = (): never => {
    throw new TypeError('DESIGN_JSON_INVALID: Designer values must be finite, acyclic plain JSON.')
  }
  const clone = (input: unknown): unknown => {
    const current = toRaw(input)
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      return current
    if (typeof current === 'number')
      return Number.isFinite(current) ? current : invalid()
    if (typeof current !== 'object' || ancestors.has(current))
      return invalid()
    const prototype = Object.getPrototypeOf(current)
    if ((!Array.isArray(current) && prototype !== Object.prototype && prototype !== null)
      || Object.getOwnPropertySymbols(current).length > 0) {
      return invalid()
    }

    ancestors.add(current)
    try {
      if (Array.isArray(current))
        return Array.from(current, clone)
      return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, clone(child)]))
    }
    finally {
      ancestors.delete(current)
    }
  }
  return clone(value) as T
}
