import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererNode,
  ConfigFormRenderMode,
  ConfigFormRuntimeEventPayload,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RuntimeFlowEventService } from '../types/internal'
import { camelize, toHandlerKey } from 'vue'
import { isObjectValue } from './metadata'

interface CreateRuntimeFlowEventServiceOptions<TValues extends ConfigFormValues> {
  emitRuntimeEvent: (payload: ConfigFormRuntimeEventPayload<TValues>) => void
  mode: () => ConfigFormRenderMode
  shouldIntercept: (
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    event: string,
    args: unknown[],
  ) => boolean
}

export function createRuntimeFlowEventService<TValues extends ConfigFormValues>(
  options: CreateRuntimeFlowEventServiceOptions<TValues>,
): RuntimeFlowEventService<TValues> {
  function emitRuntimeEvent(
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    event: string,
    args: unknown[],
  ): void {
    if (options.mode() !== 'preview')
      return
    options.emitRuntimeEvent({ args, event, metadata })
  }

  function editorEventListener(
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    event: string,
    listener: (...args: unknown[]) => void,
    runtimeEvent?: string,
  ): (...args: unknown[]) => void {
    return (...args: unknown[]) => {
      if (options.shouldIntercept(metadata, event, args))
        return
      listener(...args)
      if (runtimeEvent)
        emitRuntimeEvent(metadata, runtimeEvent, args)
    }
  }

  function wrapComponentListeners(
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    skipKeys: ReadonlySet<string> = new Set(),
    runtimeEvents: ReadonlyMap<string, string> = new Map(),
  ): void {
    if (options.mode() !== 'design' && options.mode() !== 'preview')
      return

    for (const key of Object.keys(target)) {
      if (!/^on[A-Z]/.test(key) || skipKeys.has(key))
        continue
      const value = target[key]
      const runtimeEvent = runtimeEvents.get(key)
      if (options.mode() === 'preview' && !runtimeEvent)
        continue
      const event = runtimeEvent ?? eventNameFromHandlerKey(key)
      if (typeof value === 'function') {
        target[key] = editorEventListener(metadata, event, value as (...args: unknown[]) => void, runtimeEvent)
      }
      else if (Array.isArray(value)) {
        const listeners = value.filter((listener): listener is (...args: unknown[]) => void => typeof listener === 'function')
        target[key] = editorEventListener(metadata, event, (...args: unknown[]) => {
          for (const listener of listeners)
            listener(...args)
        }, runtimeEvent)
      }
    }
  }

  function addListener(
    target: Record<string, unknown>,
    event: string,
    listener: (...args: unknown[]) => void,
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvent?: string,
  ): void {
    const key = toHandlerKey(camelize(event))
    const existing = target[key]
    const existingListeners = Array.isArray(existing)
      ? existing.filter((value): value is (...args: unknown[]) => unknown => typeof value === 'function')
      : typeof existing === 'function' ? [existing] : []
    target[key] = (...args: unknown[]) => {
      if (metadata && options.shouldIntercept(metadata, event, args))
        return
      for (const existingListener of existingListeners)
        existingListener(...args)
      listener(...args)
      if (metadata && runtimeEvent)
        emitRuntimeEvent(metadata, runtimeEvent, args)
    }
  }

  function addRuntimeFlowEventListeners(
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvents: ReadonlyMap<string, string>,
    managedListenerKeys: Set<string>,
  ): void {
    for (const [key, event] of runtimeEvents) {
      if (!managedListenerKeys.has(key))
        addListener(target, event, () => {}, metadata, event)
      managedListenerKeys.add(key)
    }
  }

  function runtimeFlowEventMap(node: ConfigFormRendererNode<TValues>): ReadonlyMap<string, string> {
    return new Map(runtimeFlowEvents(node).map(event => [toHandlerKey(camelize(event)), event] as const))
  }

  return {
    addListener,
    addRuntimeFlowEventListeners,
    runtimeFlowEventMap,
    wrapComponentListeners,
  }
}

function runtimeFlowEvents<TValues extends ConfigFormValues>(node: ConfigFormRendererNode<TValues>): string[] {
  const lowCode = node.extensions?.['mx.low-code']
  if (!isObjectValue(lowCode))
    return []
  const events = (lowCode as Record<string, unknown>).flowEvents
  if (!Array.isArray(events))
    return []
  return [...new Set(events.filter(isNonEmptyString))]
}

function eventNameFromHandlerKey(key: string): string {
  const event = key.slice(2)
  return event.charAt(0).toLowerCase() + event.slice(1)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
