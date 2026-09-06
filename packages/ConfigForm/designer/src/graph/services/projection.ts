import type { ConfigFormReaction, ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import { applyConfigFormReactionList, cloneConfigFormJsonValue } from '@moluoxixi/config-form-core'
import { walkDesignGraph } from '../utils'

export function createDesignPreviewModel(graph: PageGraph): Record<string, unknown> {
  const model: Record<string, unknown> = {}
  walkDesignGraph(graph, ({ node }) => {
    if (node.kind === 'field' && node.defaultValue !== undefined)
      model[node.field] = cloneConfigFormJsonValue(node.defaultValue)
  })
  return model
}

export function applyDesignGraphReactions(
  graph: PageGraph,
  values: Record<string, unknown>,
): ConfigFormReactionProjection<Record<string, unknown>> {
  const reactions: ConfigFormReaction[] = []
  walkDesignGraph(graph, ({ node }) => reactions.push(...(node.reactions ?? [])))
  return applyConfigFormReactionList(reactions, values)
}
