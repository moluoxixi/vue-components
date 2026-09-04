import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { VNodeChild } from 'vue'
import type { RendererPipelineContext, RenderNode } from '../types/internal'
import { createComponentRenderer } from './renderer-component'
import { createFieldRenderer } from './renderer-field'
import { createLayoutRenderer } from './renderer-layout'
import { createNodeRenderer } from './renderer-node'
import { createSlotRenderer } from './renderer-slots'

export function createRendererPipeline<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
): () => VNodeChild {
  let renderNode: RenderNode<TValues>
  const createNodeSlots = createSlotRenderer(context, (...args) => renderNode(...args))
  const renderBoundNode = createFieldRenderer(context, createNodeSlots)
  const renderComponentNode = createComponentRenderer(context, createNodeSlots)
  renderNode = createNodeRenderer(context, renderBoundNode, renderComponentNode)
  return createLayoutRenderer(context, renderNode)
}
