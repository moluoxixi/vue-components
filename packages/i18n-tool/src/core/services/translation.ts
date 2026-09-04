import type { LanguageModel } from 'ai'
import type {
  I18nDiagnostic,
  TranslationBatch,
  TranslationCandidate,
  TranslationUnit,
  TranslationValidationResult,
} from '../types'
import { generateText } from 'ai'
import { z } from 'zod'
import { extractProtectedTokens, protectedTokensEqual } from '../utils'

const outputSchema = z.object({
  targetLocale: z.string().min(1),
  translations: z.array(z.object({
    id: z.string().min(1),
    value: z.string(),
  }).strict()),
}).strict()

export interface TranslationRequestEntry {
  id: string
  protectedTokens: ReturnType<typeof extractProtectedTokens>
  source: string
}

export interface TranslationRequest {
  entries: readonly TranslationRequestEntry[]
  targetLocale: string
}

export function createTranslationRequest(
  batch: TranslationBatch,
  targetLocale: string,
): TranslationRequest {
  return {
    entries: batch.units.map(unit => ({
      id: unit.id,
      protectedTokens: extractProtectedTokens(unit.value),
      source: unit.value,
    })),
    targetLocale,
  }
}

function modelDiagnostic(message: string, unitIds?: readonly string[]): I18nDiagnostic {
  return { code: 'MODEL_OUTPUT_INVALID', message, severity: 'error', unitIds }
}

function parseModelOutput(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value
}

export function validateTranslationOutput(
  value: unknown,
  expectedUnits: readonly TranslationUnit[],
  targetLocale: string,
): TranslationValidationResult {
  let parsed: unknown
  try {
    parsed = parseModelOutput(value)
  }
  catch {
    return { candidates: [], diagnostics: [modelDiagnostic('The model returned invalid JSON.')], ok: false }
  }

  const decoded = outputSchema.safeParse(parsed)
  if (!decoded.success) {
    return {
      candidates: [],
      diagnostics: [modelDiagnostic('The model output does not match the translation response schema.')],
      ok: false,
    }
  }
  if (decoded.data.targetLocale !== targetLocale) {
    return {
      candidates: [],
      diagnostics: [{
        code: 'TARGET_LOCALE_MISMATCH',
        message: `Expected target locale ${targetLocale}, received ${decoded.data.targetLocale}.`,
        severity: 'error',
      }],
      ok: false,
    }
  }

  const expected = new Map(expectedUnits.map(unit => [unit.id, unit]))
  const seen = new Set<string>()
  const diagnostics: I18nDiagnostic[] = []
  const candidates: TranslationCandidate[] = []
  const invalidUnitIds = new Set<string>()

  for (const translation of decoded.data.translations) {
    const unit = expected.get(translation.id)
    if (!unit) {
      diagnostics.push({
        code: 'UNEXPECTED_RESULT',
        message: `The model returned an unknown translation ID: ${translation.id}.`,
        severity: 'error',
        unitIds: [translation.id],
      })
      continue
    }
    if (seen.has(translation.id)) {
      diagnostics.push({
        code: 'DUPLICATE_RESULT',
        message: `The model returned duplicate translation ID: ${translation.id}.`,
        severity: 'error',
        unitIds: [translation.id],
      })
      invalidUnitIds.add(translation.id)
      continue
    }
    seen.add(translation.id)
    if (!protectedTokensEqual(unit.value, translation.value)) {
      diagnostics.push({
        code: 'TOKEN_MISMATCH',
        message: 'The translated value changed protected interpolation or structure tokens.',
        severity: 'error',
        unitIds: [translation.id],
      })
      invalidUnitIds.add(translation.id)
      continue
    }
    candidates.push({ sourceUnitId: unit.id, targetLocale, value: translation.value })
  }

  for (const unit of expectedUnits) {
    if (seen.has(unit.id))
      continue
    diagnostics.push({
      code: 'MISSING_RESULT',
      message: `The model omitted translation ID: ${unit.id}.`,
      severity: 'error',
      unitIds: [unit.id],
    })
    invalidUnitIds.add(unit.id)
  }

  const families = new Map<string, TranslationUnit[]>()
  for (const unit of expectedUnits) {
    if (!unit.semantics.family)
      continue
    const family = families.get(unit.semantics.family) ?? []
    family.push(unit)
    families.set(unit.semantics.family, family)
  }
  const invalidFamilies = new Set<string>()
  for (const [familyId, family] of families) {
    if (!family.some(unit => invalidUnitIds.has(unit.id)))
      continue
    invalidFamilies.add(familyId)
    diagnostics.push({
      code: 'FAMILY_INCOMPLETE',
      message: 'A plural or context family must be accepted as a complete set.',
      severity: 'error',
      unitIds: family.map(unit => unit.id),
    })
  }

  const validCandidates = candidates.filter((candidate) => {
    if (invalidUnitIds.has(candidate.sourceUnitId))
      return false
    const unit = expected.get(candidate.sourceUnitId)
    return !unit?.semantics.family || !invalidFamilies.has(unit.semantics.family)
  })
  return { candidates: validCandidates, diagnostics, ok: diagnostics.length === 0 }
}

const SYSTEM_PROMPT = `You translate structured internationalization entries.
Return exactly one JSON object with targetLocale and translations.
Each translation must preserve its opaque id and every protected token exactly.
Do not add, omit, merge, rename, or reorder semantic variants.`

export async function translateBatch(
  model: LanguageModel,
  batch: TranslationBatch,
  targetLocale: string,
  signal?: AbortSignal,
): Promise<TranslationValidationResult> {
  signal?.throwIfAborted()
  const request = createTranslationRequest(batch, targetLocale)
  const { text } = await generateText({
    abortSignal: signal,
    instructions: SYSTEM_PROMPT,
    model,
    prompt: JSON.stringify(request),
  })
  signal?.throwIfAborted()
  return validateTranslationOutput(text, batch.units, targetLocale)
}

export function selectRetryUnits(
  units: readonly TranslationUnit[],
  result: TranslationValidationResult,
): TranslationUnit[] {
  if (result.ok)
    return []
  const expectedIds = new Set(units.map(unit => unit.id))
  const failedIds = new Set(
    result.diagnostics
      .flatMap(diagnostic => diagnostic.unitIds ?? [])
      .filter(unitId => expectedIds.has(unitId)),
  )
  return failedIds.size === 0
    ? [...units]
    : units.filter(unit => failedIds.has(unit.id))
}
