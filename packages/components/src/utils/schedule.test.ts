import { afterEach, describe, expect, it, vi } from 'vitest'
import { debounce, throttle } from './schedule'

describe('schedule utilities', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels pending debounce calls and flushes the latest trailing call', () => {
    vi.useFakeTimers()
    const handler = vi.fn()
    const scheduled = debounce(handler, 20)

    scheduled('stale')
    scheduled.cancel()
    vi.advanceTimersByTime(20)
    expect(handler).not.toHaveBeenCalled()

    scheduled('latest')
    scheduled.flush()
    vi.advanceTimersByTime(20)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('latest')
  })

  it('keeps leading false throttle calls pending until the trailing window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const handler = vi.fn()
    const scheduled = throttle(handler, 100, { leading: false, trailing: true })

    scheduled('first')
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(99)
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(handler).toHaveBeenCalledWith('first')

    scheduled('second')
    scheduled.cancel()
    vi.advanceTimersByTime(100)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
