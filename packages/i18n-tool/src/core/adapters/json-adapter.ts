import type {
  I18nDiagnostic,
  JsonKeyStyle,
  JsonObject,
  JsonValue,
  LocaleAdapter,
  LocaleAdapterId,
  ParseResourceInput,
  ParseResourceResult,
  ResourceDocument,
  TargetResourceDescriptor,
  TargetResourcePlan,
  TranslationUnit,
  TranslationUnitSemantics,
} from '../types'
import { createJsonPointer, createUnitId } from '../identity'
import { isJsonObject, parseJsonSource } from '../json'

export type SemanticsResolver = (
  path: readonly string[],
  sourceKey: string,
  input: ParseResourceInput,
) => Partial<TranslationUnitSemantics>

function diagnostic(
  code: I18nDiagnostic['code'],
  message: string,
  input: ParseResourceInput,
  path?: readonly string[],
): I18nDiagnostic {
  return { code, message, path, resourceId: input.resourceId, severity: 'error' }
}

function createUnit(
  adapter: LocaleAdapterId,
  input: ParseResourceInput,
  locale: string,
  path: readonly string[],
  pointerPath: readonly string[],
  value: string,
  resolveSemantics: SemanticsResolver,
): TranslationUnit {
  const sourceKey = path.at(-1) ?? ''
  const keyStyle = input.keyStyle ?? 'nested'
  return {
    id: createUnitId({
      adapter,
      locale,
      namespace: input.namespace,
      path,
      resourceId: input.resourceId,
      sourceKey,
    }),
    locale,
    namespace: input.namespace,
    path,
    semantics: {
      adapter,
      keyStyle,
      layout: input.layout,
      ...resolveSemantics(path, sourceKey, input),
    },
    sourceKey,
    value,
    origin: {
      jsonPointer: createJsonPointer(pointerPath),
      relativePath: input.relativePath,
      resourceId: input.resourceId,
    },
  }
}

function walkNested(
  adapter: LocaleAdapterId,
  input: ParseResourceInput,
  locale: string,
  value: JsonValue,
  path: readonly string[],
  pointerPrefix: readonly string[],
  diagnostics: I18nDiagnostic[],
  units: TranslationUnit[],
  resolveSemantics: SemanticsResolver,
): void {
  if (typeof value === 'string') {
    units.push(createUnit(adapter, input, locale, path, [...pointerPrefix, ...path], value, resolveSemantics))
    return
  }

  if (!isJsonObject(value)) {
    diagnostics.push(diagnostic(
      'UNSUPPORTED_LEAF',
      'Only string locale values are supported in the MVP.',
      input,
      path,
    ))
    return
  }

  for (const [key, child] of Object.entries(value))
    walkNested(adapter, input, locale, child, [...path, key], pointerPrefix, diagnostics, units, resolveSemantics)
}

function walkFlat(
  adapter: LocaleAdapterId,
  input: ParseResourceInput,
  locale: string,
  value: JsonObject,
  pointerPrefix: readonly string[],
  diagnostics: I18nDiagnostic[],
  units: TranslationUnit[],
  resolveSemantics: SemanticsResolver,
): void {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child !== 'string') {
      diagnostics.push(diagnostic(
        'MIXED_KEY_STYLE',
        'Flat JSON resources may contain only string values at the root.',
        input,
        [key],
      ))
      continue
    }
    units.push(createUnit(adapter, input, locale, [key], [...pointerPrefix, key], child, resolveSemantics))
  }
}

function addAmbiguityDiagnostics(
  input: ParseResourceInput,
  units: readonly TranslationUnit[],
  diagnostics: I18nDiagnostic[],
): void {
  if ((input.keyStyle ?? 'nested') !== 'nested')
    return

  const pathsByLogicalKey = new Map<string, string>()
  for (const unit of units) {
    const logicalKey = unit.path.join('.')
    const encodedPath = JSON.stringify(unit.path)
    const existingPath = pathsByLogicalKey.get(logicalKey)
    if (existingPath && existingPath !== encodedPath) {
      diagnostics.push(diagnostic(
        'AMBIGUOUS_KEY',
        `Nested and literal dotted keys collide at ${logicalKey}.`,
        input,
        unit.path,
      ))
    }
    else {
      pathsByLogicalKey.set(logicalKey, encodedPath)
    }
  }
}

