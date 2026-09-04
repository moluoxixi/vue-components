import type { ResolvedI18nToolConfig } from '../../../config'
import type { ResourceDocument, TranslationUnit } from '../../../core'
import type { ScanResourceWire, ScanResponse } from '../../../shared/protocol'
import type { PathGuard } from '../../filesystem'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { opendir, stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import {
  analyzeTranslationGaps,
  defaultLocaleAdapterRegistry,
} from '../../../core'
import { I18nToolError } from '../../errors'
import { globToRegExp, parseResourceIdentity, staticPatternRoot } from './resource-pattern'

export interface ScannedResource {
  absolutePath: string
  content: string
  document: ResourceDocument
  hash: string
  relativePath: string
  resourceId: string
}

export interface ScanSnapshot {
  createdAt: number
  diagnostics: ScanResponse['diagnostics']
  resources: Map<string, ScannedResource>
  scanId: string
  wire: ScanResponse
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value))
}

async function walkFiles(
  root: string,
  current: string,
  includes: readonly RegExp[],
  excludes: readonly RegExp[],
  output: string[],
  budget: { entries: number, maxEntries: number, maxFiles: number },
  depth = 0,
): Promise<void> {
  if (depth > 64)
    throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource directory depth limit was exceeded.', 413)
  const directory = await opendir(current)
  for await (const entry of directory) {
    budget.entries += 1
    if (budget.entries > budget.maxEntries)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource traversal limit was exceeded.', 413)
    const absolutePath = resolve(current, entry.name)
    const relativePath = relative(root, absolutePath).replaceAll('\\', '/')
    if (matchesAny(relativePath, excludes) || matchesAny(`${relativePath}/`, excludes))
      continue
    if (entry.isSymbolicLink())
      throw new I18nToolError('SYMLINK_ESCAPE', 'Symbolic links are not allowed in locale resource roots.', 403)
    if (entry.isDirectory()) {
      await walkFiles(root, absolutePath, includes, excludes, output, budget, depth + 1)
      continue
    }
    if (entry.isFile() && matchesAny(relativePath, includes)) {
      output.push(relativePath)
      if (output.length > budget.maxFiles)
        throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource file limit was exceeded.', 413)
    }
  }
}

async function readUtf8FileLimited(
  absolutePath: string,
  maxBytes: number,
): Promise<{ bytes: number, content: string }> {
  const stream = createReadStream(absolutePath)
  const decoder = new TextDecoder()
  let bytes = 0
  let content = ''
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > maxBytes) {
        stream.destroy()
        throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource byte limit was exceeded.', 413)
      }
      content += decoder.decode(buffer, { stream: true })
    }
    content += decoder.decode()
    return { bytes, content }
  }
  finally {
    stream.destroy()
  }
}

async function discoverFiles(config: ResolvedI18nToolConfig, guard: PathGuard): Promise<string[]> {
  const includes = config.resources.include.map(globToRegExp)
  const excludes = config.resources.exclude.map(globToRegExp)
  const roots = [...new Set(config.resources.include.map(staticPatternRoot))]
  const discovered: string[] = []
  const budget = {
    entries: 0,
    maxEntries: Math.max(1_000, config.limits.files * 20),
    maxFiles: config.limits.files,
  }
  for (const relativeRoot of roots) {
    const absoluteRoot = await guard.resolve(relativeRoot)
    const rootStat = await stat(absoluteRoot)
    if (rootStat.isFile()) {
      const relativeFile = relative(config.root, absoluteRoot).replaceAll('\\', '/')
      if (matchesAny(relativeFile, includes) && !matchesAny(relativeFile, excludes))
        discovered.push(relativeFile)
      continue
    }
    await walkFiles(config.root, absoluteRoot, includes, excludes, discovered, budget)
  }
  return [...new Set(discovered)].sort()
}

