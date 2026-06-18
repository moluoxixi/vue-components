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
  it('提供 Markdown / JSON / PDF 三种导出格式', () => {
    expect(KNOWLEDGE_EXPORT_FORMATS.map(format => format.id)).toEqual(['markdown', 'json', 'pdf'])
    expect(KNOWLEDGE_EXPORT_FORMATS.every(format => format.icon)).toBe(true)
  })

  it('把组件详情导出为包含契约分区的 markdown', () => {
    const markdown = buildExportContent(detail, 'markdown')

    expect(markdown).toContain('# DemoButton')
    expect(markdown).toContain('演示按钮')
    expect(markdown).toContain('## Props')
    expect(markdown).toContain('| type |')
    expect(markdown).toContain('## Emits')
    expect(markdown).toContain('## Slots')
    expect(markdown).toContain('## v-model')
    expect(markdown).toContain('## 透传属性（$attrs）')
    expect(markdown).toContain('## 对外暴露（defineExpose）')
    expect(markdown).toContain('## 关联类型定义')
    expect(markdown).toContain('DemoButtonOptions')
  })

  it('导出 JSON 时保留完整结构化契约', () => {
    const json = JSON.parse(buildExportContent(detail, 'json'))

    expect(json.name).toBe('DemoButton')
    expect(json.props[0].name).toBe('type')
    expect(json.typeDefs[0].fields[0].description).toBe('显示文案')
  })

  it('markdown/json 通过浏览器下载，pdf 走打印窗口', () => {
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a')
        return anchor
      return Document.prototype.createElement.call(document, tagName)
    }) as typeof document.createElement)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const print = vi.fn()
    const close = vi.fn()
    const write = vi.fn()
    const closeDocument = vi.fn()
    const open = vi.spyOn(window, 'open').mockReturnValue({
      document: { write, close: closeDocument },
      focus: vi.fn(),
      print,
      close,
    } as unknown as Window)

    exportComponentDetail(detail, 'markdown')
    expect(anchor.download).toBe('DemoButton.md')
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)

    exportComponentDetail(detail, 'pdf')
    expect(open).toHaveBeenCalled()
    expect(write.mock.calls[0][0]).toContain('DemoButton')
    expect(print).toHaveBeenCalled()

    createElement.mockRestore()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    open.mockRestore()
  })
})
