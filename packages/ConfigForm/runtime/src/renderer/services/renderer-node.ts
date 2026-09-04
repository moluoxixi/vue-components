import type { ConfigFormComponentNode, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { Component, StyleValue, VNodeChild } from 'vue'
import type {
  ConfigFormRendererCellAttrs,
  ConfigFormRendererField,
  ConfigFormRendererFieldAttrs,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RendererPipelineContext, RenderNode } from '../types/internal'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-headless'
import { h } from 'vue'
import { resolveConfigFormNodeSpan } from '../utils'
import { assertAcyclicNode, getNodeKey } from './rendering'

type RenderBoundNode<TValues extends ConfigFormValues> = (
  field: ConfigFormRendererField<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  registerElement: boolean,
) => VNodeChild

type RenderComponentNode<TValues extends ConfigFormValues> = (
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
) => VNodeChild

export function createNodeRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  renderBoundNode: RenderBoundNode<TValues>,
  renderComponentNode: RenderComponentNode<TValues>,
): RenderNode<TValues> {
  return (node, wrapCell, path, ancestors, slot) => {
    const { activePresentationLayout, bem, controller, editorBridge, props, responsiveLayouts } = context
    assertAcyclicNode(node, ancestors)
    const nextAncestors = new Set(ancestors).add(node)
    const reactionState = isConfigFormField(node) ? controller.resolveReactionState(node.field) : undefined
    const visible = reactionState?.visible ?? isConfigFormNodeVisible(node, controller.model.value)
    if (!visible)
      return null

    const metadata = editorBridge.createNodeMetadata(node, path, slot)
    const body = isConfigFormField(node)
      ? renderBoundNode(node, path, nextAncestors, metadata, !wrapCell)
      : renderComponentNode(node, path, nextAncestors, metadata, !wrapCell)
    if (!wrapCell)
      return body

    const cellAttrs = props.cellAttrs ?? {}
    const nodeCellAttrs = node.cellAttrs
    const layouts = responsiveLayouts.value
    const desktopSpan = resolveConfigFormNodeSpan(node.span, layouts.desktop)
    const tabletSpan = resolveConfigFormNodeSpan(node.span, layouts.tablet)
    const mobileSpan = resolveConfigFormNodeSpan(node.span, layouts.mobile)
    const style: StyleValue = [
      cellAttrs.style,
      nodeCellAttrs?.style,
      props.inline
        ? { flex: '0 1 auto', minWidth: 0 }
        : {
            '--mx-config-form-span-desktop': desktopSpan,
            '--mx-config-form-span-mobile': mobileSpan,
            '--mx-config-form-span-tablet': tabletSpan,
            ...(activePresentationLayout.value
              ? { '--mx-config-form-active-span': resolveConfigFormNodeSpan(node.span, activePresentationLayout.value) }
              : {}),
            'gridColumn': 'span var(--mx-config-form-active-span) / span var(--mx-config-form-active-span)',
            'minWidth': 0,
          },
    ]
    const metadataAttrs = editorBridge.nodeMetadataAttrs(metadata)

    return h('div', {
      ...cellAttrs,
      ...nodeCellAttrs,
      ...metadataAttrs,
      'class': [bem('cell'), cellAttrs.class, nodeCellAttrs?.class, metadataAttrs.class],
      'data-config-form-responsive-cell': '',
      'key': getNodeKey(node, path),
      'ref': (element: unknown) => editorBridge.registerNodeElement(metadata, element),
      style,
    }, [body])
  }
}
