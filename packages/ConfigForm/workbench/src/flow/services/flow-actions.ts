import type {
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowActionRegistry,
} from '@moluoxixi/config-form-core'
import * as ConfigFormRuntime from '@moluoxixi/config-form'
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
  const { onConfirm, onNotify, onOpenUrl, onRequest } = hooks
  return createConfigFormFlowActionRegistry(
    createConfigFormBuiltinFlowActions({
      ...(onConfirm ? { confirm: onConfirm } : {}),
      // The workbench toast channel carries plain text; the message tone is
      // kept in the flow config for hosts with richer notification UIs.
      ...(onNotify ? { message: input => onNotify(input.message) } : {}),
      ...(onOpenUrl ? { openUrl: onOpenUrl } : {}),
      ...(onRequest ? { fetch: onRequest } : {}),
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

const rendererBuiltinDescriptors = (): ConfigFormFlowActionDescriptor[] => {
  const provider = (ConfigFormRuntime as unknown as {
    listConfigFormRendererBuiltinActionDescriptors?: () => ConfigFormFlowActionDescriptor[]
  }).listConfigFormRendererBuiltinActionDescriptors
  return provider ? provider() : [
    { ref: 'builtin.field.set', title: 'Set field', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.variable.set', title: 'Set variable', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.field.state', title: 'Set field state', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.form.validate', title: 'Validate form', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.form.submit', title: 'Submit form', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.form.reset', title: 'Reset form', category: 'form', parameters: [], outputs: [], capabilities: [] },
    { ref: 'builtin.dataSource.load', title: 'Load data source', category: 'data', parameters: [], outputs: [], capabilities: ['dataSourceHost.request'] },
  ]
}

export function listWorkbenchRendererBuiltinActionDescriptors(): ConfigFormFlowActionDescriptor[] {
  return rendererBuiltinDescriptors().map(descriptor => structuredClone(descriptor))
}
/** Catalog metadata includes renderer-local actions without exposing parent implementations. */
export function listWorkbenchFlowActionDescriptors(registry: ConfigFormFlowActionRegistry): ConfigFormFlowActionDescriptor[] {
  return [...new Map([
    ...(registry.list?.() ?? []),
    ...listWorkbenchRendererBuiltinActionDescriptors(),
  ].map(descriptor => [descriptor.ref, descriptor])).values()]
}
