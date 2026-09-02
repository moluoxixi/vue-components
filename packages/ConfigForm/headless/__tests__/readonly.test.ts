import { describe, expect, it } from 'vitest'
import {
  formatConfigFormReadonlyValue,
  isConfigFormFieldReadonly,
  resolveConfigFormReadonlyRender,
} from '../src/utils/readonly'

describe('readonly helpers', () => {
  const field = {
    component: 'input',
    field: 'name',
    id: 'name',
    readonly: (values: { locked: boolean, name: string }) => values.locked,
  }

  it('combines form and field readonly without allowing field opt-out', () => {
    expect(isConfigFormFieldReadonly(field, { locked: false, name: 'Ada' })).toBe(false)
    expect(isConfigFormFieldReadonly(field, { locked: true, name: 'Ada' })).toBe(true)
    expect(isConfigFormFieldReadonly(field, { locked: false, name: 'Ada' }, true)).toBe(true)
  })

  it('prefers the field renderer and formats raw fallback values', () => {
    const fieldRender = () => 'field'
    const fallback = () => 'fallback'
    expect(resolveConfigFormReadonlyRender({ ...field, readonlyRender: fieldRender }, fallback)).toBe(fieldRender)
    expect(resolveConfigFormReadonlyRender(field, fallback)).toBe(fallback)
    expect(formatConfigFormReadonlyValue(['A', 'B'])).toBe('A、B')
    expect(formatConfigFormReadonlyValue({ id: 1 })).toBe('{"id":1}')
    expect(formatConfigFormReadonlyValue(null)).toBe('')
  })
})
