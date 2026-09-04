import type {
  I18nDiagnostic,
  TranslationBatch,
  TranslationBatchPlan,
  TranslationGap,
  TranslationUnit,
} from '../types'
import { createFamilyIdentity, createMessageIdentity } from '../utils'

export const DEFAULT_TRANSLATION_BATCH_MAX_UNITS = 50
export const DEFAULT_TRANSLATION_BATCH_MAX_CHARACTERS = 20_000

export interface TranslationBatchLimits {
  maxCharacters?: number
  maxUnits?: number
}

export function analyzeTranslationGaps(
  sourceUnits: readonly TranslationUnit[],
  targetUnits: readonly TranslationUnit[],
  targetLocale: string,
): TranslationGap[] {
  const targets = new Map(
    targetUnits
      .filter(unit => unit.locale === targetLocale)
      .map(unit => [createMessageIdentity(unit), unit]),
  )

  return sourceUnits.map((source) => {
    const target = targets.get(createMessageIdentity(source))
    const status = !target ? 'missing' : target.value.trim() ? 'existing' : 'empty'
    return {
      overwriteRequired: status === 'existing',
      source,
      status,
      target,
      targetLocale,
    }
  })
}

function batchGroupKey(unit: TranslationUnit): string {
  return unit.semantics.family
    ? createFamilyIdentity([unit.origin.resourceId, unit.locale, unit.semantics.family])
    : createFamilyIdentity([unit.id])
}

function batchId(units: readonly TranslationUnit[]): string {
  return createFamilyIdentity(units.map(unit => unit.id))
}

function batchScope(unit: TranslationUnit): string {
  return createFamilyIdentity([unit.origin.resourceId, unit.locale])
}

export function planTranslationBatches(
  units: readonly TranslationUnit[],
  limits: TranslationBatchLimits = {},
): TranslationBatchPlan {
  const maxCharacters = limits.maxCharacters ?? DEFAULT_TRANSLATION_BATCH_MAX_CHARACTERS
  const maxUnits = limits.maxUnits ?? DEFAULT_TRANSLATION_BATCH_MAX_UNITS
  const groups = new Map<string, TranslationUnit[]>()
  for (const unit of units) {
    const key = batchGroupKey(unit)
    const group = groups.get(key) ?? []
    group.push(unit)
    groups.set(key, group)
  }

  const diagnostics: I18nDiagnostic[] = []
  const batches: TranslationBatch[] = []
  let current: TranslationUnit[] = []
  let currentCharacters = 0
  let currentScope: string | undefined
  const flush = () => {
    if (current.length === 0)
      return
    batches.push({ id: batchId(current), units: current })
    current = []
    currentCharacters = 0
    currentScope = undefined
  }

  for (const group of groups.values()) {
    const groupCharacters = group.reduce((total, unit) => total + unit.value.length, 0)
    const groupScope = batchScope(group[0])
    if (group.length > maxUnits || groupCharacters > maxCharacters) {
      diagnostics.push({
        code: 'BATCH_LIMIT_EXCEEDED',
        message: 'A translation family exceeds the configured batch limits and cannot be split safely.',
        severity: 'error',
        unitIds: group.map(unit => unit.id),
      })
      continue
    }
    if (currentScope && currentScope !== groupScope)
      flush()
    if (current.length + group.length > maxUnits || currentCharacters + groupCharacters > maxCharacters)
      flush()
    currentScope = groupScope
    current.push(...group)
    currentCharacters += groupCharacters
  }
  flush()

  return { batches, diagnostics }
}
