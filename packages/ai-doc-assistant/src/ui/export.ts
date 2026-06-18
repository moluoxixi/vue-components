import type { ComponentDetailResponse, KnowledgeImportPayload } from '../shared/protocol'
import { KNOWLEDGE_IMPORT_PROTOCOL, KNOWLEDGE_IMPORT_PROTOCOL_VERSION } from '../shared/protocol'

export type KnowledgeExportFormat = 'json'

export interface KnowledgeExportFormatOption {
  id: KnowledgeExportFormat
  label: string
  icon: string
  mime: string
  extension: string
}

export const KNOWLEDGE_EXPORT_FORMATS: KnowledgeExportFormatOption[] = [
  { id: 'json', label: 'JSON', icon: '🧩', mime: 'application/json;charset=utf-8', extension: 'json' },
]

export function buildKnowledgeImportPayload(detail: ComponentDetailResponse): KnowledgeImportPayload {
  return {
    protocol: KNOWLEDGE_IMPORT_PROTOCOL,
    protocolVersion: KNOWLEDGE_IMPORT_PROTOCOL_VERSION,
    kind: 'component-detail',
    detail,
  }
}

function sanitizeFilenameSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'component'
}

export function buildExportContent(detail: ComponentDetailResponse, format: KnowledgeExportFormat): string {
  void format
  return `${JSON.stringify(buildKnowledgeImportPayload(detail), null, 2)}\n`
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

export function exportComponentDetail(detail: ComponentDetailResponse, format: KnowledgeExportFormat): void {
  const option = KNOWLEDGE_EXPORT_FORMATS.find(item => item.id === format)
  const content = buildExportContent(detail, format)
  downloadText(filenameOf(detail, format), content, option?.mime ?? 'text/plain;charset=utf-8')
}

export function readKnowledgeImportFile(file: File): Promise<KnowledgeImportPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as KnowledgeImportPayload)
      }
      catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取导入文件失败'))
    reader.readAsText(file, 'utf-8')
  })
}
