import type { SourceInjectionOptions } from '../types'
import MagicString from 'magic-string'
import { collectImportSourceEdits, collectInjectionEdits, createScriptSegments, getDefaultPackageNames } from './edits'

const SUPPORTED_EXTENSIONS = /\.(?:[cm]?[jt]sx?|vue)$/

/** 清理 Vite 模块 id 的 query，并统一路径分隔符。 */
function cleanId(id: string): string {
  return id.split('?')[0].replace(/\\/g, '/')
}

/**
 * 向 defineField(...) 对象字面量注入源码位置元信息。
 *
 * Vue SFC 会按 script block 分段转换，确保行列号仍指向原始文件，而不是抽离后的脚本内容。
 */
export function transformDefineFieldSource(options: SourceInjectionOptions) {
  if (options.id.includes('?'))
    return null

  const id = cleanId(options.id)
  if (!SUPPORTED_EXTENSIONS.test(id))
    return null

  const packageNames = options.packageNames ?? getDefaultPackageNames()
  const segments = createScriptSegments(options.code, id)
  const edits = segments.flatMap(segment => [
    ...collectImportSourceEdits(segment, id, packageNames, options.adapterModuleId),
    ...collectInjectionEdits(segment, id, packageNames),
  ])

  if (edits.length === 0)
    return null

  const source = new MagicString(options.code)
  for (const edit of edits) {
    if (edit.end == null)
      source.appendLeft(edit.index, edit.text)
    else
      source.overwrite(edit.index, edit.end, edit.text)
  }

  return {
    code: source.toString(),
    map: source.generateMap({
      hires: true,
      source: id,
    }),
  }
}
