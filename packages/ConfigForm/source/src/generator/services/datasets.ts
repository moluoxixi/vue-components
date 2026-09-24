import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ContractResult, ModelDiagnostic, ModelJsonObject } from '@moluoxixi/config-form-model'
import type { CollectedSourceDatasets } from '../types/internal'
import { queryDatasetView } from '@moluoxixi/config-form-model'

export function sourceDatasetViewKey(surfaceId: string, nodeId: string, bindingKey: string): string {
  return `${surfaceId}/${nodeId}/${bindingKey}`
}

function missingDatasetDiagnostic(
  surfaceId: string,
  nodeId: string,
  bindingKey: string,
  datasetId: string,
): ModelDiagnostic {
  return {
    code: 'dataset_projection_invalid',
    message: `Dataset binding references missing Dataset "${datasetId}".`,
    path: ['surfacesById', surfaceId, 'nodesById', nodeId, 'datasetBindings', bindingKey, 'datasetId'],
    surfaceId,
    nodeId,
    datasetId,
    context: { reason: 'dataset_missing' },
  }
}

export function collectSourceDatasets(
  compilation: ProjectCompilation,
): ContractResult<CollectedSourceDatasets> {
  const datasets: Record<string, readonly ModelJsonObject[]> = Object.fromEntries(compilation.ir.datasetOrder.map((datasetId) => {
    const dataset = compilation.ir.datasetsById[datasetId]
    return [datasetId, dataset?.rows.map(row => structuredClone(row) as ModelJsonObject) ?? []]
  }))
  const views: Record<string, {
    readonly items: readonly ModelJsonObject[]
    readonly total: number
  }> = {}
  for (const surfaceId of compilation.ir.surfaceOrder) {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      continue
    for (const nodeId of Object.keys(surface.nodesById).sort()) {
      const node = surface.nodesById[nodeId]
      if (!node?.datasetBindings)
        continue
      for (const [bindingKey, reference] of Object.entries(node.datasetBindings).sort(([left], [right]) => left.localeCompare(right))) {
        const dataset = compilation.ir.datasetsById[reference.datasetId]
        if (!dataset) {
          return {
            success: false,
            diagnostics: [missingDatasetDiagnostic(surfaceId, nodeId, bindingKey, reference.datasetId)],
          }
        }
        const projected = queryDatasetView(dataset, reference.projection, reference.query)
        if (!projected.success)
          return projected
        views[sourceDatasetViewKey(surfaceId, nodeId, bindingKey)] = {
          items: projected.data.items.map(row => structuredClone(row) as ModelJsonObject),
          total: projected.data.total,
        }
      }
    }
  }
  return { success: true, data: { datasets, views }, diagnostics: [] }
}
