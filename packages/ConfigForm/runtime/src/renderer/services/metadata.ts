import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { HTMLAttributes } from 'vue'
import type {
  ConfigFormRendererNode,
  ConfigFormRenderMode,
  ConfigFormRuntimeNodeMetadata,
} from '../types'

export function createRuntimeNodeMetadata<TValues extends ConfigFormValues>(
  node: ConfigFormRendererNode<TValues>,
  path: string,
  kind: ConfigFormRuntimeNodeMetadata<TValues>['kind'],
  mode: ConfigFormRenderMode,
  slot?: string,
): ConfigFormRuntimeNodeMetadata<TValues> {
  return {
    component: node.component,
    kind,
    mode,
    node,
    nodeId: node.id,
    path,
    slot,
  }
}

export function createRuntimeNodeMetadataAttrs<TValues extends ConfigFormValues>(
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  editorAttrs: HTMLAttributes,
): Record<string, unknown> {
  return {
    ...editorAttrs,
    'data-config-node-id': metadata.nodeId,
    'data-config-node-kind': metadata.kind,
    'data-config-path': metadata.path,
    'data-config-slot': metadata.slot,
  }
}

export function resolveHtmlElement(element: unknown): HTMLElement | undefined {
  const candidate = typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
    ? element
    : isObjectValue(element) && '$el' in element
      ? (element as { $el?: unknown }).$el
      : undefined
  return typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement
    ? candidate
    : undefined
}

export function isObjectValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}
