import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_STRING_LENGTH = 16_384

/** Shared wire budget, including keys and otherwise unrecognized properties. */
export function isRuntimeHostJsonValue(
  value: unknown,
  depth = 0,
  ancestors = new Set<object>(),
  budget = { count: 0 },
): value is ModelJsonValue {
  if (++budget.count > 10_000 || depth > 64)
    return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return typeof value !== 'string' || value.length <= MAX_STRING_LENGTH
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value))
    return false
  const array = Array.isArray(value)
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    return false
  if (array && value.length > 10_000)
    return false
  const keys = Reflect.ownKeys(value)
  if (array && keys.length !== value.length + 1)
    return false
  ancestors.add(value)
  const valid = keys.every((key, index) => {
    if (array && key === 'length')
      return true
    if (typeof key !== 'string' || UNSAFE_KEYS.has(key) || key.length > MAX_STRING_LENGTH)
      return false
    if (array && key !== String(index))
      return false
    const property = Object.getOwnPropertyDescriptor(value, key)
    return !!property && property.enumerable && Object.hasOwn(property, 'value')
      && isRuntimeHostJsonValue(property.value, depth + 1, ancestors, budget)
  })
  ancestors.delete(value)
  return valid
}

export function isRuntimeHostJsonObject(value: unknown): value is ModelJsonObject {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && isRuntimeHostJsonValue(value)
}

export const isRuntimeHostJson = isRuntimeHostJsonValue
