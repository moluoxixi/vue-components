// @vitest-environment node
import type { ComponentDetailResponse, KnowledgeImportPayload } from '../src/shared/protocol'
import { describe, expect, it } from 'vitest'
import { componentDetailToContract, contractToDetail, importExternalContract, validateKnowledgeImportPayload } from '../src/core/knowledge-source'
import { KNOWLEDGE_IMPORT_PROTOCOL, KNOWLEDGE_IMPORT_PROTOCOL_VERSION } from '../src/shared/protocol'

function payload(name = 'DemoButton'): ComponentDetailResponse {
  return {
    name,
    packageName: '@external/ui',
    description: '外部按钮',
    docPath: 'external/DemoButton.md',
    props: [],
    emits: [],
    slots: [],
    models: [],
    typeDefs: [],
  }
}

describe('knowledge import protocol', () => {
  it('导入 JSON 不是普通组件详情结构时拒绝导入', () => {
    expect(() => validateKnowledgeImportPayload({ ...payload(), props: undefined } as unknown as ComponentDetailResponse))
      .toThrow(/detail\.props must be an array/)
  })

  it('普通 JSON 的契约字段不完整时拒绝导入', () => {
    const invalid = { ...payload(), props: [{ name: 'size', type: 'string' }] } as unknown as KnowledgeImportPayload

    expect(() => validateKnowledgeImportPayload(invalid))
      .toThrow(/detail\.props\[0\]\.required must be a boolean/)
  })

  it('协议化 JSON 的协议版本不一致时拒绝导入', () => {
    expect(() => validateKnowledgeImportPayload({
      protocol: KNOWLEDGE_IMPORT_PROTOCOL,
      protocolVersion: 2,
      kind: 'component-detail',
      detail: payload(),
    } as unknown as KnowledgeImportPayload)).toThrow(/protocolVersion must be 1/)
  })

  it('另一个组件库导出的协议化 JSON 可直接导入，但不读取导出方 docPath 为本地路径', () => {
    const envelope: KnowledgeImportPayload = {
      protocol: KNOWLEDGE_IMPORT_PROTOCOL,
      protocolVersion: KNOWLEDGE_IMPORT_PROTOCOL_VERSION,
      kind: 'component-detail',
      detail: {
        ...payload(),
        docPath: 'D:/other-component-library/packages/DemoButton.vue',
        source: 'internal',
        knowledgeSource: 'internal',
        knowledgeKey: 'internal:%40other%2Fui:DemoButton',
      } as ComponentDetailResponse,
    }

    expect(validateKnowledgeImportPayload(envelope)).toMatchObject({
      name: 'DemoButton',
      sourceFile: '',
      knowledgeSource: 'external',
      knowledgeKey: 'external:%40external%2Fui:DemoButton',
    })
  })

  it('普通 JSON 导入后固定标记为 external，且不会覆盖内部同名知识库', () => {
    const internal = componentDetailToContract(payload() as ComponentDetailResponse, 'internal')
    const first = importExternalContract(payload(), [internal], [])

    expect(first.result).toMatchObject({
      status: 'imported',
      key: 'external:%40external%2Fui:DemoButton',
      source: 'external',
      conflictsWithInternal: true,
    })
    expect(first.contracts).toHaveLength(1)
    expect(first.contracts[0]).toMatchObject({
      name: 'DemoButton',
      knowledgeSource: 'external',
      knowledgeKey: 'external:%40external%2Fui:DemoButton',
    })
    expect(internal.description).toBe('外部按钮')
  })

  it('外部导入允许携带导出的 docPath 字段，但不会读取为本地 sourceFile', () => {
    const imported = validateKnowledgeImportPayload({
      ...payload(),
      docPath: 'D:/external-project/packages/DemoButton.vue',
    })

    expect(imported.knowledgeSource).toBe('external')
    expect(imported.sourceFile).toBe('')
  })

  it('外部导入允许携带导出的 source/knowledgeKey 字段，但会重新按 external 生成本地 key', () => {
    const imported = validateKnowledgeImportPayload({
      ...payload(),
      source: 'internal',
      knowledgeSource: 'internal',
      knowledgeKey: 'internal:%40other%2Fui:DemoButton',
    } as unknown as KnowledgeImportPayload)

    expect(imported.knowledgeSource).toBe('external')
    expect(imported.knowledgeKey).toBe('external:%40external%2Fui:DemoButton')
  })

  it('重复导入外部知识库时先返回 conflict，用户确认 overwrite 后才覆盖外部项', () => {
    const first = importExternalContract(payload(), [], [])
    const changed: ComponentDetailResponse = { ...payload(), description: '外部按钮新说明' }

    const conflict = importExternalContract(changed, [], first.contracts)
    expect(conflict.result.status).toBe('conflict')
    expect(conflict.contracts[0].description).toBe('外部按钮')

    const overwritten = importExternalContract(changed, [], first.contracts, true)
    expect(overwritten.result.status).toBe('overwritten')
    expect(overwritten.contracts).toHaveLength(1)
    expect(overwritten.contracts[0].description).toBe('外部按钮新说明')
  })

  it('导出的普通 JSON 可直接导入，导入后仍然按 external 维护且不读取 docPath', () => {
    const contract = validateKnowledgeImportPayload(payload())
    const exportedJson = contractToDetail(contract, 'internal')

    expect(validateKnowledgeImportPayload(exportedJson)).toMatchObject({
      name: 'DemoButton',
      sourceFile: '',
      knowledgeSource: 'external',
      knowledgeKey: 'external:%40external%2Fui:DemoButton',
    })
  })
})
