import type { ConfigFormReaction, ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { DesignerDocument } from './types'
import { applyConfigFormReactionList } from '@moluoxixi/config-form-core'
import { walkDesignerNodes } from './traverse'

/** 收集设计器文档中的 reactions，并交给 Core 纯 reducer 执行。 */
export function applyDesignerDocumentReactions(
  document: DesignerDocument,
  values: Record<string, unknown>,
): ConfigFormReactionProjection<Record<string, unknown>> {
  const reactions: ConfigFormReaction[] = []
  walkDesignerNodes(document.nodes, ({ node }) => reactions.push(...(node.reactions ?? [])))
  return applyConfigFormReactionList(reactions, values)
}
