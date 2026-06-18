import type { ComponentDetailResponse } from '../src/shared/protocol'
import { describe, expect, it, vi } from 'vitest'
import { buildExportContent, exportComponentDetail, KNOWLEDGE_EXPORT_FORMATS } from '../src/ui/export'

const detail: ComponentDetailResponse = {
  name: 'DemoButton',
  packageName: '@demo/components',
  description: '演示按钮',
  docPath: 'packages/components/src/DemoButton/index.vue',
  props: [
    {
      name: 'type',
      type: '\'primary\' | \'default\'',
      required: false,
      defaultValue: 'default',
      description: '按钮类型',
      typeRefs: [],
    },
  ],
  emits: [
    { name: 'click', payloadType: 'MouseEvent', description: '点击时触发', typeRefs: [] },
  ],
  slots: [
    { name: 'default', scopeType: '{}', description: '默认内容', typeRefs: [] },
  ],
  models: [{ name: 'modelValue', type: 'string' }],
  typeDefs: [
    {
      name: 'DemoButtonOptions',
      kind: 'interface',
      raw: 'export interface DemoButtonOptions { label: string }',
      fields: [{ name: 'label', type: 'string', optional: false, description: '显示文案' }],
    },
  ],
  attrs: [{ name: 'disabled', type: 'boolean', optional: true, description: '禁用状态' }],
  exposed: [{ name: 'focus', type: '() => void', description: '聚焦', typeRefs: [] }],
}

describe('knowledge base export', () => {
  it('知识库导出只提供普通 JSON', () => {
    expect(KNOWLEDGE_EXPORT_FORMATS.map(format => format.id)).toEqual(['json'])
    expect(KNOWLEDGE_EXPORT_FORMATS.every(format => format.icon)).toBe(true)
  })

  it('导出 JSON 时使用 ai-doc 知识库协议并保留完整结构化契约', () => {
    const json = JSON.parse(buildExportContent(detail, 'json'))

    expect(json).toMatchObject({
      protocol: 'ai-doc-knowledge',
      protocolVersion: 1,
      kind: 'component-detail',
      detail: {
        name: 'DemoButton',
        packageName: '@demo/components',
        description: '演示按钮',
        docPath: 'packages/components/src/DemoButton/index.vue',
      },
    })
    expect(json.detail.props[0].name).toBe('type')
    expect(json.detail.typeDefs[0].fields[0].description).toBe('显示文案')
  })

  it('json 通过浏览器下载', () => {
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a')
        return anchor
      return Document.prototype.createElement.call(document, tagName)
    }) as typeof document.createElement)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportComponentDetail(detail, 'json')
    expect(anchor.download).toBe('DemoButton.json')
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)

    createElement.mockRestore()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
  })
})
