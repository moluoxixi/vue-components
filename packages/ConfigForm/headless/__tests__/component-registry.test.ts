import { describe, expect, it } from 'vitest'
import { isConfigFormComponentRegistration } from '../index'

describe('component registry utilities', () => {
  it('recognizes only registration objects with an own component property', () => {
    const inherited = Object.create({ component: 'input' })

    expect(isConfigFormComponentRegistration({ component: 'input' })).toBe(true)
    expect(isConfigFormComponentRegistration(inherited)).toBe(false)
    expect(isConfigFormComponentRegistration({ name: 'DirectComponent' })).toBe(false)
    expect(isConfigFormComponentRegistration(null)).toBe(false)
  })
})
