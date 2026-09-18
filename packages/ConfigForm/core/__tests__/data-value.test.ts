import { describe, expect, it } from 'vitest'
import { cloneConfigFormDataValue } from '../src/data-source'

describe('config form data value clone', () => {
  it('clones nested records, arrays, dates, and undefined values', () => {
    const source = {
      createdAt: new Date('2026-09-18T00:00:00Z'),
      nested: { values: [1, undefined] },
    }

    const cloned = cloneConfigFormDataValue(source)

    expect(cloned).toEqual(source)
    expect(cloned).not.toBe(source)
    expect(cloned.createdAt).not.toBe(source.createdAt)
    expect(cloned.nested).not.toBe(source.nested)
  })

  it('rejects circular, unsafe, and unsupported values with data-domain errors', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => cloneConfigFormDataValue(circular)).toThrow(expect.objectContaining({
      code: 'CONFIG_FORM_DATA_VALUE_CIRCULAR',
    }))
    expect(() => cloneConfigFormDataValue(JSON.parse('{"__proto__":1}'))).toThrow(expect.objectContaining({
      code: 'CONFIG_FORM_DATA_VALUE_KEY_INVALID',
    }))
    expect(() => cloneConfigFormDataValue(new Map())).toThrow(expect.objectContaining({
      code: 'CONFIG_FORM_DATA_VALUE_OBJECT_UNSUPPORTED',
    }))
  })
})
