import type { SourceArchiveInput, StructuredSourceArchiveInput } from '../types'
import { strToU8, zip } from 'fflate'
import { safeProjectSlug } from '../../utils'
import { sourceFileBytes } from './file-content'

export async function createSourceArchive(input: SourceArchiveInput): Promise<Uint8Array> {
  const root = safeProjectSlug(input.name)
  const entries = Object.fromEntries(input.files.map(file => [
    `${root}/${file.path}`,
    sourceFileBytes(file),
  ]))

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error)
        reject(error)
      else
        resolve(data)
    })
  })
}

const SURFACE_FILE_PATH = /^src\/surfaces\/([^/]+)(\/.*)?$/u

function sourceSurfaceSlug(value: string): string {
  const normalized = value.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'surface'
}

function sourceSurfaceDirectories(surfaceIds: readonly string[]): ReadonlyMap<string, string> {
  const used = new Set<string>()
  const result = new Map<string, string>()
  surfaceIds.forEach((surfaceId) => {
    const base = sourceSurfaceSlug(surfaceId)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    result.set(surfaceId, directory)
  })
  return result
}

/** Resolve the generated directory for a Surface id in a SourceFileSet. */
export function sourceSurfaceDirectory(
  files: readonly { path: string }[],
  surfaceId: string,
  surfaceIds?: readonly string[],
): string | undefined {
  const directories = [...new Set(files.flatMap((file) => {
    const match = SURFACE_FILE_PATH.exec(file.path)
    return match ? [match[1]!] : []
  }))]
  const expected = surfaceIds
    ? sourceSurfaceDirectories(surfaceIds).get(surfaceId)
    : sourceSurfaceSlug(surfaceId)
  if (!expected)
    return undefined
  return directories.find(directory => directory === expected)
    ?? directories.find(directory => directory.startsWith(`${expected}-`))
}

function structuredPath(path: string): string {
  const surface = SURFACE_FILE_PATH.exec(path)
  if (surface)
    return `views/${surface[1]}${surface[2] ?? ''}`
  if (path.startsWith('src/components/'))
    return `components/${path.slice('src/components/'.length)}`
  if (path.startsWith('src/assets/'))
    return `assets/${path.slice('src/assets/'.length)}`
  if (path.startsWith('public/'))
    return `assets/${path.slice('public/'.length)}`
  if (path.startsWith('src/'))
    return `shared/${path.slice('src/'.length)}`
  return path
}

function shouldIncludeStructuredFile(
  path: string,
  input: StructuredSourceArchiveInput,
): boolean {
  if ((input.scope ?? 'project') !== 'surface')
    return true
  const directory = input.surfaceDirectory
  if (!directory)
    throw new TypeError('A surfaceDirectory is required for a surface source export.')
  const match = SURFACE_FILE_PATH.exec(path)
  if (!match)
    return true
  const directories = input.surfaceDirectories ?? [directory]
  return directories.includes(match[1]!)
}

function sourceExportManifest(
  input: StructuredSourceArchiveInput,
  files: readonly string[],
): string {
  const scope = input.scope ?? 'project'
  return `${JSON.stringify({
    version: 1,
    kind: 'config-form-source-export',
    scope,
    project: {
      ...(input.projectId ? { id: input.projectId } : {}),
      name: input.projectName ?? input.name,
    },
    ...(scope === 'surface'
      ? {
          surface: {
            ...(input.surfaceId ? { id: input.surfaceId } : {}),
            ...(input.surfaceName ? { name: input.surfaceName } : {}),
            directory: input.surfaceDirectory,
          },
        }
      : {}),
    directories: {
      views: 'views',
      components: 'components',
      assets: 'assets',
    },
    files,
  }, null, 2)}\n`
}

/** Build the copy-friendly `views`/`components`/`assets` layout. */
export async function createStructuredSourceArchive(
  input: StructuredSourceArchiveInput,
): Promise<Uint8Array> {
  const root = safeProjectSlug(input.name)
  const projected = input.files
    .filter(file => shouldIncludeStructuredFile(file.path, input))
    .map(file => ({ file, path: structuredPath(file.path) }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const seen = new Set<string>()
  projected.forEach(({ path }) => {
    if (seen.has(path))
      throw new TypeError(`Structured source export contains duplicate path: ${path}`)
    seen.add(path)
  })
  const entries: Record<string, Uint8Array> = Object.fromEntries([
    ...projected.map(({ file, path }) => [`${root}/${path}`, sourceFileBytes(file)] as const),
    [`${root}/export-manifest.json`, strToU8(sourceExportManifest(input, projected.map(item => item.path)))],
  ])

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error)
        reject(error)
      else
        resolve(data)
    })
  })
}
