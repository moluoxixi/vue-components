import type { I18nextSemanticsOptions, TranslationUnitSemantics } from '../types'
import { createFamilyIdentity } from '../identity'
import { createJsonLocaleAdapter } from './json-adapter'

function resolveI18nextSemantics(
  path: readonly string[],
  sourceKey: string,
  options: I18nextSemanticsOptions = {},
  namespace?: string,
): Partial<TranslationUnitSemantics> {
  const separator = options.separator ?? '_'
  const pluralForms = options.pluralForms ?? []
  const segments = sourceKey.split(separator)
  const pluralForm = pluralForms.includes(segments.at(-1) ?? '') ? segments.pop() : undefined
  const context = options.contexts?.includes(segments.at(-1) ?? '') ? segments.pop() : undefined
  if (!pluralForm && !context)
    return {}

  const baseKey = segments.join(separator)
  const family = createFamilyIdentity([
    namespace ?? '',
    path.slice(0, -1).join('/'),
    baseKey,
  ])
  return {
    context,
    family,
    pluralForm,
    pluralGroup: pluralForm ? family : undefined,
  }
}

export const i18nextJsonAdapter = createJsonLocaleAdapter(
  'i18next-json',
  ['locale-per-file'],
  (path, sourceKey, input) => resolveI18nextSemantics(
    path,
    sourceKey,
    input.adapterOptions,
    input.namespace,
  ),
)
