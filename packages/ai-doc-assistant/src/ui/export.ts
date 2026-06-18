import type { ComponentDetailResponse, TypeDefWire } from '../shared/protocol'

export type KnowledgeExportFormat = 'markdown' | 'json' | 'pdf'

export interface KnowledgeExportFormatOption {
  id: KnowledgeExportFormat
  label: string
  icon: string
  mime: string
  extension: string
}

export const KNOWLEDGE_EXPORT_FORMATS: KnowledgeExportFormatOption[] = [
  { id: 'markdown', label: 'Markdown', icon: '📝', mime: 'text/markdown;charset=utf-8', extension: 'md' },
  { id: 'json', label: 'JSON', icon: '🧩', mime: 'application/json;charset=utf-8', extension: 'json' },
  { id: 'pdf', label: 'PDF', icon: '📄', mime: 'text/html;charset=utf-8', extension: 'pdf' },
]

export interface PreparedPdfExport {
  fill: (detail: ComponentDetailResponse) => void
  fail: (message: string) => void
}

function openPdfWindow(): Window | null {
  return window.open('', '_blank')
}

function writePdfWindow(target: Window, detail: ComponentDetailResponse): void {
  const markdown = buildExportContent(detail, 'markdown')
  target.document.write(markdownToPrintableHtml(markdown, detail.name))
  target.document.close()
  target.focus()
  target.print()
}

export function preparePdfExport(): PreparedPdfExport {
  const target = openPdfWindow()
  if (!target)
    throw new Error('无法打开 PDF 打印窗口，请检查浏览器弹窗拦截设置')
  target.document.write('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>准备导出 PDF</title></head><body>正在准备 PDF 导出…</body></html>')
  target.document.close()
  return {
    fill(detail) {
      writePdfWindow(target, detail)
    },
    fail(message) {
      target.document.open()
      target.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>导出失败</title></head><body>${escapeHtml(message)}</body></html>`)
      target.document.close()
    },
  }
}

function sanitizeFilenameSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'component'
}

function escapeMarkdownCell(value: unknown): string {
  const text = value === null || value === undefined || value === '' ? '—' : String(value)
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function table(headers: string[], rows: unknown[][]): string {
  if (!rows.length)
    return ''
  return [
    `| ${headers.map(escapeMarkdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(escapeMarkdownCell).join(' | ')} |`),
  ].join('\n')
}

function typeDefBlock(typeDef: TypeDefWire): string {
  const fieldTable = table(
    ['字段', '类型', '可选', '说明'],
    typeDef.fields.map(field => [field.name, field.type, field.optional ? '是' : '否', field.description]),
  )
  return [
    `### ${typeDef.name}`,
    '',
    `- 类型：${typeDef.kind}`,
    '',
    fieldTable || '无字段明细。',
    '',
    '```ts',
    typeDef.raw || `// ${typeDef.name}`,
    '```',
  ].join('\n')
}

export function buildExportContent(detail: ComponentDetailResponse, format: KnowledgeExportFormat): string {
  if (format === 'json')
    return `${JSON.stringify(detail, null, 2)}\n`

  const sections = [
    `# ${detail.name}`,
    '',
    `- 包名：${detail.packageName}`,
    `- 来源：${detail.docPath}`,
    '',
    detail.description || '无组件说明。',
  ]

  const propsTable = table(
    ['名称', '类型', '必填', '默认值', '说明'],
    detail.props.map(prop => [prop.name, prop.type, prop.required ? '是' : '否', prop.defaultValue, prop.description]),
  )
  if (propsTable)
    sections.push('', '## Props', '', propsTable)

  const emitsTable = table(
    ['事件', '载荷类型', '说明'],
    detail.emits.map(emit => [emit.name, emit.payloadType, emit.description]),
  )
  if (emitsTable)
    sections.push('', '## Emits', '', emitsTable)

  const slotsTable = table(
    ['名称', '作用域类型', '说明'],
    detail.slots.map(slot => [slot.name, slot.scopeType, slot.description]),
  )
  if (slotsTable)
    sections.push('', '## Slots', '', slotsTable)

  const modelsTable = table(
    ['名称', '类型'],
    detail.models.map(model => [model.name, model.type]),
  )
  if (modelsTable)
    sections.push('', '## v-model', '', modelsTable)

  const attrsTable = table(
    ['名称', '类型', '可选', '说明'],
    (detail.attrs ?? []).map(attr => [attr.name, attr.type, attr.optional ? '是' : '否', attr.description]),
  )
  if (attrsTable)
    sections.push('', '## 透传属性（$attrs）', '', attrsTable)

  const exposedTable = table(
    ['名称', '类型', '说明'],
    (detail.exposed ?? []).map(expose => [expose.name, expose.type, expose.description]),
  )
  if (exposedTable)
    sections.push('', '## 对外暴露（defineExpose）', '', exposedTable)

  if (detail.typeDefs.length)
    sections.push('', '## 关联类型定义', '', ...detail.typeDefs.map(typeDefBlock))

  return `${sections.join('\n')}\n`
}

function filenameOf(detail: ComponentDetailResponse, format: KnowledgeExportFormat): string {
  const option = KNOWLEDGE_EXPORT_FORMATS.find(item => item.id === format)
  return `${sanitizeFilenameSegment(detail.name)}.${option?.extension ?? format}`
}

function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markdownToPrintableHtml(markdown: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; line-height: 1.55; padding: 32px; }
    pre { white-space: pre-wrap; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <pre>${escapeHtml(markdown)}</pre>
</body>
</html>`
}

function printPdf(detail: ComponentDetailResponse): void {
  const target = openPdfWindow()
  if (!target)
    throw new Error('无法打开 PDF 打印窗口，请检查浏览器弹窗拦截设置')
  writePdfWindow(target, detail)
}

export function exportComponentDetail(detail: ComponentDetailResponse, format: KnowledgeExportFormat): void {
  if (format === 'pdf') {
    printPdf(detail)
    return
  }

  const option = KNOWLEDGE_EXPORT_FORMATS.find(item => item.id === format)
  const content = buildExportContent(detail, format)
  downloadText(filenameOf(detail, format), content, option?.mime ?? 'text/plain;charset=utf-8')
}
