import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererNode,
  ConfigFormRendererProps,
  ConfigFormRuntimeEventContext,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RuntimeEditorBridgeState } from '../types/internal'
import { isConfigFormField } from '@moluoxixi/config-form-headless'
import { onBeforeUnmount } from 'vue'
import {
  createRuntimeNodeMetadata,
  createRuntimeNodeMetadataAttrs,
  resolveHtmlElement,
} from '../services/metadata'

interface UseRuntimeEditorBridgeOptions<TValues extends ConfigFormValues> {
  props: Readonly<ConfigFormRendererProps<TValues>>
}

interface RegisteredRuntimeNode<TValues extends ConfigFormValues> {
  metadata: ConfigFormRuntimeNodeMetadata<TValues>
  cleanup?: () => void
  element?: HTMLElement
}

export function useRuntimeEditorBridge<TValues extends ConfigFormValues>(
  options: UseRuntimeEditorBridgeOptions<TValues>,
): RuntimeEditorBridgeState<TValues> {
  const { props } = options
  const registeredNodes = new Map<string, RegisteredRuntimeNode<TValues>>()
  let registeredEditor = props.editor

  function ensureEditorBridge() {
    const editor = props.editor
    if (editor === registeredEditor)
      return editor

    cleanupRegistrations()
    registeredEditor = editor
    return editor
  }

  function cleanupRegistrations(): void {
    for (const registration of registeredNodes.values()) {
      if (registration.cleanup)
        registration.cleanup()
      else
        registeredEditor?.unregisterNode?.(registration.metadata, registration.element)
    }
    registeredNodes.clear()
  }

  function createNodeMetadata(
    node: ConfigFormRendererNode<TValues>,
    path: string,
    slot?: string,
  ): ConfigFormRuntimeNodeMetadata<TValues> {
    const metadata = createRuntimeNodeMetadata(
      node,
      path,
      isConfigFormField(node) ? 'field' : 'component',
      props.mode ?? 'preview',
      slot,
    )
    const state = ensureEditorBridge()?.readState?.(metadata)
    if (state !== undefined)
      metadata.state = state
    return metadata
  }

  function nodeMetadataAttrs(metadata: ConfigFormRuntimeNodeMetadata<TValues>): Record<string, unknown> {
    const editorAttrs = props.mode === 'design'
      ? ensureEditorBridge()?.getNodeAttrs?.(metadata) ?? {}
      : {}
    return createRuntimeNodeMetadataAttrs(metadata, editorAttrs)
  }

  function registerNodeElement(metadata: ConfigFormRuntimeNodeMetadata<TValues>, element: unknown): void {
    const editor = ensureEditorBridge()
    if (!editor?.registerNode)
      return

    const htmlElement = resolveHtmlElement(element)
    const key = `${metadata.path}:${metadata.nodeId}`
    if (!htmlElement) {
      const registration = registeredNodes.get(key)
      if (!registration)
        return
      if (registration.cleanup)
        registration.cleanup()
      else
        editor.unregisterNode?.(registration.metadata, registration.element)
      registeredNodes.delete(key)
      return
    }

    const current = registeredNodes.get(key)
    if (current?.element === htmlElement)
      return
    if (current?.cleanup)
      current.cleanup()
    else if (current)
      editor.unregisterNode?.(current.metadata, current.element)

    const cleanup = editor.registerNode(metadata, htmlElement)
    registeredNodes.set(key, {
      cleanup: typeof cleanup === 'function' ? cleanup : undefined,
      element: htmlElement,
      metadata,
    })
  }

  function shouldInterceptEditorEvent(
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    event: string,
    args: unknown[],
  ): boolean {
    if (props.mode !== 'design')
      return false

    const context: ConfigFormRuntimeEventContext<TValues> = {
      args,
      event,
      metadata,
    }
    const decision = ensureEditorBridge()?.interceptEvent?.(context)
    return decision !== false
  }

  onBeforeUnmount(cleanupRegistrations)

  return {
    createNodeMetadata,
    nodeMetadataAttrs,
    registerNodeElement,
    shouldInterceptEditorEvent,
  }
}