export function parseJsonResource(
  adapter: LocaleAdapterId,
  input: ParseResourceInput,
  supportedLayouts: readonly ParseResourceInput['layout'][],
  resolveSemantics: SemanticsResolver = () => ({}),
): ParseResourceResult {
  if (!supportedLayouts.includes(input.layout)) {
    return {
      diagnostics: [diagnostic('UNSUPPORTED_LAYOUT', `${adapter} does not support ${input.layout}.`, input)],
    }
  }

  const parsed = parseJsonSource(input.content, input.resourceId)
  if (!parsed.tree || !parsed.format)
    return { diagnostics: parsed.diagnostics }

  const diagnostics = [...parsed.diagnostics]
  const units: TranslationUnit[] = []
  const keyStyle: JsonKeyStyle = input.keyStyle ?? 'nested'
  const scanLocale = (locale: string, value: JsonValue, pointerPrefix: readonly string[]) => {
    if (!isJsonObject(value)) {
      diagnostics.push(diagnostic('ROOT_NOT_OBJECT', `Locale ${locale} must contain a JSON object.`, input, pointerPrefix))
      return
    }
    if (keyStyle === 'flat')
      walkFlat(adapter, input, locale, value, pointerPrefix, diagnostics, units, resolveSemantics)
    else
      walkNested(adapter, input, locale, value, [], pointerPrefix, diagnostics, units, resolveSemantics)
  }

  if (input.layout === 'locale-first') {
    for (const [locale, value] of Object.entries(parsed.tree))
      scanLocale(locale, value, [locale])
  }
  else if (!input.locale) {
    diagnostics.push(diagnostic('LOCALE_REQUIRED', 'Locale-per-file resources require an explicit locale.', input))
  }
  else {
    scanLocale(input.locale, parsed.tree, [])
  }

  addAmbiguityDiagnostics(input, units, diagnostics)
  const document: ResourceDocument = {
    adapter,
    adapterOptions: input.adapterOptions,
    diagnostics,
    format: parsed.format,
    keyStyle,
    layout: input.layout,
    locale: input.locale,
    namespace: input.namespace,
    relativePath: input.relativePath,
    resourceId: input.resourceId,
    tree: parsed.tree,
    units,
  }
  return { diagnostics, document }
}

export function targetJsonPath(
  source: TranslationUnit,
  targetLocale: string,
  document: ResourceDocument,
): readonly string[] {
  return document.layout === 'locale-first'
    ? [targetLocale, ...source.path]
    : source.path
}

function planJsonTarget(
  adapter: LocaleAdapterId,
  source: ResourceDocument,
  targetLocale: string,
  target: TargetResourceDescriptor,
): TargetResourcePlan {
  const diagnostics: I18nDiagnostic[] = []
  if (source.adapter !== adapter) {
    diagnostics.push({
      code: 'TARGET_PLAN_INVALID',
      message: `Adapter ${adapter} cannot plan a target for ${source.adapter}.`,
      resourceId: source.resourceId,
      severity: 'error',
    })
  }
  if ((target.namespace ?? source.namespace) !== source.namespace) {
    diagnostics.push({
      code: 'TARGET_PLAN_INVALID',
      message: 'The target namespace must match the source namespace.',
      resourceId: source.resourceId,
      severity: 'error',
    })
  }
  if (source.layout === 'locale-first' && (
    target.resourceId !== source.resourceId || target.relativePath !== source.relativePath
  )) {
    diagnostics.push({
      code: 'TARGET_PLAN_INVALID',
      message: 'Locale-first resources must add target locales to the same document.',
      resourceId: source.resourceId,
      severity: 'error',
    })
  }
  if (diagnostics.length > 0)
    return { diagnostics }

  if (source.layout === 'locale-first')
    return { diagnostics: [], document: source }

  return {
    diagnostics: [],
    document: {
      ...source,
      diagnostics: [],
      format: { ...source.format, rootKeyOrder: [] },
      locale: targetLocale,
      namespace: target.namespace ?? source.namespace,
      relativePath: target.relativePath,
      resourceId: target.resourceId,
      tree: Object.create(null),
      units: [],
    },
  }
}

export function createJsonLocaleAdapter(
  id: LocaleAdapterId,
  supportedLayouts: readonly ParseResourceInput['layout'][],
  resolveSemantics?: SemanticsResolver,
): LocaleAdapter {
  return {
    id,
    parse: input => parseJsonResource(id, input, supportedLayouts, resolveSemantics),
    planTarget: (source, targetLocale, target) => planJsonTarget(id, source, targetLocale, target),
    targetPath: targetJsonPath,
  }
}
