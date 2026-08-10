import { describe, expect, it } from 'vitest'
import { deepClone, isEmpty, isObject, isString } from '../src/index'

describe('core Utilities', () => {
  it('isString', () => {
    expect(isString('hello')).toBe(true)
    expect(isString('')).toBe(true)
    expect(isString(123)).toBe(false)
    expect(isString({})).toBe(false)
    expect(isString(null)).toBe(false)
  })

  it('isObject', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject('string')).toBe(false)
    expect(isObject(new Date())).toBe(false)
    expect(isObject(/test/)).toBe(false)
  })

  it('isEmpty', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('a')).toBe(false)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty({ a: 1 })).toBe(false)
    expect(isEmpty(new Map())).toBe(true)
    expect(isEmpty(new Set())).toBe(true)

    const map = new Map()
    map.set('key', 'value')
    expect(isEmpty(map)).toBe(false)
  })

  it('deepClone', () => {
    const origin = {
      a: 1,
      b: 'string',
      c: { d: 2 },
      e: [1, 2, { f: 3 }],
      g: new Date('2023-01-01'),
      h: /test/gi,
    }

    const cloned = deepClone(origin)

    expect(cloned).toEqual(origin)
    expect(cloned).not.toBe(origin)
    expect(cloned.c).not.toBe(origin.c)
    expect(cloned.e).not.toBe(origin.e)
    expect(cloned.g).not.toBe(origin.g)
    expect(cloned.h).not.toBe(origin.h)
  })

  it('deepClone preserves circular references, Map, Set, and symbol keyed values', () => {
    const marker = Symbol('marker')
    const origin: any = {
      label: 'root',
      nested: new Map<string, any>(),
      tags: new Set<any>(),
    }
    origin[marker] = { visible: true }
    origin.self = origin
    origin.nested.set('child', { parent: origin })
    origin.tags.add(origin[marker])

    const cloned = deepClone(origin)

    expect(cloned).not.toBe(origin)
    expect(cloned.self).toBe(cloned)
    expect(cloned[marker]).toEqual({ visible: true })
    expect(cloned[marker]).not.toBe(origin[marker])
    expect(cloned.nested).toBeInstanceOf(Map)
    expect(cloned.nested).not.toBe(origin.nested)
    expect(cloned.nested.get('child').parent).toBe(cloned)
    expect(cloned.tags).toBeInstanceOf(Set)
    expect([...cloned.tags][0]).toBe(cloned[marker])
  })

  it('deepClone should preserve custom prototypes and property descriptors', () => {
    const symbolKey = Symbol('hidden')
    const prototype = {
      greet() {
        return 'hello'
      },
    }
    const source = Object.create(prototype)
    Object.defineProperty(source, 'secret', {
      configurable: true,
      enumerable: false,
      value: 42,
      writable: false,
    })
    source[symbolKey] = 'symbol-value'

    const cloned = deepClone(source) as typeof source
    const descriptor = Object.getOwnPropertyDescriptor(cloned, 'secret')

    expect(Object.getPrototypeOf(cloned)).toBe(prototype)
    expect(descriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      value: 42,
      writable: false,
    })
    expect(cloned[symbolKey]).toBe('symbol-value')
    expect(cloned.greet()).toBe('hello')
  })

  it('deepClone throws visible errors for accessor descriptors', () => {
    const source = {
      get nested() {
        return { value: 1 }
      },
    }

    expect(() => deepClone(source)).toThrow('[core] deepClone does not support accessor property: nested')
  })

  it('deepClone clones ArrayBuffer, DataView, and typed array storage', () => {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setUint16(0, 0x1234)
    const bytes = new Uint8Array(buffer, 2, 4)
    bytes.set([1, 2, 3, 4])
    const origin = {
      buffer,
      bytes,
      view,
    }

    const cloned = deepClone(origin)

    expect(cloned.buffer).not.toBe(buffer)
    expect(new Uint8Array(cloned.buffer)).toEqual(new Uint8Array(buffer))
    expect(cloned.view).not.toBe(view)
    expect(cloned.view.buffer).not.toBe(buffer)
    expect(cloned.view.getUint16(0)).toBe(0x1234)
    expect(cloned.bytes).not.toBe(bytes)
    expect(cloned.bytes.buffer).not.toBe(bytes.buffer)
    expect(Array.from(cloned.bytes)).toEqual([1, 2, 3, 4])
  })
})
