import type { ModelJsonObject, ModelJsonValue } from '../types'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional])
  return required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => allowed.has(key))
}

export function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && value.trim() === value
    && !FORBIDDEN_KEYS.has(value)
}

export function isSafePathSegment(value: unknown): value is string {
  return isSafeIdentifier(value)
}

export function isJsonValue(value: unknown, ancestors = new Set<object>()): value is ModelJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (typeof value !== 'object')
    return false
  if (ancestors.has(value))
    return false
  ancestors.add(value)
  const valid = Array.isArray(value)
    ? value.every(item => isJsonValue(item, ancestors))
    : Object.keys(value).every(key => isSafePathSegment(key))
      && Object.values(value).every(item => isJsonValue(item, ancestors))
  ancestors.delete(value)
  return valid
}

export function isJsonObject(value: unknown): value is ModelJsonObject {
  return isRecord(value) && isJsonValue(value)
}

export function cloneJson<T extends ModelJsonValue>(value: T): T {
  return structuredClone(value)
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (typeof value !== 'object' || value === null || seen.has(value))
    return value
  seen.add(value)
  Object.values(value).forEach(item => deepFreeze(item, seen))
  return Object.freeze(value)
}

export function deepJsonEqual(left: ModelJsonValue, right: ModelJsonValue): boolean {
  if (left === right)
    return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => deepJsonEqual(item, right[index]!))
  }
  if (!isRecord(left) || !isRecord(right))
    return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && deepJsonEqual(left[key]!, right[key]!))
}

export function addressKey(nodeId: string, scope: readonly { scopeId: string, rowId: string }[]): string {
  return JSON.stringify([nodeId, ...scope.map(entry => [entry.scopeId, entry.rowId])])
}

export function scopeKey(scope: readonly { scopeId: string, rowId: string }[]): string {
  return addressKey('', scope)
}

export function sameScope(
  left: readonly { scopeId: string, rowId: string }[],
  right: readonly { scopeId: string, rowId: string }[],
): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry.scopeId === right[index]!.scopeId && entry.rowId === right[index]!.rowId)
}

export function scopeStartsWith(
  scope: readonly { scopeId: string, rowId: string }[],
  prefix: readonly { scopeId: string, rowId: string }[],
): boolean {
  return prefix.length <= scope.length
    && prefix.every((entry, index) => entry.scopeId === scope[index]!.scopeId && entry.rowId === scope[index]!.rowId)
}
