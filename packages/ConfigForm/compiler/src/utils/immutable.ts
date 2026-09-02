import type { ModelJsonObject } from '@moluoxixi/config-form-model'

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function cloneJsonObject(value: Readonly<Record<string, unknown>>): ModelJsonObject {
  return structuredClone(value) as ModelJsonObject
}

export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(child => deepFreeze(child))
  return Object.freeze(value)
}
