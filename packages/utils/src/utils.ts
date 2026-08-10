/**
 * 工具层主干 (Core Utilities)
 * 主打：极致 ESModule 导向、纯净无副作用 (Side-Effects Free)、TypeScript 强类型
 */

/**
 * @description 判断值是否为字符串
 */
export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

/**
 * @description 判断是否为纯净的 Object 对象 (排除 Array, null, Date 等引用数据)
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && Object.prototype.toString.call(val) === '[object Object]'
}

/**
 * @description 判断对象或数组形态是否为空
 * @param val 要判断的数据变量
 */
export function isEmpty<T = unknown>(val: T): boolean {
  if (val == null)
    return true
  if (Array.isArray(val) || typeof val === 'string')
    return val.length === 0
  if (val instanceof Map || val instanceof Set)
    return val.size === 0
  if (isObject(val))
    return Object.keys(val).length === 0
  return false
}

/**
 * 递归克隆可枚举与 Symbol 自有属性；通过 WeakMap 保留循环引用关系。
 * WeakMap/WeakSet 无法枚举内部条目，因此保持显式失败，避免返回不可用对象。
 */
interface TypedArrayView extends ArrayBufferView {
  readonly length: number
  readonly constructor: new (buffer: ArrayBufferLike, byteOffset: number, length: number) => unknown
}

function isSharedArrayBuffer(value: object): value is SharedArrayBuffer {
  return typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer
}

function cloneArrayBufferLike(buffer: ArrayBufferLike): ArrayBufferLike {
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(0)
  }

  const clonedBuffer = new SharedArrayBuffer(buffer.byteLength)
  new Uint8Array(clonedBuffer).set(new Uint8Array(buffer))
  return clonedBuffer
}

function cloneBufferReference(buffer: ArrayBufferLike, seen: WeakMap<object, unknown>): ArrayBufferLike {
  if (seen.has(buffer)) {
    return seen.get(buffer) as ArrayBufferLike
  }

  const clonedBuffer = cloneArrayBufferLike(buffer)
  seen.set(buffer, clonedBuffer)
  return clonedBuffer
}

function cloneDeepValue<T>(obj: T, seen: WeakMap<object, unknown>): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (seen.has(obj)) {
    return seen.get(obj) as T
  }

  if (obj instanceof WeakMap) {
    throw new TypeError('[core] deepClone does not support WeakMap because its entries are not enumerable')
  }

  if (obj instanceof WeakSet) {
    throw new TypeError('[core] deepClone does not support WeakSet because its entries are not enumerable')
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T
  }

  if (obj instanceof ArrayBuffer || isSharedArrayBuffer(obj)) {
    return cloneBufferReference(obj, seen) as T
  }

  if (obj instanceof DataView) {
    const clonedBuffer = cloneBufferReference(obj.buffer, seen)
    return new DataView(clonedBuffer, obj.byteOffset, obj.byteLength) as T
  }

  if (ArrayBuffer.isView(obj)) {
    const view = obj as unknown as TypedArrayView
    const clonedBuffer = cloneBufferReference(view.buffer, seen)
    return new view.constructor(clonedBuffer, view.byteOffset, view.length) as T
  }

  if (obj instanceof Map) {
    const clonedMap = new Map()
    seen.set(obj, clonedMap)
    for (const [key, value] of obj.entries()) {
      clonedMap.set(cloneDeepValue(key, seen), cloneDeepValue(value, seen))
    }

    return clonedMap as T
  }

  if (obj instanceof Set) {
    const clonedSet = new Set()
    seen.set(obj, clonedSet)
    for (const value of obj.values()) {
      clonedSet.add(cloneDeepValue(value, seen))
    }

    return clonedSet as T
  }

  if (Array.isArray(obj)) {
    const clonedArray: unknown[] = []
    seen.set(obj, clonedArray)
    obj.forEach((item, index) => {
      clonedArray[index] = cloneDeepValue(item, seen)
    })

    return clonedArray as T
  }

  const source = obj as Record<PropertyKey, unknown>
  const cloneObj = Object.create(Object.getPrototypeOf(obj))
  seen.set(obj, cloneObj)

  for (const key of Reflect.ownKeys(source)) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) {
      continue
    }

    if (!('value' in descriptor)) {
      throw new TypeError(`[core] deepClone does not support accessor property: ${String(key)}`)
    }

    descriptor.value = cloneDeepValue(descriptor.value, seen)
    Object.defineProperty(cloneObj, key, descriptor)
  }

  return cloneObj
}

/**
 * @description 极致高性能/安全的深拷贝，支持 Array、Object、Date、RegExp、Map、Set、二进制视图与循环引用。
 * @param obj 来源数据对象/数据内容
 */
export function deepClone<T>(obj: T): T {
  return cloneDeepValue(obj, new WeakMap())
}
