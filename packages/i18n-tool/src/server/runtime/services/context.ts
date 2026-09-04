import type { LanguageModelTarget } from '@moluoxixi/ai-provider/server'
import type { LanguageModel } from 'ai'
import type { ResolvedI18nToolConfig } from '../../../config'
import type { LocaleAdapter, ResourceDocument, TranslationCandidate, TranslationUnit } from '../../../core'
import type {
  ApplyResponse,
  PreviewFileWire,
  PreviewRequest,
  PreviewResponse,
  SanitizedConfigResponse,
  ScanResponse,
  TranslateRequest,
  TranslateSseEvent,
} from '../../../shared/protocol'
import type { PathGuard } from '../../filesystem'
import type { ScanSnapshot } from '../../resources'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { createLanguageModel } from '@moluoxixi/ai-provider/server'
import {
  analyzeTranslationGaps,
  applyOperationsAndValidate,
  defaultLocaleAdapterRegistry,
  planChangeOperations,
  planTranslationBatches,
  translateBatch,
  validateTranslationOutput,
} from '../../../core'
import { I18nToolError } from '../../errors'
import { createPathGuard, writeTextAtomically } from '../../filesystem'
import { hashContent, scanWorkspace, targetRelativePath } from '../../resources'

type AtomicWriter = typeof writeTextAtomically

const PREVIEW_TTL_MS = 15 * 60 * 1_000
interface PreviewInternalFile {
  absolutePath: string
  adapter: LocaleAdapter
  after: string
  baselineHash?: string
  before: string
  operations: PreviewFileWire['operations']
  relativePath: string
  resourceId: string
  resultDocument: ResourceDocument
  targetDocument: ResourceDocument
  type: PreviewFileWire['type']
}

interface PreviewEntry {
  applying: boolean
  createdAt: number
  files: readonly PreviewInternalFile[]
  scanId: string
  used: boolean
}

export interface ServerContextOptions {
  config: ResolvedI18nToolConfig
  env?: Readonly<Record<string, string | undefined>>
  model?: LanguageModel
  now?: () => number
  writeText?: AtomicWriter
}

function loadI18nLanguageModelTarget(
  config: ResolvedI18nToolConfig,
  env: Readonly<Record<string, string | undefined>>,
): LanguageModelTarget | null {
  const apiKey = env[config.ai.apiKeyEnv]
  if (!apiKey?.trim())
    return null

  if (config.ai.provider === 'openai-compatible') {
    return {
      apiKey,
      baseURL: config.ai.baseUrl,
      model: config.ai.model,
      provider: config.ai.provider,
    }
  }
  return {
    apiKey,
    model: config.ai.model,
    provider: config.ai.provider,
  }
}

function textDiff(before: string, after: string): string {
  if (before === after)
    return ''
  const removed = before ? before.split(/\r?\n/).map(line => `-${line}`) : []
  const added = after.split(/\r?\n/).map(line => `+${line}`)
  return ['--- before', '+++ after', ...removed, ...added].join('\n')
}

async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
      return undefined
    throw error
  }
}

function groupByResource(units: readonly TranslationUnit[]): Map<string, TranslationUnit[]> {
  const groups = new Map<string, TranslationUnit[]>()
  for (const unit of units) {
    const group = groups.get(unit.origin.resourceId) ?? []
    group.push(unit)
    groups.set(unit.origin.resourceId, group)
  }
  return groups
}

