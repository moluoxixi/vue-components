import type { ConfigFormFlowDiagnostic } from '@moluoxixi/config-form-core'
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererNode,
  ConfigFormRenderMode,
  ConfigFormRuntimeEventPayload,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RuntimeFlowEventService } from '../types/internal'
import { camelize, toHandlerKey } from 'vue'

interface CreateRuntimeFlowEventServiceOptions<TValues extends ConfigFormValues> {
  emitRuntimeEvent: (payload: ConfigFormRuntimeEventPayload<TValues>) => void
  eventNames?: (nodeId: string) => readonly string[]
  mode: () => ConfigFormRenderMode
  onError?: (diagnostic: ConfigFormFlowDiagnostic) => void
  shouldIntercept: (metadata: ConfigFormRuntimeNodeMetadata<TValues>, event: string, args: unknown[]) => boolean
}

type Listener = (...args: unknown[]) => unknown

export function createRuntimeFlowEventService<TValues extends ConfigFormValues>(
  options: CreateRuntimeFlowEventServiceOptions<TValues>,
): RuntimeFlowEventService<TValues> {
  interface Channel {
    event: string
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>
    runtimeEvent?: string
    internal: Listener[]
    external: Listener[]
  }
  const channels = new WeakMap<object, Map<string, Channel>>()

  function ensure(
    target: Record<string, unknown>,
    event: string,
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvent?: string,
  ): Channel {
    const key = toHandlerKey(camelize(event))
    let entries = channels.get(target)
    if (!entries) {
      entries = new Map()
      channels.set(target, entries)
    }
    const existing = entries.get(key)
    if (existing) {
      existing.metadata = metadata ?? existing.metadata
      existing.runtimeEvent = runtimeEvent ?? existing.runtimeEvent
      return existing
    }
    const configured = target[key]
    const channel: Channel = {
      event,
      metadata,
      runtimeEvent,
      internal: [],
      external: (Array.isArray(configured) ? configured : [configured])
        .filter((listener): listener is Listener => typeof listener === 'function'),
    }
    entries.set(key, channel)
    target[key] = (...args: unknown[]) => {
      const { metadata: current, runtimeEvent: subscribed } = channel
      if (current && options.shouldIntercept(current, channel.event, args))
        return
      const report = (cause: unknown): void => options.onError?.({
        code: 'FLOW_COMPONENT_LISTENER_ERROR',
        message: cause instanceof Error ? cause.message : String(cause),
        ...(current ? { nodeId: current.nodeId } : {}),
      })
      // Binding and validation bookkeeping complete before application callbacks.
      for (const listener of channel.internal)
        listener(...args)
      for (const listener of channel.external) {
        try {
          const result = listener(...args)
          if (result && typeof (result as PromiseLike<unknown>).then === 'function')
            void Promise.resolve(result).catch(report)
        }
        catch (cause) { report(cause) }
      }
      if (current && subscribed && options.mode() === 'preview') {
        options.emitRuntimeEvent({
          metadata: current,
          event: subscribed,
          args,
          ...(current.scope === undefined
            ? {}
            : { scope: current.scope.map(entry => ({ ...entry })) }),
        })
      }
    }
    return channel
  }

  function addListener(
    target: Record<string, unknown>,
    event: string,
    listener: Listener,
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvent?: string,
  ): void {
    ensure(target, event, metadata, runtimeEvent).internal.push(listener)
  }

  function wrapComponentListeners(
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    skipKeys: ReadonlySet<string> = new Set(),
    runtimeEvents: ReadonlyMap<string, string> = new Map(),
  ): void {
    for (const key of Object.keys(target)) {
      if (!/^on[A-Z]/.test(key) || skipKeys.has(key))
        continue
      const event = runtimeEvents.get(key) ?? key.charAt(2).toLowerCase() + key.slice(3)
      ensure(target, event, metadata, runtimeEvents.get(key))
    }
  }

  function addRuntimeFlowEventListeners(
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvents: ReadonlyMap<string, string>,
    managed: Set<string>,
  ): void {
    for (const [key, event] of runtimeEvents) {
      ensure(target, event, metadata, event)
      managed.add(key)
    }
  }

  function runtimeFlowEventMap(node: ConfigFormRendererNode<TValues>): ReadonlyMap<string, string> {
    const events = [...(node.eventNames ?? []), ...(options.eventNames?.(node.id) ?? [])]
    return new Map(events.map(event => [toHandlerKey(camelize(event)), event]))
  }

  return { addListener, addRuntimeFlowEventListeners, runtimeFlowEventMap, wrapComponentListeners }
}
