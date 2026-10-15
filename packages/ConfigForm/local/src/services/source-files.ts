import type { RawSourceFileSetV1, SourceFile } from '@moluoxixi/config-form-source/generator'
import type { SourceArtifact } from '../types'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, win32 } from 'node:path'
import { zipSync } from 'fflate'

export function sourceFileBytes(file: SourceFile): Uint8Array {
  return Buffer.from(file.kind === 'text' ? file.content : file.contentBase64, file.kind === 'text' ? 'utf8' : 'base64')
}
export function assertSourcePath(path: string): void {
  if (!path || isAbsolute(path) || win32.isAbsolute(path) || path.includes('\\') || path.includes(':') || path.includes('\0') || path.split('/').some(part => !part || part === '.' || part === '..'))
    throw new TypeError(`Unsafe source file path: ${path}`)
}
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return false
    throw error
  }
}
/** Writes a complete generation to a new directory; existing source is never overwritten. */
export async function writeSourceDirectory(source: RawSourceFileSetV1, directory: string): Promise<string> {
  const paths = new Set<string>()
  for (const file of source.files) {
    assertSourcePath(file.path)
    const key = file.path.toLowerCase()
    if (paths.has(key))
      throw new TypeError(`Duplicate generated file: ${file.path}`)
    paths.add(key)
  }
  const target = resolve(directory)
  if (await exists(target))
    throw new Error(`Output directory already exists: ${target}. Choose a new directory to preserve edited source.`)
  await mkdir(dirname(target), { recursive: true })
  const parent = await realpath(dirname(target))
  const staging = join(parent, `.configform-export-${randomUUID()}`)
  await mkdir(staging)
  try {
    for (const file of source.files) {
      const path = join(staging, file.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, sourceFileBytes(file), { flag: 'wx' })
    }
    if (await exists(target))
      throw new Error(`Output directory was created during generation: ${target}`)
    await rename(staging, target)
    return target
  }
  finally {
    // Only this function's randomly named staging directory may be removed.
    const path = relative(parent, staging)
    if (path.startsWith('.configform-export-') && !path.includes('/') && !path.includes('\\'))
      await rm(staging, { recursive: true, force: true })
  }
}
export async function saveSourceArtifact(root: string, input: Omit<SourceArtifact, 'version' | 'id'>): Promise<SourceArtifact> {
  const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const artifact: SourceArtifact = { version: 1, id: digest, ...input }
  const directory = join(root, '.configform', 'artifacts')
  await mkdir(directory, { recursive: true })
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error('Source artifact directory cannot be a symbolic link.')
  const target = join(directory, `${digest}.json`)
  if (!await exists(target)) {
    const temporary = `${target}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(artifact), { flag: 'wx' })
      await rename(temporary, target)
    }
    finally {
      await rm(temporary, { force: true })
    }
  }
  return artifact
}
export async function readSourceArtifact(root: string, id: string): Promise<SourceArtifact> {
  if (!/^[0-9a-f]{64}$/.test(id))
    throw new TypeError('Invalid source artifact ID.')
  const artifact = JSON.parse(await readFile(join(root, '.configform', 'artifacts', `${id}.json`), 'utf8')) as SourceArtifact
  const { version, id: storedId, ...input } = artifact
  if (version !== 1 || storedId !== id || createHash('sha256').update(JSON.stringify(input)).digest('hex') !== id)
    throw new Error('Source artifact checksum does not match.')
  artifact.source.files.forEach(file => assertSourcePath(file.path))
  return artifact
}
export function createSourceZip(artifact: SourceArtifact): Uint8Array {
  return zipSync(Object.fromEntries(artifact.source.files.map(file => [file.path, sourceFileBytes(file)])))
}
export async function exportSourceArtifact(root: string, artifact: SourceArtifact, name = artifact.id): Promise<string> {
  if (!/^[\w-]{1,100}$/.test(name))
    throw new TypeError('Export directory name must contain only letters, digits, underscores and hyphens.')
  const generated = join(await realpath(root), 'generated')
  if (await exists(generated) && (await lstat(generated)).isSymbolicLink())
    throw new Error('Generated output directory cannot be a symbolic link.')
  return await writeSourceDirectory(artifact.source, join(generated, name))
}
