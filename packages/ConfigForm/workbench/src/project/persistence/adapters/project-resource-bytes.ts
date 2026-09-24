import type {
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
} from '@moluoxixi/config-form-model'

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/

export function cloneEmbeddedResourceWrites(
  writes: readonly ProjectEmbeddedResourceWrite[],
): ProjectEmbeddedResourceWrite[] {
  return writes.map(write => ({
    resourceId: write.resourceId,
    contentHash: write.contentHash,
    bytes: new Uint8Array(write.bytes),
  }))
}

export async function sha256ContentHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    throw new Error('SHA-256 is unavailable in this runtime.')
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function validateEmbeddedResourceWrites(
  document: ProjectDocument,
  writes: readonly ProjectEmbeddedResourceWrite[],
  requireCompleteSnapshot: boolean,
): Promise<ProjectEmbeddedResourceWrite[]> {
  const embedded = new Map(Object.entries(document.resources)
    .filter((entry): entry is [string, Extract<ProjectDocument['resources'][string], { kind: 'embedded' }>] =>
      entry[1].kind === 'embedded'))
  const seen = new Set<string>()
  const validated: ProjectEmbeddedResourceWrite[] = []

  for (const write of writes) {
    if (seen.has(write.resourceId))
      throw new TypeError(`Embedded Resource write is duplicated: ${write.resourceId}`)
    seen.add(write.resourceId)
    const resource = embedded.get(write.resourceId)
    if (!resource)
      throw new TypeError(`Embedded Resource write is not declared by the document: ${write.resourceId}`)
    if (!(write.bytes instanceof Uint8Array))
      throw new TypeError(`Embedded Resource bytes do not match metadata: ${write.resourceId}`)
    const bytes = new Uint8Array(write.bytes)
    if (!CONTENT_HASH_PATTERN.test(write.contentHash)
      || write.contentHash !== resource.contentHash
      || bytes.byteLength !== resource.byteLength
      || await sha256ContentHash(bytes) !== resource.contentHash) {
      throw new TypeError(`Embedded Resource bytes do not match metadata: ${write.resourceId}`)
    }
    validated.push({
      resourceId: write.resourceId,
      contentHash: write.contentHash,
      bytes,
    })
  }

  if (requireCompleteSnapshot) {
    const missing = [...embedded.keys()].find(resourceId => !seen.has(resourceId))
    if (missing)
      throw new TypeError(`Embedded Resource bytes are missing: ${missing}`)
  }

  return validated.sort((left, right) => left.resourceId.localeCompare(right.resourceId))
}

export async function validateStoredBytes(
  input: { byteLength: number, bytes: Uint8Array, contentHash: string },
): Promise<Uint8Array> {
  if (!(input.bytes instanceof Uint8Array))
    throw new TypeError('Stored embedded Resource bytes are invalid.')
  const bytes = new Uint8Array(input.bytes)
  if (!Number.isInteger(input.byteLength)
    || input.byteLength < 0
    || bytes.byteLength !== input.byteLength
    || !CONTENT_HASH_PATTERN.test(input.contentHash)
    || await sha256ContentHash(bytes) !== input.contentHash) {
    throw new TypeError('Stored embedded Resource bytes are invalid.')
  }
  return bytes
}