function comparablePath(value: string): string {
  const absolute = resolve(value)
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

function validatePreviewLimits(
  config: ResolvedI18nToolConfig,
  snapshot: ScanSnapshot,
  files: readonly PreviewInternalFile[],
): void {
  const existingByPath = new Map(
    [...snapshot.resources.values()].map(resource => [comparablePath(resource.absolutePath), resource]),
  )
  const createdPaths = new Set(
    files
      .filter(file => !existingByPath.has(comparablePath(file.absolutePath)))
      .map(file => comparablePath(file.absolutePath)),
  )
  const fileCount = snapshot.resources.size + createdPaths.size
  let totalBytes = [...snapshot.resources.values()]
    .reduce((total, resource) => total + Buffer.byteLength(resource.content), 0)
  let totalKeys = [...snapshot.resources.values()]
    .reduce((total, resource) => total + resource.document.units.length, 0)
  for (const file of files) {
    const existing = existingByPath.get(comparablePath(file.absolutePath))
    totalBytes += Buffer.byteLength(file.after) - (existing ? Buffer.byteLength(existing.content) : 0)
    totalKeys += file.resultDocument.units.length - (existing?.document.units.length ?? 0)
  }
  if (fileCount > config.limits.files || totalBytes > config.limits.totalBytes || totalKeys > config.limits.keys) {
    throw new I18nToolError(
      'LIMIT_EXCEEDED',
      'The preview result exceeds the configured workspace limits.',
      413,
    )
  }
}

export class ServerContext {
  readonly config: ResolvedI18nToolConfig
  readonly languageModel: LanguageModel | null
  readonly pathGuard: Promise<PathGuard>
  private readonly now: () => number
  private readonly writeText: AtomicWriter
  private readonly scans = new Map<string, ScanSnapshot>()
  private readonly previews = new Map<string, PreviewEntry>()
  private readonly applyLocks = new Set<string>()
  private activeTranslations = 0
  private activeApplies = 0

  constructor(options: ServerContextOptions) {
    this.config = options.config
    this.now = options.now ?? Date.now
    this.writeText = options.writeText ?? writeTextAtomically
    this.pathGuard = createPathGuard(options.config.root)
    const target = loadI18nLanguageModelTarget(options.config, options.env ?? process.env)
    this.languageModel = target ? options.model ?? createLanguageModel(target) : null
  }

  sanitizedConfig(): SanitizedConfigResponse {
    const ai = {
      model: this.config.ai.model,
      provider: this.config.ai.provider,
      status: this.languageModel ? 'configured' as const : 'missing' as const,
      ...(this.config.ai.provider === 'openai-compatible'
        ? { baseUrl: this.config.ai.baseUrl }
        : {}),
    } as SanitizedConfigResponse['ai']
    return {
      ai,
      projectName: basename(this.config.root),
      resources: {
        adapter: this.config.resources.adapter,
        exclude: this.config.resources.exclude,
        include: this.config.resources.include,
        keyStyle: this.config.resources.keyStyle,
        layout: this.config.resources.layout,
        localePattern: this.config.resources.localePattern,
        namespace: this.config.resources.namespace,
        sourceLocale: this.config.resources.sourceLocale,
        targetLocales: this.config.resources.targetLocales,
      },
    }
  }

  async scan(): Promise<ScanResponse> {
    const snapshot = await scanWorkspace(this.config, await this.pathGuard)
    this.scans.set(snapshot.scanId, snapshot)
    return snapshot.wire
  }

  private requireScan(scanId: string): ScanSnapshot {
    const snapshot = this.scans.get(scanId)
    if (!snapshot)
      throw new I18nToolError('RESOURCE_NOT_FOUND', 'The scan snapshot is unavailable or expired.', 404)
    return snapshot
  }

  private async assertSnapshotFresh(snapshot: ScanSnapshot): Promise<void> {
    for (const resource of snapshot.resources.values()) {
      const content = await readIfPresent(resource.absolutePath)
      if (content === undefined || hashContent(content) !== resource.hash)
        throw new I18nToolError('PREVIEW_STALE', 'A locale resource changed after scanning.', 409)
    }
  }

  private expandFamilies(snapshot: ScanSnapshot, selected: readonly TranslationUnit[]): TranslationUnit[] {
    const selectedIds = new Set(selected.map(unit => unit.id))
    const familyScopes = new Set(selected.flatMap(unit => unit.semantics.family
      ? [`${unit.origin.resourceId}\0${unit.semantics.family}`]
      : []))
    return snapshot.wire.units.filter(unit => (
      unit.locale === this.config.resources.sourceLocale
      && (selectedIds.has(unit.id) || (
        unit.semantics.family !== undefined
        && familyScopes.has(`${unit.origin.resourceId}\0${unit.semantics.family}`)
      ))
    ))
  }

  async* translate(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateSseEvent> {
    if (!this.languageModel)
      throw new I18nToolError('AI_NOT_CONFIGURED', 'The AI provider key is not configured.', 409)
    if (!this.config.resources.targetLocales.includes(request.targetLocale))
      throw new I18nToolError('INVALID_REQUEST', 'The target locale is not configured.', 400)
    if (this.activeTranslations >= this.config.limits.concurrentTranslations)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The concurrent translation limit was exceeded.', 429)

    const snapshot = this.requireScan(request.scanId)
    const sourceById = new Map(
      snapshot.wire.units
        .filter(unit => unit.locale === this.config.resources.sourceLocale)
        .map(unit => [unit.id, unit]),
    )
    const requested = request.unitIds.map((id) => {
      const unit = sourceById.get(id)
      if (!unit)
        throw new I18nToolError('INVALID_REQUEST', 'Translation request contains an unknown source unit.', 400)
      return unit
    })
    if (new Set(requested.map(unit => unit.id)).size !== requested.length)
      throw new I18nToolError('INVALID_REQUEST', 'Translation request contains duplicate source units.', 400)
    const selected = this.expandFamilies(snapshot, requested)

    this.activeTranslations += 1
    try {
      const plan = planTranslationBatches(selected)
      for (const diagnostic of plan.diagnostics)
        yield { diagnostic, type: 'diagnostic' }
      if (plan.batches.length === 0)
        throw new I18nToolError('INVALID_REQUEST', 'No source units can be translated.', 400)
      let completed = 0
      for (const batch of plan.batches) {
        signal?.throwIfAborted()
        const result = await translateBatch(
          this.languageModel,
          batch,
          request.targetLocale,
          signal,
        )
        for (const candidate of result.candidates)
          yield { candidate, type: 'candidate' }
        for (const diagnostic of result.diagnostics)
          yield { diagnostic, type: 'diagnostic' }
        completed += batch.units.length
        yield { completed, total: selected.length, type: 'progress' }
      }
      yield { type: 'done' }
    }
    finally {
      this.activeTranslations -= 1
    }
  }

  private expectedPreviewUnits(
    snapshot: ScanSnapshot,
    candidates: readonly TranslationCandidate[],
  ): TranslationUnit[] {
    const sourceUnits = snapshot.wire.units.filter(unit => unit.locale === this.config.resources.sourceLocale)
    const selectedIds = new Set(candidates.map(candidate => candidate.sourceUnitId))
    const selected = sourceUnits.filter(unit => selectedIds.has(unit.id))
    if (selected.length !== selectedIds.size)
      throw new I18nToolError('INVALID_REQUEST', 'Preview contains an unknown source unit.', 400)

    return this.expandFamilies(snapshot, selected)
  }

  async preview(request: PreviewRequest): Promise<PreviewResponse> {
    if (!this.config.resources.targetLocales.includes(request.targetLocale))
      throw new I18nToolError('INVALID_REQUEST', 'The target locale is not configured.', 400)
    if (request.candidates.some(candidate => candidate.targetLocale !== request.targetLocale))
      throw new I18nToolError('INVALID_REQUEST', 'Candidate target locales must match the preview target.', 400)
    const snapshot = this.requireScan(request.scanId)
    await this.assertSnapshotFresh(snapshot)
    const expectedUnits = this.expectedPreviewUnits(snapshot, request.candidates)
    const validation = validateTranslationOutput({
      targetLocale: request.targetLocale,
      translations: request.candidates.map(candidate => ({
        id: candidate.sourceUnitId,
        value: candidate.value,
      })),
    }, expectedUnits, request.targetLocale)
    if (!validation.ok)
      return { diagnostics: validation.diagnostics, files: [] }

    const guard = await this.pathGuard
    const allowedOverwriteUnitIds = new Set(request.allowOverwriteUnitIds)
    const diagnostics: PreviewResponse['diagnostics'][number][] = []
    const internalFiles: PreviewInternalFile[] = []
    const plannedTargets = new Set<string>()
    const sourceGroups = groupByResource(expectedUnits)
    for (const [sourceResourceId, sourceUnits] of sourceGroups) {
      const sourceResource = snapshot.resources.get(sourceResourceId)
      if (!sourceResource)
        throw new I18nToolError('RESOURCE_NOT_FOUND', 'Source locale resource is unavailable.', 404)
      const adapter = defaultLocaleAdapterRegistry.get(sourceResource.document.adapter)
      if (!adapter)
        throw new I18nToolError('UNSUPPORTED_ADAPTER', 'Locale adapter is unavailable.', 400)

      const relativePath = sourceResource.document.layout === 'locale-first'
        ? sourceResource.relativePath
        : targetRelativePath(this.config.resources, request.targetLocale, sourceResource.document.namespace)
      const absolutePath = await guard.resolve(relativePath, { allowMissing: true })
      const targetKey = comparablePath(absolutePath)
      if (plannedTargets.has(targetKey))
        throw new I18nToolError('INVALID_CONFIG', 'Multiple source resources resolve to the same target file.', 400)
      plannedTargets.add(targetKey)
      const existingTarget = [...snapshot.resources.values()]
        .find(resource => comparablePath(resource.absolutePath) === targetKey)
      const targetResourceId = existingTarget?.resourceId ?? randomUUID()
      const targetPlan = existingTarget
        ? { diagnostics: [], document: existingTarget.document }
        : adapter.planTarget(sourceResource.document, request.targetLocale, {
            namespace: sourceResource.document.namespace,
            relativePath,
            resourceId: targetResourceId,
          })
      diagnostics.push(...targetPlan.diagnostics)
      if (!targetPlan.document)
        continue

      const gaps = analyzeTranslationGaps(sourceUnits, targetPlan.document.units, request.targetLocale)
      const candidates = validation.candidates.filter(candidate => sourceUnits.some(unit => unit.id === candidate.sourceUnitId))
      const changePlan = planChangeOperations(adapter, sourceResource.document, gaps, candidates, {
        allowedOverwriteUnitIds,
        targetLocale: request.targetLocale,
        targetResourceId,
      })
      diagnostics.push(...changePlan.diagnostics)
      if (changePlan.operations.length === 0)
        continue
      const roundTrip = applyOperationsAndValidate(adapter, targetPlan.document, changePlan.operations)
      diagnostics.push(...roundTrip.diagnostics)
      if (!roundTrip.content || !roundTrip.document)
        continue

      internalFiles.push({
        absolutePath,
        adapter,
        after: roundTrip.content,
        baselineHash: existingTarget?.hash,
        before: existingTarget?.content ?? '',
        operations: changePlan.operations,
        relativePath,
        resourceId: targetResourceId,
        resultDocument: roundTrip.document,
        targetDocument: targetPlan.document,
        type: existingTarget ? 'update' : 'create',
      })
    }

    if (diagnostics.some(diagnostic => diagnostic.severity === 'error') || internalFiles.length === 0)
      return { diagnostics, files: [] }
    validatePreviewLimits(this.config, snapshot, internalFiles)

    const previewToken = randomUUID()
    this.previews.set(previewToken, {
      applying: false,
      createdAt: this.now(),
      files: internalFiles,
      scanId: snapshot.scanId,
      used: false,
    })
    return {
      diagnostics,
      files: internalFiles.map(file => ({
        after: file.after,
        before: file.before,
        diff: textDiff(file.before, file.after),
        operations: file.operations,
        relativePath: file.relativePath,
        resourceId: file.resourceId,
        type: file.type,
      })),
      previewToken,
    }
  }

  async apply(previewToken: string): Promise<ApplyResponse> {
    const preview = this.previews.get(previewToken)
    if (!preview || preview.used || preview.applying)
      throw new I18nToolError('PREVIEW_REQUIRED', 'A valid unused preview is required before writing.', 409)
    if (this.now() - preview.createdAt > PREVIEW_TTL_MS)
      throw new I18nToolError('PREVIEW_STALE', 'The preview expired before it was applied.', 409)
    if (this.activeApplies >= this.config.limits.concurrentApplies)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The concurrent apply limit was exceeded.', 429)
    if (preview.files.some(file => this.applyLocks.has(comparablePath(file.absolutePath))))
      throw new I18nToolError('WRITE_CONFLICT', 'A locale resource is already being written.', 409)

    preview.applying = true
    this.activeApplies += 1
    for (const file of preview.files)
      this.applyLocks.add(comparablePath(file.absolutePath))
    const written: PreviewInternalFile[] = []
    try {
      const guard = await this.pathGuard
      const validateTarget = async (file: PreviewInternalFile) => {
        const resolved = await guard.resolve(file.relativePath, { allowMissing: true })
        if (comparablePath(resolved) !== comparablePath(file.absolutePath))
          throw new I18nToolError('PATH_OUTSIDE_ROOT', 'The locale resource path changed after preview.', 403)
      }
      for (const file of preview.files) {
        await validateTarget(file)
        const current = await readIfPresent(file.absolutePath)
        await validateTarget(file)
        const currentHash = current === undefined ? undefined : hashContent(current)
        if (currentHash !== file.baselineHash)
          throw new I18nToolError('WRITE_CONFLICT', 'A locale resource changed after preview.', 409)
        const revalidated = applyOperationsAndValidate(file.adapter, file.targetDocument, file.operations)
        if (!revalidated.content || hashContent(revalidated.content) !== hashContent(file.after)) {
          throw new I18nToolError('WRITE_CONFLICT', 'The preview no longer matches the validated change plan.', 409)
        }
      }

      for (const file of preview.files) {
        await this.writeText(file.absolutePath, file.after, {
          validateTarget: () => validateTarget(file),
        })
        written.push(file)
      }
      const scan = await this.scan()
      preview.used = true
      return { filesWritten: preview.files.length, scan }
    }
    catch (error) {
      let rollbackFailed = false
      for (const file of [...written].reverse()) {
        try {
          const current = await readIfPresent(file.absolutePath)
          if (current === undefined || hashContent(current) !== hashContent(file.after))
            throw new Error('The just-written locale resource changed before rollback.')
          const guard = await this.pathGuard
          const validateTarget = async () => {
            const resolved = await guard.resolve(file.relativePath, { allowMissing: true })
            if (comparablePath(resolved) !== comparablePath(file.absolutePath))
              throw new Error('The locale resource path changed before rollback.')
          }
          if (file.type === 'create') {
            await validateTarget()
            await rm(file.absolutePath)
          }
          else {
            await this.writeText(file.absolutePath, file.before, { validateTarget })
          }
        }
        catch {
          rollbackFailed = true
        }
      }
      if (rollbackFailed) {
        preview.used = true
        throw new I18nToolError('WRITE_FAILED', 'The multi-file write failed and rollback was incomplete.', 500)
      }
      throw error
    }
    finally {
      preview.applying = false
      this.activeApplies -= 1
      for (const file of preview.files)
        this.applyLocks.delete(comparablePath(file.absolutePath))
    }
  }
}
