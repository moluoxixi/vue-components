import type { LocaleAdapterId, TranslationUnit } from '../types'

function encodeSegments(segments: readonly string[]): string {
  return segments.map(segment => `${segment.length}:${segment}`).join('|')
}

export function createUnitId(input: {
  adapter: LocaleAdapterId
  locale: string
  namespace?: string
  path: readonly string[]
  resourceId: string
  sourceKey: string
}): string {
  return `i18n-unit-v1|${encodeSegments([
    input.adapter,
    input.resourceId,
    input.locale,
    input.namespace ?? '',
    ...input.path,
    input.sourceKey,
  ])}`
}

export function createMessageIdentity(unit: Pick<TranslationUnit, 'namespace' | 'path' | 'semantics' | 'sourceKey'>): string {
  return `i18n-message-v1|${encodeSegments([
    unit.semantics.adapter,
    unit.namespace ?? '',
    ...unit.path,
    unit.sourceKey,
  ])}`
}

export function createJsonPointer(path: readonly string[]): string {
  return path.length === 0
    ? ''
    : `/${path.map(segment => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
}

export function createFamilyIdentity(parts: readonly string[]): string {
  return `i18n-family-v1|${encodeSegments(parts)}`
}
