import { describe, expect, it } from 'vitest'
import * as headless from '../../headless'
import * as core from '../index'

describe('config-form-core compatibility entry', () => {
  it('forwards the headless runtime API', () => {
    expect(core.defineField).toBe(headless.defineField)
    expect(core.defineFields).toBe(headless.defineFields)
    expect(core.createConfigFormController).toBe(headless.createConfigFormController)
  })
})
