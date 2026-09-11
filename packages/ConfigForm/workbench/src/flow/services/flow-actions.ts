import type {
  ConfigFormFlowActionRegistry,
} from '@moluoxixi/config-form-core'
import type { WorkbenchFlowActionHooks } from '../types'
import {
  createConfigFormBuiltinFlowActions,
  createConfigFormFlowActionRegistry,
} from '@moluoxixi/config-form-core'

/**
 * Workbench exposes the built-in action library plus explicitly registered,
 * side-effect-safe actions. Integrations can replace this registry at the
 * host boundary; the page model stores only the action ref and JSON input,
 * never a function.
 */
export function createWorkbenchFlowActionRegistry(
  hooks: WorkbenchFlowActionHooks = {},
): ConfigFormFlowActionRegistry {
  const { onConfirm, onNotify } = hooks
  return createConfigFormFlowActionRegistry(
    createConfigFormBuiltinFlowActions({
      ...(onConfirm ? { confirm: onConfirm } : {}),
      // The workbench toast channel carries plain text; the message tone is
      // kept in the flow config for hosts with richer notification UIs.
      ...(onNotify ? { message: input => onNotify(input.message) } : {}),
      ...(typeof window === 'undefined'
        ? {}
        : {
            openUrl: (url, target) => {
              window.open(url, target, 'noopener')
            },
          }),
    }),
    {
      notify: {
        execute: (input, context) => {
          if (context.signal.aborted)
            throw context.signal.reason instanceof Error ? context.signal.reason : new DOMException('Aborted', 'AbortError')
          const serialized = typeof input === 'string' ? input : JSON.stringify(input)
          const message = serialized === undefined ? String(input) : serialized
          onNotify?.(message)
          return { notified: message }
        },
      },
    },
  )
}
