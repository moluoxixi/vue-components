import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type { SourceBinaryFile, SourceResourceReader } from '../types'
import type { CollectedSourceResources } from '../types/internal'
import { safeSlug } from './serialization'

type ResourceResult
  = | { success: true, data: CollectedSourceResources }
    | { success: false, diagnostics: ModelDiagnostic[] }

function failure(
  code: 'source_resource_read_failed' | 'resource_content_invalid',
  message: string,
  resourceId: string,
  context?: Record<string, unknown>,
): ResourceResult {
  return {
    success: false,
    diagnostics: [{ code, message, resourceId, ...(context ? { context } : {}) }],
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function extension(fileName: string): string | undefined {
  const match = /\.([A-Z0-9]{1,16})$/i.exec(fileName)
  return match?.[1]?.toLowerCase()
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const value = (first << 16) | (second << 8) | third
    result += alphabet[(value >>> 18) & 63]
    result += alphabet[(value >>> 12) & 63]
    result += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '='
    result += index + 2 < bytes.length ? alphabet[value & 63] : '='
  }
  return result
}

async function sha256(bytes: Uint8Array): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    return undefined
  const input = Uint8Array.from(bytes)
  const digest = await subtle.digest('SHA-256', input)
  return `sha256:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

function stableSuffix(value: string): string {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function uniqueAssetName(
  resourceId: string,
  fileExtension: string,
  used: Set<string>,
): string {
  const base = safeSlug(resourceId, 'resource')
  let fileName = `${base}.${fileExtension}`
  if (used.has(fileName))
    fileName = `${base}-${stableSuffix(resourceId)}.${fileExtension}`
  let suffix = 2
  const candidate = fileName
  while (used.has(fileName)) {
    fileName = candidate.replace(`.${fileExtension}`, `-${suffix}.${fileExtension}`)
    suffix += 1
  }
  used.add(fileName)
  return fileName
}

export async function collectSourceResources(
  compilation: ProjectCompilation,
  reader: SourceResourceReader,
): Promise<ResourceResult> {
  const files: SourceBinaryFile[] = []
  const values = new Map<string, { kind: 'embedded', fileName: string } | { kind: 'url', url: string }>()
  const usedNames = new Set<string>()
  for (const resourceId of Object.keys(compilation.ir.resources).sort()) {
    const resource = compilation.ir.resources[resourceId]
    if (!resource)
      return failure('resource_content_invalid', `Compiled Resource "${resourceId}" is missing.`, resourceId)
    if (resource.kind === 'url') {
      values.set(resourceId, { kind: 'url', url: resource.url })
      continue
    }
    let result
    try {
      result = await reader.readEmbedded({
        projectId: compilation.key.projectId,
        resourceId,
        contentHash: resource.contentHash,
      })
    }
    catch (error) {
      return failure(
        'source_resource_read_failed',
        `Embedded Resource "${resourceId}" could not be read.`,
        resourceId,
        { reason: error instanceof Error ? error.message : String(error) },
      )
    }
    if (!isRecord(result) || typeof result.success !== 'boolean') {
      return failure(
        'source_resource_read_failed',
        `Embedded Resource "${resourceId}" returned an invalid reader result.`,
        resourceId,
      )
    }
    if (!result.success) {
      return failure(
        'source_resource_read_failed',
        `Embedded Resource "${resourceId}" could not be read.`,
        resourceId,
        { diagnostics: result.diagnostics },
      )
    }
    if (!(result.data instanceof Uint8Array))
      return failure('resource_content_invalid', `Embedded Resource "${resourceId}" did not return bytes.`, resourceId)
    const bytes = Uint8Array.from(result.data)
    if (bytes.byteLength !== resource.byteLength) {
      return failure('resource_content_invalid', `Embedded Resource "${resourceId}" byte length does not match its metadata.`, resourceId, {
        expected: resource.byteLength,
        received: bytes.byteLength,
      })
    }
    const digest = await sha256(bytes)
    if (!digest || digest !== resource.contentHash) {
      return failure('resource_content_invalid', `Embedded Resource "${resourceId}" hash does not match its metadata.`, resourceId, {
        expected: resource.contentHash,
        received: digest,
      })
    }
    const fileExtension = extension(resource.fileName)
    if (!fileExtension)
      return failure('resource_content_invalid', `Embedded Resource "${resourceId}" has no safe file extension.`, resourceId)
    const fileName = uniqueAssetName(resourceId, fileExtension, usedNames)
    files.push({
      kind: 'binary',
      path: `src/assets/${fileName}`,
      mediaType: resource.mediaType,
      encoding: 'base64',
      contentBase64: encodeBase64(bytes),
    })
    values.set(resourceId, { kind: 'embedded', fileName })
  }
  return { success: true, data: { files, values } }
}
