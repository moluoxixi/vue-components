import { describe, expect, it } from 'vitest'
import { createPreviewRevisionGate } from '../preview-revision'

describe('preview revision gate', () => {
  it('publishes only the latest requested revision', () => {
    const gate = createPreviewRevisionGate()
    gate.request('page-1-r1')
    expect(gate.isCurrent('page-1-r1')).toBe(true)
    gate.request('page-1-r2')
    expect(gate.isCurrent('page-1-r1')).toBe(false)
    expect(gate.isCurrent('page-1-r2')).toBe(true)
    gate.invalidate()
    expect(gate.isCurrent('page-1-r2')).toBe(false)
  })
})
