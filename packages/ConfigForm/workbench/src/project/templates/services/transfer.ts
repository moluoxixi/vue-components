import type { ProjectTemplateSeed } from '../types'
import { parseProjectTemplateSeed } from './catalog'

export const TEMPLATE_ARCHIVE_MAX_BYTES = 5 * 1024 * 1024
const MAX_TEMPLATES = 256

/** One format for individual templates and a complete personal library. */
export function parseTemplateArchive(input: unknown): ProjectTemplateSeed[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Expected a ConfigForm template archive / 请导入 ConfigForm 模板备份。')
  const archive = input as Record<string, unknown>
  if (archive.kind !== 'config-form-template-library' || archive.version !== 1 || !Array.isArray(archive.templates) || archive.templates.length < 1 || archive.templates.length > MAX_TEMPLATES)
    throw new TypeError('Invalid template archive (1–256 templates, version 1) / 模板备份格式不正确。')
  const templates = archive.templates.map((entry) => {
    const parsed = parseProjectTemplateSeed(entry, 'personal')
    if ('code' in parsed)
      throw new TypeError(`${parsed.code}: ${parsed.message}`)
    return { manifest: parsed.manifest, surface: parsed.surface }
  })
  if (new Set(templates.map(entry => entry.manifest.id)).size !== templates.length)
    throw new TypeError('Duplicate template IDs / 备份包含重复的模板标识。')
  return templates
}

export function serializeTemplateArchive(templates: readonly ProjectTemplateSeed[]): string {
  const archive = { kind: 'config-form-template-library', version: 1, templates: templates.map(({ manifest, surface }) => ({ manifest, surface })) }
  parseTemplateArchive(archive)
  const text = `${JSON.stringify(archive, null, 2)}\n`
  if (new TextEncoder().encode(text).length > TEMPLATE_ARCHIVE_MAX_BYTES)
    throw new TypeError('Export fewer templates (limit 5 MB) / 请分批导出模板，文件上限为 5 MB。')
  return text
}
