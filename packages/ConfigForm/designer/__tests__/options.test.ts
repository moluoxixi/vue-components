import { describe, expect, it } from 'vitest'
import {
  createDesignerOptionKey,
  normalizeDesignerOptions,
} from '../index'

describe('designer option contracts', () => {
  it('normalizes portable option values and drops invalid entries', () => {
    expect(normalizeDesignerOptions([
      { label: 'Text', value: 'text' },
      { label: 'Count', value: 1, disabled: true },
      { label: 'Enabled', value: false, disabled: 'no' },
      { label: 'Invalid number', value: Number.NaN },
      { value: 'missing label' },
    ])).toEqual([
      { label: 'Text', value: 'text' },
      { label: 'Count', value: 1, disabled: true },
      { label: 'Enabled', value: false },
    ])
  })

  it('creates stable keys for static option values', () => {
    expect(createDesignerOptionKey('enabled', 0)).toBe('string:enabled:0')
    expect(createDesignerOptionKey(1, 1)).toBe('number:1:1')
    expect(createDesignerOptionKey(true, 2)).toBe('boolean:true:2')
  })
})
