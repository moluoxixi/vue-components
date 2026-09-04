import type {
  ModuleSpecifierContext,
  MonacoWorkerKind,
  NamedImportContext,
  VueScriptRange,
} from '../types'
import { WORKBENCH_MODULES } from '../constants'

export function mergeWorkbenchModules(moduleNames: readonly string[] = []): string[] {
  return [...new Set([...WORKBENCH_MODULES, ...moduleNames].filter(Boolean))]
}

export function resolveMonacoWorkerKind(label: string): MonacoWorkerKind {
  if (label === 'json')
    return 'json'
  if (label === 'typescript' || label === 'javascript')
    return 'typescript'
  if (label === 'html' || label === 'handlebars' || label === 'razor' || label === 'vue')
    return 'html'
  return 'editor'
}

export function findModuleSpecifierContext(source: string, offset: number): ModuleSpecifierContext | undefined {
  const safeOffset = clampOffset(source, offset)
  const beforeCursor = source.slice(0, safeOffset)
  const match = /(?:\bfrom\s+|\bimport\s*)['"]([^'"\r\n]*)$/.exec(beforeCursor)
  if (!match)
    return undefined

  const typed = match[1] ?? ''
  return {
    endOffset: safeOffset,
    startOffset: safeOffset - typed.length,
    typed,
  }
}

export function findNamedImportContext(source: string, offset: number): NamedImportContext | undefined {
  const safeOffset = clampOffset(source, offset)
  const pattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+(['"])([^'"\r\n]+)\2/g
  for (const match of source.matchAll(pattern)) {
    const statement = match[0]
    const statementStart = match.index
    const openingBrace = statement.indexOf('{')
    const closingBrace = statement.lastIndexOf('}')
    if (openingBrace < 0 || closingBrace < openingBrace)
      continue

    const startOffset = statementStart + openingBrace + 1
    const endOffset = statementStart + closingBrace
    if (safeOffset < startOffset || safeOffset > endOffset)
      continue

    return {
      endOffset,
      moduleName: match[3] ?? '',
      startOffset,
    }
  }
  return undefined
}

export function findVueScriptRanges(source: string): VueScriptRange[] {
  const ranges: VueScriptRange[] = []
  const pattern = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi
  for (const match of source.matchAll(pattern)) {
    const block = match[0]
    const openingTagEnd = block.indexOf('>')
    const closingTagStart = block.toLowerCase().lastIndexOf('</script')
    if (openingTagEnd < 0 || closingTagStart < openingTagEnd)
      continue
    ranges.push({
      endOffset: match.index + closingTagStart,
      startOffset: match.index + openingTagEnd + 1,
    })
  }
  return ranges
}

export function isOffsetInVueScript(source: string, offset: number): boolean {
  const safeOffset = clampOffset(source, offset)
  return findVueScriptRanges(source).some(range => safeOffset >= range.startOffset && safeOffset <= range.endOffset)
}

export function createVueTypeScriptMirror(source: string): string {
  const ranges = findVueScriptRanges(source)
  if (ranges.length === 0)
    return preserveLineBreaks(source)

  let mirror = ''
  let cursor = 0
  for (const range of ranges) {
    mirror += preserveLineBreaks(source.slice(cursor, range.startOffset))
    mirror += source.slice(range.startOffset, range.endOffset)
    cursor = range.endOffset
  }
  mirror += preserveLineBreaks(source.slice(cursor))
  return mirror
}

function preserveLineBreaks(value: string): string {
  return value.replace(/[^\r\n]/g, ' ')
}

function clampOffset(source: string, offset: number): number {
  return Math.max(0, Math.min(source.length, offset))
}
