import { describe, expect, it } from 'vitest'
import { formatDefineField, formatStaticValue, formatValueModel } from '../export/serialization'

function objectWithUnsafeKey(key: string): Record<string, unknown> {
  const value = Object.create(null) as Record<string, unknown>
  Object.defineProperty(value, key, { enumerable: true, value: 'unsafe' })
  return value
}

describe('config export serialization', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects unsafe object key %s at every generator boundary', (key) => {
    expect(() => formatStaticValue({ nested: objectWithUnsafeKey(key) }))
      .toThrow(`Unsafe Config object key "${key}"`)
    expect(() => formatDefineField({ component: 'text', extensions: objectWithUnsafeKey(key) }, 1))
      .toThrow(`Unsafe Config object key "${key}"`)
    expect(() => formatValueModel(objectWithUnsafeKey(key)))
      .toThrow(`Unsafe Config object key "${key}"`)
  })

  it('reports the nested path for an unsupported static value', () => {
    expect(() => formatStaticValue({ props: { formatter: () => 'value' } }))
      .toThrow('config.props.formatter')
  })
})
