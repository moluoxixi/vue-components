import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { restoreFocusIfLost } from '../src/ui/focus'

afterEach(() => {
  document.body.replaceChildren()
})

describe('restoreFocusIfLost', () => {
  it('焦点丢到文档根时归还触发器', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    trigger.blur()

    restoreFocusIfLost(trigger)
    await flushPromises()

    expect(document.activeElement).toBe(trigger)
  })

  it('用户已聚焦其他控件时不抢回焦点', async () => {
    const trigger = document.createElement('button')
    const next = document.createElement('button')
    document.body.append(trigger, next)
    next.focus()

    restoreFocusIfLost(trigger)
    await flushPromises()

    expect(document.activeElement).toBe(next)
  })
})
