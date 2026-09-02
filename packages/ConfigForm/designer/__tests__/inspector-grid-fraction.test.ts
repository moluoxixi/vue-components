import { describe, expect, it } from 'vitest'
import { resolveInspectorGridFraction } from '../src/inspector'

describe('resolveInspectorGridFraction', () => {
  it.each([
    [12, 24, '12 / 24 · 1/2'],
    [8, 24, '8 / 24 · 1/3'],
    [24, 24, '24 / 24 · 100%'],
    [10, 24, '10 / 24 · 5/12'],
    [7, 18, '7 / 18 · 7/18'],
  ])('projects %i of %i as an exact reduced fraction', (span, columns, label) => {
    expect(resolveInspectorGridFraction(span, columns).label).toBe(label)
  })

  it('normalizes invalid values and clamps span to the resolved column count', () => {
    expect(resolveInspectorGridFraction(30, 24)).toEqual({
      columns: 24,
      fraction: '100%',
      label: '24 / 24 · 100%',
      span: 24,
    })
    expect(resolveInspectorGridFraction(0, Number.NaN)).toEqual({
      columns: 1,
      fraction: '100%',
      label: '1 / 1 · 100%',
      span: 1,
    })
    expect(resolveInspectorGridFraction(8.9, 24.8).label).toBe('8 / 24 · 1/3')
  })
})
