import type { ConfigFormComponentNode, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { Component, VNodeChild } from 'vue'
import type {
  ConfigFormRendererCellAttrs,
  ConfigFormRendererFieldAttrs,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RendererPipelineContext, RendererSlots } from '../types/internal'
import { h } from 'vue'
import { isVNodeKey } from './rendering'

export function createComponentRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  createNodeSlots: (
    node: ConfigFormComponentNode<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    > & { id: string },
    path: string,
    ancestors: ReadonlySet<object>,
  ) => RendererSlots,
) {
  return (
    node: ConfigFormComponentNode<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    > & { id: string },
    path: string,
    ancestors: ReadonlySet<object>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    registerElement: boolean,
  ): VNodeChild => {
    const { binding, designGuard, editorBridge, flowEvents } = context
    const slots = createNodeSlots(node, path, ancestors)
    const registration = binding.resolveRegistration(node.component)
    const component = registration?.component ?? node.component
    const metadataAttrs = registerElement ? editorBridge.nodeMetadataAttrs(metadata) : {}
    const componentProps: Record<string, unknown> = {
      ...registration?.props,
      ...node.props,
      ...metadataAttrs,
      class: [registration?.props?.class, node.props?.class, metadataAttrs.class],
    }
    designGuard.applyDesignInteractionGuard(componentProps)
    if (registerElement)
      Object.assign(componentProps, { ref: (element: unknown) => editorBridge.registerNodeElement(metadata, element) })
    const runtimeEvents = flowEvents.runtimeFlowEventMap(node)
    const managedListeners = new Set<string>()
    flowEvents.addRuntimeFlowEventListeners(componentProps, metadata, runtimeEvents, managedListeners)
    flowEvents.wrapComponentListeners(componentProps, metadata, managedListeners, runtimeEvents)
    const configuredKey = componentProps.key
    const vnodeKey = isVNodeKey(configuredKey) ? configuredKey : `${path}.component`

    if (typeof component === 'string') {
      return h(component, {
        ...componentProps,
        key: vnodeKey,
      }, slots?.default?.() ?? [])
    }

    return h(binding.resolveComponent(component), {
      ...componentProps,
      key: vnodeKey,
    }, slots)
  }
}
