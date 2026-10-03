import type { SourceFile } from '@moluoxixi/config-form-source/generator'
import type { StructuredSourceArchiveInput } from '../types'
import { rewriteStructuredSourceText } from './source-rewrite'

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

/** Return the projected path used by both source preview and download. */
export function projectStructuredSourcePath(path: string): string {
  const surface = SURFACE_FILE_PATH.exec(path)
  if (surface) {
    const directory = surface[1]!
    const suffix = surface[2] ?? ''
    if (suffix === '/Surface.vue')
      return `src/views/${directory}/index.vue`
    if (suffix === '/validation.ts' || suffix === '/config.ts')
      return `src/views/${directory}/utils${suffix}`
    return `src/views/${directory}${suffix}`
  }
  if (path === 'src/router.ts')
    return 'src/router/index.ts'
  if (path === 'src/demo-navigation.ts')
    return 'src/composables/demo-navigation.ts'
  if (path === 'src/demo-values.ts')
    return 'src/utils/demo-values.ts'
  if (path === 'src/data/datasets.ts')
    return 'src/constants/options.ts'
  if (path === 'src/data/resources.ts')
    return 'src/constants/assets.ts'
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

/** Arrange generated files as a standard Vue project for both preview and ZIP. */
export function projectStructuredSourceFiles(
  input: StructuredSourceArchiveInput,
): readonly SourceFile[] {
  const included = input.files.filter(file => shouldIncludeStructuredFile(file.path, input))
  const paths = new Map(included.map(file => [file.path, projectStructuredSourcePath(file.path)]))
  const projected = included.map(file => ({
    ...file,
    path: paths.get(file.path)!,
    ...(file.kind === 'text' ? { content: rewriteStructuredSourceText(file, paths) } : {}),
  })).sort((left, right) => left.path.localeCompare(right.path))
  const seen = new Set<string>()
  projected.forEach(({ path }) => {
    if (seen.has(path))
      throw new TypeError(`Structured source export contains duplicate path: ${path}`)
    seen.add(path)
  })
  return projected
}
