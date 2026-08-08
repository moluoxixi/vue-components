import type { DesignerDocument } from './types'
import { cloneDesignerJsonValue, walkDesignerNodes } from './traverse'

export function createDesignerPreviewModel(document: DesignerDocument): Record<string, unknown> {
  const model: Record<string, unknown> = {}
  walkDesignerNodes(document.nodes, ({ node }) => {
    if (node.kind === 'field' && node.defaultValue !== undefined)
      model[node.field] = cloneDesignerJsonValue(node.defaultValue)
  })
  return model
}
