import type { ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'

/**
 * Workbench exposes only explicitly registered, side-effect-safe actions.
 * Integrations can replace this registry at the host boundary; the
 * page model stores only the action ref and JSON input, never a function.
 */
export function createWorkbenchFlowActionRegistry(
  onNotify?: (message: string) => void,
): ConfigFormFlowActionRegistry {
  return {
    get: (ref) => {
      if (ref !== 'notify')
        return undefined
      return {
        execute: (input, context) => {
          if (context.signal.aborted)
            throw context.signal.reason instanceof Error ? context.signal.reason : new DOMException('Aborted', 'AbortError')
          const serialized = typeof input === 'string' ? input : JSON.stringify(input)
          const message = serialized === undefined ? String(input) : serialized
          onNotify?.(message)
          return { notified: message }
        },
      }
    },
  }
}
