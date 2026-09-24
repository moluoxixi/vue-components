import type { ConfigFormRenderMode } from '../types'
import type { ComponentListenerService } from '../types/internal'
import { camelize, toHandlerKey } from 'vue'

interface CreateComponentListenerServiceOptions {
  mode: () => ConfigFormRenderMode
}

type Listener = (...args: unknown[]) => unknown

/** Compose Renderer bookkeeping before host listeners and suppress both in design mode. */
export function createComponentListenerService(
  options: CreateComponentListenerServiceOptions,
): ComponentListenerService {
  interface Channel {
    internal: Listener[]
    external: Listener[]
  }

  const channels = new WeakMap<object, Map<string, Channel>>()

  function ensure(target: Record<string, unknown>, event: string): Channel {
    const key = toHandlerKey(camelize(event))
    let entries = channels.get(target)
    if (!entries) {
      entries = new Map()
      channels.set(target, entries)
    }

    const existing = entries.get(key)
    if (existing)
      return existing

    const configured = target[key]
    const channel: Channel = {
      internal: [],
      external: (Array.isArray(configured) ? configured : [configured])
        .filter((listener): listener is Listener => typeof listener === 'function'),
    }
    entries.set(key, channel)
    target[key] = (...args: unknown[]) => {
      if (options.mode() === 'design')
        return undefined

      const pending: PromiseLike<unknown>[] = []
      for (const listener of [...channel.internal, ...channel.external]) {
        const result = listener(...args)
        if (result && typeof (result as PromiseLike<unknown>).then === 'function')
          pending.push(result as PromiseLike<unknown>)
      }
      return pending.length > 0 ? Promise.all(pending) : undefined
    }
    return channel
  }

  function addListener(
    target: Record<string, unknown>,
    event: string,
    listener: Listener,
  ): void {
    ensure(target, event).internal.push(listener)
  }

  function wrapComponentListeners(
    target: Record<string, unknown>,
    skipKeys: ReadonlySet<string> = new Set(),
  ): void {
    for (const key of Object.keys(target)) {
      if (!/^on[A-Z]/.test(key) || skipKeys.has(key))
        continue
      ensure(target, key.charAt(2).toLowerCase() + key.slice(3))
    }
  }

  return { addListener, wrapComponentListeners }
}
