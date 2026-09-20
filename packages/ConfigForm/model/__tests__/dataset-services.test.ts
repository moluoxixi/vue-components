import type {
  DatasetOptionsProjection,
  DatasetTableProjection,
  ProjectDataset,
  ProjectEmbeddedResource,
  ProjectUrlResource,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  createDatasetFromRows,
  queryDatasetView,
  readDatasetPath,
  readDatasetTransfer,
  readResourceTransfer,
  writeDatasetTransfer,
  writeResourceTransfer,
} from '../index'

const optionsProjection: DatasetOptionsProjection = {
  kind: 'options',
  labelPath: ['meta', 'label'],
  valuePath: ['id'],
  disabledPath: ['meta', 'disabled'],
}

function dataset(rows: ProjectDataset['rows']): ProjectDataset {
  return {
    id: 'people',
    name: 'People',
    rows,
  }
}

async function hash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))
  return `sha256:${[...digest].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

describe('dataset ingestion and transfer', () => {
  it('creates a current Dataset from raw object rows without sharing input values', () => {
    const rows = [{ id: 'a', nested: { flags: [true, false] } }]
    const created = createDatasetFromRows({ id: 'people', name: 'People', rows })
    expect(created).toEqual({
      success: true,
      diagnostics: [],
      data: { id: 'people', name: 'People', rows },
    })
    if (!created.success)
      return
    rows[0]!.nested.flags[0] = false
    expect(created.data.rows[0]).toEqual({ id: 'a', nested: { flags: [true, false] } })
  })

  it('rejects non-array roots and non-object rows with stable diagnostics', () => {
    expect(createDatasetFromRows({ id: 'people', name: 'People', rows: {} })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_rows_invalid', datasetId: 'people', path: ['rows'] }],
    })
    expect(createDatasetFromRows({ id: 'people', name: 'People', rows: [{ id: 1 }, []] })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_rows_invalid', datasetId: 'people', path: ['rows', 1] }],
    })
  })

  it('round-trips exact v1 envelopes and never treats raw rows as an envelope', () => {
    const source = dataset([{ id: 'a', nested: { value: 1 } }])
    const written = writeDatasetTransfer(source)
    expect(written).toMatchObject({
      success: true,
      data: { kind: 'config-form-dataset', version: 1, dataset: source },
    })
    if (!written.success)
      return
    expect(readDatasetTransfer(JSON.parse(JSON.stringify(written.data)))).toEqual(written)
    for (const input of [source.rows, { dataset: source }, { version: 0, dataset: source }, { version: 2, dataset: source }]) {
      expect(readDatasetTransfer(input)).toMatchObject({
        success: false,
        diagnostics: [{ code: 'unsupported_contract_version', context: { contract: 'DatasetTransfer' } }],
      })
    }
    expect(readDatasetTransfer({ ...written.data, extra: true })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_rows_invalid' }],
    })
  })
})

describe('dataset paths and projections', () => {
  it('reads nested own properties without exposing inherited or dangerous paths', () => {
    const row = Object.assign(Object.create({ inherited: 'hidden' }) as Record<string, unknown>, {
      nested: { value: 3 },
    })
    expect(readDatasetPath(row as never, ['nested', 'value'])).toEqual({ found: true, value: 3 })
    expect(readDatasetPath(row as never, ['inherited'])).toEqual({ found: false })
    expect(readDatasetPath(row as never, ['__proto__'])).toEqual({ found: false })
    expect(readDatasetPath(row as never, Array.from<string>({ length: 33 }).fill('x'))).toEqual({ found: false })
  })

  it('requires unique primitive option values and does not return partial output', () => {
    const valid = queryDatasetView(dataset([
      { id: 'a', meta: { label: 'Alpha', disabled: true } },
      { id: 2, meta: { label: 20 } },
    ]), optionsProjection)
    expect(valid).toEqual({
      success: true,
      diagnostics: [],
      data: {
        total: 2,
        items: [
          { label: 'Alpha', value: 'a', disabled: true },
          { label: '20', value: 2 },
        ],
      },
    })

    const invalidRows = [
      [{ id: 'same', meta: {} }, { id: 'same', meta: {} }],
      [{ meta: {} }],
      [{ id: null, meta: {} }],
      [{ id: true, meta: {} }],
      [{ id: {}, meta: {} }],
      [{ id: [], meta: {} }],
    ]
    for (const rows of invalidRows) {
      expect(queryDatasetView(dataset(rows), optionsProjection)).toMatchObject({
        success: false,
        diagnostics: [{ code: 'dataset_projection_invalid', datasetId: 'people' }],
      })
    }
  })

  it('filters, stably multi-sorts, and applies zero-based pagination without mutating input', () => {
    const rows = [
      { id: 'a', active: true, group: 'b', score: 1, nested: { source: 0 } },
      { id: 'b', active: false, group: 'a', score: 9, nested: { source: 1 } },
      { id: 'c', active: true, group: 'a', score: 2, nested: { source: 2 } },
      { id: 'd', active: true, group: 'a', score: 2, nested: { source: 3 } },
      { id: 'e', active: true, group: 'a', score: 1, nested: { source: 4 } },
    ]
    const before = structuredClone(rows)
    const projection: DatasetTableProjection = {
      kind: 'table',
      rowKeyPath: ['id'],
      columns: [
        { key: 'group', valuePath: ['group'] },
        { key: 'score', valuePath: ['score'] },
        { key: 'source', valuePath: ['nested', 'source'] },
      ],
    }
    const result = queryDatasetView(dataset(rows), projection, {
      filter: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['active'] } },
      sort: [
        { path: ['group'], direction: 'asc' },
        { path: ['score'], direction: 'desc' },
      ],
      page: { index: 0, size: 3 },
    })
    expect(result).toEqual({
      success: true,
      diagnostics: [],
      data: {
        total: 4,
        items: [
          { rowKey: 'c', group: 'a', score: 2, source: 2 },
          { rowKey: 'd', group: 'a', score: 2, source: 3 },
          { rowKey: 'e', group: 'a', score: 1, source: 4 },
        ],
      },
    })
    expect(rows).toEqual(before)
    if (result.success) {
      expect(Object.isFrozen(result.data.items)).toBe(true)
      expect(Object.isFrozen(result.data.items[0])).toBe(true)
    }
  })

  it('rejects invalid filter results, paths, and pagination', () => {
    const source = dataset([{ id: 'a', active: true, meta: { label: 'A' } }])
    expect(queryDatasetView(source, optionsProjection, {
      filter: { version: 1, ast: { kind: 'literal', value: 'yes' } },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_projection_invalid', context: { reason: 'filter_evaluation_invalid' } }],
    })
    expect(queryDatasetView(source, optionsProjection, {
      filter: {
        version: 1,
        ast: {
          kind: 'call',
          callee: 'coalesce',
          args: [
            { kind: 'reference', scope: 'values', path: ['active'] },
            { kind: 'literal', value: true },
          ],
        },
      },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_projection_invalid', context: { reason: 'filter_scope_invalid' } }],
    })
    expect(queryDatasetView(source, optionsProjection, {
      sort: [{ path: ['__proto__'], direction: 'asc' }],
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_projection_invalid', context: { reason: 'sort_rule_invalid' } }],
    })
    expect(queryDatasetView(source, optionsProjection, { page: { index: -1, size: 0 } })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'dataset_projection_invalid', context: { reason: 'page_invalid' } }],
    })
    expect(queryDatasetView(source, optionsProjection, { page: { index: 4, size: 10 } })).toEqual({
      success: true,
      diagnostics: [],
      data: { items: [], total: 1 },
    })
  })

  it('projects list fields through the same shared path implementation', () => {
    expect(queryDatasetView(dataset([{
      id: 'a',
      content: { title: 'Alpha', description: 'First' },
    }]), {
      kind: 'list',
      itemKeyPath: ['id'],
      titlePath: ['content', 'title'],
      descriptionPath: ['content', 'description'],
    })).toEqual({
      success: true,
      diagnostics: [],
      data: {
        total: 1,
        items: [{ itemKey: 'a', title: 'Alpha', description: 'First' }],
      },
    })
  })
})

describe('standalone Resource transfer', () => {
  it('round-trips embedded bytes with canonical base64 and isolated results', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const resource: ProjectEmbeddedResource = {
      id: 'logo',
      name: 'Logo',
      kind: 'embedded',
      fileName: 'logo.png',
      mediaType: 'image/png',
      byteLength: bytes.byteLength,
      contentHash: await hash(bytes),
    }
    const written = await writeResourceTransfer({ resource, bytes })
    expect(written).toMatchObject({
      success: true,
      data: {
        kind: 'config-form-resource',
        version: 1,
        payload: { resource, content: { encoding: 'base64', data: 'AQIDBA==' } },
      },
    })
    if (!written.success)
      return
    bytes[0] = 9
    const read = await readResourceTransfer(JSON.parse(JSON.stringify(written.data)))
    expect(read).toMatchObject({ success: true, data: { resource, bytes: new Uint8Array([1, 2, 3, 4]) } })
    if (read.success && 'bytes' in read.data) {
      read.data.bytes[0] = 8
      const again = await readResourceTransfer(written.data)
      expect(again).toMatchObject({ success: true, data: { bytes: new Uint8Array([1, 2, 3, 4]) } })
    }
  })

  it('round-trips URL metadata without accepting or creating content', async () => {
    const resource: ProjectUrlResource = {
      id: 'docs',
      name: 'Docs',
      kind: 'url',
      url: 'https://example.com/docs.pdf',
      mediaType: 'application/pdf',
    }
    const written = await writeResourceTransfer({ resource })
    expect(written).toEqual({
      success: true,
      diagnostics: [],
      data: { kind: 'config-form-resource', version: 1, payload: { resource } },
    })
    if (!written.success)
      return
    expect(await readResourceTransfer(written.data)).toEqual({
      success: true,
      diagnostics: [],
      data: { resource },
    })
    expect(await readResourceTransfer({
      ...written.data,
      payload: { resource, content: { encoding: 'base64', data: '' } },
    })).toMatchObject({ success: false, diagnostics: [{ code: 'resource_content_invalid' }] })
  })

  it('rejects wrong versions, non-canonical bytes, length mismatch, and hash mismatch', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const resource: ProjectEmbeddedResource = {
      id: 'logo',
      name: 'Logo',
      kind: 'embedded',
      fileName: 'logo.png',
      mediaType: 'image/png',
      byteLength: bytes.byteLength,
      contentHash: await hash(bytes),
    }
    for (const version of [undefined, 0, 2]) {
      expect(await readResourceTransfer({
        kind: 'config-form-resource',
        ...(version === undefined ? {} : { version }),
        payload: { resource, content: { encoding: 'base64', data: 'AQID' } },
      })).toMatchObject({
        success: false,
        diagnostics: [{ code: 'unsupported_contract_version', context: { contract: 'ResourceTransfer' } }],
      })
    }
    expect(await readResourceTransfer({
      kind: 'config-form-resource',
      version: 1,
      payload: { resource, content: { encoding: 'base64', data: 'AQI' } },
    })).toMatchObject({ success: false, diagnostics: [{ code: 'resource_content_invalid' }] })
    expect(await readResourceTransfer({
      kind: 'config-form-resource',
      version: 1,
      payload: { resource: { ...resource, byteLength: 2 }, content: { encoding: 'base64', data: 'AQID' } },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'resource_content_invalid', context: { reason: 'byte_length_mismatch' } }],
    })
    expect(await readResourceTransfer({
      kind: 'config-form-resource',
      version: 1,
      payload: {
        resource: { ...resource, contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' },
        content: { encoding: 'base64', data: 'AQID' },
      },
    })).toMatchObject({ success: false, diagnostics: [{ code: 'resource_content_invalid' }] })
  })

  it('fails closed for hostile structures and the standalone byte budget', async () => {
    const hostile = new Proxy({}, {
      has() {
        throw new Error('hostile version getter')
      },
    })
    await expect(readResourceTransfer(hostile)).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'resource_content_invalid' }],
    })

    const bytes = new Uint8Array(10 * 1024 * 1024 + 1)
    const oversized: ProjectEmbeddedResource = {
      id: 'large',
      name: 'Large',
      kind: 'embedded',
      fileName: 'large.bin',
      mediaType: 'application/octet-stream',
      byteLength: bytes.byteLength,
      contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    }
    await expect(writeResourceTransfer({ resource: oversized, bytes })).resolves.toMatchObject({
      success: false,
      diagnostics: [{
        code: 'resource_content_invalid',
        resourceId: 'large',
        context: { reason: 'resource_budget_exceeded' },
      }],
    })
  })
})
