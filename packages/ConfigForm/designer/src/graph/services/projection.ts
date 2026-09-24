import type { ModelJsonObject, SurfaceGraph } from '@moluoxixi/config-form-model'
import { cloneConfigFormJsonValue } from '@moluoxixi/config-form-core'
import { walkDesignGraph } from '../utils'

export function createDesignPreviewModel(graph: SurfaceGraph): ModelJsonObject {
  const model: ModelJsonObject = {}
  walkDesignGraph(graph, ({ node }) => {
    if (node.kind === 'field' && node.defaultValue !== undefined)
      model[node.field] = cloneConfigFormJsonValue(node.defaultValue)
  })
  return model
}
