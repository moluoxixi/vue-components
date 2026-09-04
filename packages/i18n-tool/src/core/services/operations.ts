import type {
  ChangeOperation,
  ChangePlan,
  I18nDiagnostic,
  LocaleAdapter,
  ResourceDocument,
  RoundTripResult,
  TranslationCandidate,
  TranslationGap,
} from '../types'
import { cloneJson, createJsonPointer, createUnitId, getJsonPath, serializeJson, setJsonPath } from '../utils'

export interface ChangePlanOptions {
  allowOverwrite?: boolean
  allowedOverwriteUnitIds?: ReadonlySet<string>
  targetLocale: string
  targetResourceId: string
}

export function planChangeOperations(
  adapter: LocaleAdapter,
  sourceDocument: ResourceDocument,
  gaps: readonly TranslationGap[],
  candidates: readonly TranslationCandidate[],
  options: ChangePlanOptions,
): ChangePlan {
  const candidatesById = new Map(candidates.map(candidate => [candidate.sourceUnitId, candidate]))
  const diagnostics: I18nDiagnostic[] = []
  const operations: ChangeOperation[] = []

  for (const gap of gaps) {
    const candidate = candidatesById.get(gap.source.id)
    if (!candidate || candidate.targetLocale !== options.targetLocale)
      continue
    if (
      gap.overwriteRequired
      && !options.allowOverwrite
      && !options.allowedOverwriteUnitIds?.has(gap.source.id)
    ) {
      diagnostics.push({
        code: 'OVERWRITE_REQUIRED',
        message: 'An existing non-empty translation requires explicit overwrite approval.',
        severity: 'error',
        unitIds: [gap.source.id],
      })
      continue
    }

    const path = adapter.targetPath(gap.source, options.targetLocale, sourceDocument)
    operations.push({
      after: candidate.value,
      before: gap.target?.value,
      jsonPointer: createJsonPointer(path),
      namespace: gap.source.namespace,
      overwriteRequired: gap.overwriteRequired,
      path,
      resourceId: options.targetResourceId,
      semantics: gap.source.semantics,
      sourceKey: gap.source.sourceKey,
      sourceUnitId: gap.source.id,
      targetLocale: options.targetLocale,
      targetUnitId: createUnitId({
        adapter: adapter.id,
        locale: options.targetLocale,
        namespace: gap.source.namespace,
        path: gap.source.path,
        resourceId: options.targetResourceId,
        sourceKey: gap.source.sourceKey,
      }),
      type: gap.target ? 'update' : 'create',
    })
  }
  return { diagnostics, operations }
}

function roundTripDiagnostic(message: string, document: ResourceDocument): I18nDiagnostic {
  return {
    code: 'ROUND_TRIP_MISMATCH',
    message,
    resourceId: document.resourceId,
    severity: 'error',
  }
}

function operationContractDiagnostics(
  adapter: LocaleAdapter,
  document: ResourceDocument,
  operations: readonly ChangeOperation[],
): I18nDiagnostic[] {
  const diagnostics: I18nDiagnostic[] = []
  if (adapter.id !== document.adapter) {
    diagnostics.push(roundTripDiagnostic(
      `Adapter ${adapter.id} cannot apply operations to ${document.adapter}.`,
      document,
    ))
    return diagnostics
  }

  for (const operation of operations) {
    const unitPath = document.layout === 'locale-first' ? operation.path.slice(1) : operation.path
    const expectedTargetId = createUnitId({
      adapter: adapter.id,
      locale: operation.targetLocale,
      namespace: operation.namespace,
      path: unitPath,
      resourceId: document.resourceId,
      sourceKey: operation.sourceKey,
    })
    const localeMatches = document.layout === 'locale-first'
      ? operation.path[0] === operation.targetLocale
      : document.locale === operation.targetLocale
    if (
      operation.resourceId !== document.resourceId
      || operation.jsonPointer !== createJsonPointer(operation.path)
      || operation.targetUnitId !== expectedTargetId
      || operation.semantics.adapter !== adapter.id
      || operation.semantics.layout !== document.layout
      || operation.semantics.keyStyle !== document.keyStyle
      || !localeMatches
    ) {
      diagnostics.push(roundTripDiagnostic(
        `Operation contract mismatch at ${operation.jsonPointer}.`,
        document,
      ))
    }
  }
  return diagnostics
}

