import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererNode } from '../../renderer'
import type { FormNodeConfig, ResolvedBoundNode, ResolvedFormNode } from '../../types'
import type { FormRuntime } from '../types'
import { isConfigFormField } from '@moluoxixi/config-form-headless'
import { resolveReadonlyAdapter } from './readonly'

/** Plugins preprocess fields; the Headless controller remains the only executor. */
export function projectRuntimeFields<TValues extends ConfigFormValues>(
  nodes: ConfigFormRendererNode<TValues>[],
  runtime: FormRuntime,
): ConfigFormRendererNode<TValues>[] {
  function projectNode(resolved: ResolvedFormNode): ConfigFormRendererNode<TValues> {
    const projected = { ...resolved } as ConfigFormRendererNode<TValues>
    if (resolved.slots) {
      projected.slots = Object.fromEntries(Object.entries(resolved.slots).map(([key, slot]) => [
        key,
        typeof slot === 'function'
          ? slot
          : Array.isArray(slot)
            ? slot.map(item => typeof item === 'function' ? item : projectNode(item))
            : projectNode(slot),
      ])) as ConfigFormRendererNode<TValues>['slots']
    }
    if (isConfigFormField(projected)) {
      const adapter = resolveReadonlyAdapter(runtime.readonlyAdapters, resolved as ResolvedBoundNode)
      if (adapter && !projected.readonlyRender) {
        projected.readonlyRender = ({ model, value, componentProps }) => adapter({
          values: model,
          value,
          field: projected.field,
          node: { ...resolved, props: componentProps } as ResolvedBoundNode,
        })
      }
    }
    return projected
  }

  return nodes.map(node => projectNode(runtime.transformField(node as FormNodeConfig)))
}
