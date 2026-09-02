import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { cloneWorkbenchJson } from '..'

describe('cloneWorkbenchJson', () => {
  it('clones reactive nested values without a DataCloneError', () => {
    const source = reactive({ profile: { name: 'Ada' }, tags: ['designer'] })
    const clone = cloneWorkbenchJson(source)
    expect(clone).toEqual({ profile: { name: 'Ada' }, tags: ['designer'] })
    expect(clone).not.toBe(source)
  })
})