function unitFingerprint(unit: ResourceDocument['units'][number]): string {
  return JSON.stringify({
    id: unit.id,
    locale: unit.locale,
    namespace: unit.namespace,
    origin: unit.origin,
    path: unit.path,
    semantics: unit.semantics,
    sourceKey: unit.sourceKey,
    value: unit.value,
  })
}

function formatPreserved(before: ResourceDocument, after: ResourceDocument): boolean {
  if (
    before.format.eol !== after.format.eol
    || before.format.indent !== after.format.indent
    || before.format.trailingNewline !== after.format.trailingNewline
  ) {
    return false
  }
  const beforeRootKeys = Object.keys(before.tree)
  const afterRootKeys = Object.keys(after.tree)
  return beforeRootKeys.every((key, index) => before.format.rootKeyOrder[index] === key)
    && afterRootKeys.every((key, index) => after.format.rootKeyOrder[index] === key)
    && beforeRootKeys.every((key, index) => afterRootKeys[index] === key)
}

export function applyOperationsAndValidate(
  adapter: LocaleAdapter,
  document: ResourceDocument,
  operations: readonly ChangeOperation[],
): RoundTripResult {
  const tree = cloneJson(document.tree)
  const diagnostics = operationContractDiagnostics(adapter, document, operations)
  if (diagnostics.length > 0)
    return { diagnostics }
  for (const operation of operations) {
    const current = getJsonPath(tree, operation.path)
    if (operation.before === undefined ? current !== undefined : current !== operation.before) {
      diagnostics.push(roundTripDiagnostic(`Baseline mismatch at ${operation.jsonPointer}.`, document))
      continue
    }
    if (!setJsonPath(tree, operation.path, operation.after))
      diagnostics.push(roundTripDiagnostic(`Unable to write ${operation.jsonPointer}.`, document))
  }
  if (diagnostics.length > 0)
    return { diagnostics }

  const content = serializeJson(tree, document.format)
  const reparsed = adapter.parse({
    adapterOptions: document.adapterOptions,
    content,
    keyStyle: document.keyStyle,
    layout: document.layout,
    locale: document.locale,
    namespace: document.namespace,
    relativePath: document.relativePath,
    resourceId: document.resourceId,
  })
  if (!reparsed.document || reparsed.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return {
      diagnostics: [
        ...reparsed.diagnostics,
        roundTripDiagnostic('The serialized resource cannot be parsed by the same adapter.', document),
      ],
    }
  }

  const targetedIds = new Set(operations.map(operation => operation.targetUnitId))
  const reparsedById = new Map(reparsed.document.units.map(unit => [unit.id, unit]))
  for (const unit of document.units) {
    if (targetedIds.has(unit.id))
      continue
    const reparsedUnit = reparsedById.get(unit.id)
    if (!reparsedUnit || unitFingerprint(reparsedUnit) !== unitFingerprint(unit))
      diagnostics.push(roundTripDiagnostic(`Unchanged unit drifted: ${unit.id}.`, document))
  }
  for (const operation of operations) {
    const unit = reparsedById.get(operation.targetUnitId)
    if (
      !unit
      || unit.value !== operation.after
      || unit.namespace !== operation.namespace
      || unit.sourceKey !== operation.sourceKey
      || JSON.stringify(unit.semantics) !== JSON.stringify(operation.semantics)
    ) {
      diagnostics.push(roundTripDiagnostic(`Planned unit is missing after serialization: ${operation.targetUnitId}.`, document))
    }
  }
  if (!formatPreserved(document, reparsed.document))
    diagnostics.push(roundTripDiagnostic('JSON formatting metadata drifted during round-trip.', document))

  return diagnostics.length > 0
    ? { diagnostics }
    : { content, diagnostics: [], document: reparsed.document }
}
