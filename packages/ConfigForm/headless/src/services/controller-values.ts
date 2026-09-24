import type { ConfigFormValues } from '../types'
import type { ControllerNode } from '../types/controller-internal'
import { collectAllConfigFormFields } from '../utils'

export function cloneControllerValue<T>(value: T): T {
  return cloneValue(value, new WeakMap()) as T
}

export function equalControllerValues<TValues extends ConfigFormValues>(
  left: TValues,
  right: TValues,
): boolean {
  return equalValue(left, right, new WeakMap())
}

export function createInitialControllerValues<TValues extends ConfigFormValues>(
  model: TValues,
  fields: ControllerNode<TValues>[],
  explicitDefaults?: Partial<TValues>,
): TValues {
  const values = cloneControllerValue(model)
  const defaults: ConfigFormValues = {}

  collectAllConfigFormFields(fields).forEach((field) => {
    if (field.defaultValue !== undefined)
      setConfigFormValue(defaults, field.field, field.defaultValue)
  })
  Object.entries(defaults).forEach(([field, value]) => {
    if (!Object.hasOwn(values, field))
      setConfigFormValue(values, field, value)
  })
  Object.entries(explicitDefaults ?? {}).forEach(([field, value]) => {
    setConfigFormValue(values, field, value)
  })

  return values
}

export function createResetControllerValues<TValues extends ConfigFormValues>(
  initialValues: TValues,
  fields: ControllerNode<TValues>[],
): TValues {
  const values = cloneControllerValue(initialValues)
  collectAllConfigFormFields(fields).forEach((field) => {
    if (!Object.hasOwn(values, field.field) && field.defaultValue !== undefined)
      setConfigFormValue(values, field.field, field.defaultValue)
  })
  return values
}

export function normalizeControllerFieldNames(
  fields?: string | string[],
): string[] | undefined {
  if (fields === undefined)
    return undefined
  return Array.isArray(fields) ? [...fields] : [fields]
}

export function setConfigFormValue(
  values: ConfigFormValues,
  field: string,
  value: unknown,
): void {
  Object.defineProperty(values, field, {
    configurable: true,
    enumerable: true,
    value: cloneControllerValue(value),
    writable: true,
  })
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object')
    return value
  const existing = seen.get(value)
  if (existing !== undefined)
    return existing
  if (value instanceof Date)
    return new Date(value.getTime())
  if (value instanceof RegExp)
    return new RegExp(value.source, value.flags)
  if (value instanceof ArrayBuffer)
    return value.slice(0)
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView)
      return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
    const Constructor = value.constructor as new (source: ArrayLike<number>) => ArrayBufferView
    return new Constructor(value as unknown as ArrayLike<number>)
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob)
    return value.slice(0, value.size, value.type)
  if (value instanceof Promise || value instanceof WeakMap || value instanceof WeakSet)
    return value

  if (Array.isArray(value)) {
    const result: unknown[] = []
    seen.set(value, result)
    value.forEach(item => result.push(cloneValue(item, seen)))
    return result
  }
  if (value instanceof Map) {
    const result = new Map<unknown, unknown>()
    seen.set(value, result)
    value.forEach((item, key) => result.set(cloneValue(key, seen), cloneValue(item, seen)))
    return result
  }
  if (value instanceof Set) {
    const result = new Set<unknown>()
    seen.set(value, result)
    value.forEach(item => result.add(cloneValue(item, seen)))
    return result
  }

  const result = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>
  seen.set(value, result)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor)
      continue
    if ('value' in descriptor)
      descriptor.value = cloneValue(descriptor.value, seen)
    Object.defineProperty(result, key, descriptor)
  }
  return result
}

function equalValue(
  left: unknown,
  right: unknown,
  seen: WeakMap<object, object>,
): boolean {
  if (Object.is(left, right))
    return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right))
    return false
  const existing = seen.get(left)
  if (existing)
    return existing === right
  seen.set(left, right)

  if (left instanceof Date && right instanceof Date)
    return left.getTime() === right.getTime()
  if (left instanceof RegExp && right instanceof RegExp)
    return left.source === right.source && left.flags === right.flags
  if (left instanceof ArrayBuffer && right instanceof ArrayBuffer)
    return equalBytes(new Uint8Array(left), new Uint8Array(right))
  if (ArrayBuffer.isView(left) && ArrayBuffer.isView(right)) {
    return equalBytes(
      new Uint8Array(left.buffer, left.byteOffset, left.byteLength),
      new Uint8Array(right.buffer, right.byteOffset, right.byteLength),
    )
  }
  if (left instanceof Map && right instanceof Map) {
    if (left.size !== right.size)
      return false
    const leftEntries = [...left.entries()]
    const rightEntries = [...right.entries()]
    return leftEntries.every(([key, value], index) =>
      equalValue(key, rightEntries[index]?.[0], seen)
      && equalValue(value, rightEntries[index]?.[1], seen))
  }
  if (left instanceof Set && right instanceof Set) {
    if (left.size !== right.size)
      return false
    const leftValues = [...left.values()]
    const rightValues = [...right.values()]
    return leftValues.every((value, index) => equalValue(value, rightValues[index], seen))
  }

  const leftKeys = Reflect.ownKeys(left)
  const rightKeys = Reflect.ownKeys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => {
      if (!Object.hasOwn(right, key))
        return false
      const leftDescriptor = Object.getOwnPropertyDescriptor(left, key)
      const rightDescriptor = Object.getOwnPropertyDescriptor(right, key)
      if (!leftDescriptor || !rightDescriptor)
        return false
      if ('value' in leftDescriptor && 'value' in rightDescriptor)
        return equalValue(leftDescriptor.value, rightDescriptor.value, seen)
      return leftDescriptor.get === rightDescriptor.get && leftDescriptor.set === rightDescriptor.set
    })
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
}
