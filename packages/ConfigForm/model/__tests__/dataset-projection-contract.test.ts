import type { DatasetTableProjection } from '../index'
import { describe, expect, it } from 'vitest'
import { parseProjectDocument, queryDatasetView, readDatasetTransfer } from '../index'
import { documentFixture } from './test-fixtures'

function tableProjection(duplicate: boolean): DatasetTableProjection {
  return {
    kind: 'table',
    rowKeyPath: ['id'],
    columns: [
      { key: 'amount', valuePath: ['amount'] },
      { key: duplicate ? 'amount' : 'total', valuePath: ['total'] },
    ],
  }
}

describe('dataset table projection column identity', () => {
  it.each([false, true])('validates node binding columns at the project reader boundary (duplicate: %s)', (duplicate) => {
    const document = documentFixture({
      datasetOrder: ['orders'],
      datasetsById: { orders: { id: 'orders', name: 'Orders', rows: [] } },
    })
    document.surfacesById.home!.graph.nodesById.name!.datasetBindings = {
      rows: { datasetId: 'orders', projection: tableProjection(duplicate) },
    }

    const parsed = parseProjectDocument(JSON.parse(JSON.stringify(document)))
    expect(parsed.success).toBe(!duplicate)
    if (!parsed.success) {
      expect(parsed.diagnostics.some(diagnostic => diagnostic.path?.includes('columns'))).toBe(true)
    }
  })

  it('rejects duplicate column keys in Dataset transfer defaults and direct queries', () => {
    const dataset = { id: 'orders', name: 'Orders', rows: [{ id: 'one', amount: 10, total: 20 }] }
    const projection = tableProjection(true)
    expect(readDatasetTransfer({
      kind: 'config-form-dataset',
      version: 1,
      dataset: { ...dataset, defaultProjection: projection },
    }).success).toBe(false)
    expect(queryDatasetView(dataset, projection)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_projection_invalid' }],
    })
    expect(queryDatasetView(dataset, tableProjection(false))).toMatchObject({
      success: true,
      data: { items: [{ rowKey: 'one', amount: 10, total: 20 }] },
    })
  })
})