export async function scanWorkspace(
  config: ResolvedI18nToolConfig,
  guard: PathGuard,
): Promise<ScanSnapshot> {
  const adapterResult = defaultLocaleAdapterRegistry.require(config.resources.adapter)
  if (!adapterResult.adapter)
    throw new I18nToolError('UNSUPPORTED_ADAPTER', 'The configured locale adapter is unavailable.', 400)

  const files = await discoverFiles(config, guard)
  if (files.length > config.limits.files)
    throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource file limit was exceeded.', 413)

  const resources = new Map<string, ScannedResource>()
  const diagnostics: ScanResponse['diagnostics'][number][] = []
  let totalBytes = 0
  let totalKeys = 0
  for (const relativePath of files) {
    const absolutePath = await guard.resolve(relativePath)
    const fileSize = (await stat(absolutePath)).size
    if (totalBytes + fileSize > config.limits.totalBytes)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource byte limit was exceeded.', 413)
    const loaded = await readUtf8FileLimited(absolutePath, config.limits.totalBytes - totalBytes)
    const content = loaded.content
    totalBytes += loaded.bytes
    if (totalBytes > config.limits.totalBytes)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The locale resource byte limit was exceeded.', 413)
    const identity = parseResourceIdentity(relativePath, config.resources)
    const resourceId = randomUUID()
    const parsed = adapterResult.adapter.parse({
      adapterOptions: config.resources.adapterOptions,
      content,
      keyStyle: config.resources.keyStyle,
      layout: config.resources.layout,
      locale: identity.locale,
      namespace: identity.namespace,
      relativePath,
      resourceId,
    })
    diagnostics.push(...parsed.diagnostics)
    if (!parsed.document)
      continue
    totalKeys += parsed.document.units.length
    if (totalKeys > config.limits.keys)
      throw new I18nToolError('LIMIT_EXCEEDED', 'The locale key limit was exceeded.', 413)
    resources.set(resourceId, {
      absolutePath,
      content,
      document: parsed.document,
      hash: contentHash(content),
      relativePath,
      resourceId,
    })
  }

  const units = [...resources.values()].flatMap(resource => resource.document.units)
  const gaps: Record<string, { empty: number, existing: number, missing: number }> = {}
  const unitGaps: ScanResponse['unitGaps'][number][] = []
  const sourceUnits = units.filter(unit => unit.locale === config.resources.sourceLocale)
  for (const targetLocale of config.resources.targetLocales) {
    const targetUnits = units.filter(unit => unit.locale === targetLocale)
    const targetGaps = analyzeTranslationGaps(sourceUnits, targetUnits, targetLocale)
    unitGaps.push(...targetGaps.map(gap => ({
      sourceUnitId: gap.source.id,
      status: gap.status,
      targetLocale,
      targetUnitId: gap.target?.id,
    })))
    gaps[targetLocale] = {
      empty: targetGaps.filter(gap => gap.status === 'empty').length,
      existing: targetGaps.filter(gap => gap.status === 'existing').length,
      missing: targetGaps.filter(gap => gap.status === 'missing').length,
    }
  }

  const wireResources: ScanResourceWire[] = [...resources.values()].map(resource => ({
    adapter: resource.document.adapter,
    diagnostics: resource.document.diagnostics,
    hash: resource.hash,
    keyCount: resource.document.units.length,
    locale: resource.document.locale,
    namespace: resource.document.namespace,
    relativePath: resource.relativePath,
    resourceId: resource.resourceId,
  }))
  const scanId = randomUUID()
  const wire: ScanResponse = { diagnostics, gaps, resources: wireResources, scanId, unitGaps, units }
  return { createdAt: Date.now(), diagnostics, resources, scanId, wire }
}

export function sourceUnitsFor(snapshot: ScanSnapshot, locale: string): TranslationUnit[] {
  return snapshot.wire.units.filter(unit => unit.locale === locale)
}

export function hashContent(content: string): string {
  return contentHash(content)
}
