import type { FSWatcher, ViteDevServer } from 'vite'
import type { ElementPlusDocsProject } from '../project/types'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

interface ContentProjection {
  destinationRoot: string
  injectLastUpdated: boolean
  optional: boolean
  sourceRoot: string
}

export interface ElementPlusDocsContentOptions {
  docsRoot: string
  generatedRoot: string
  project: ElementPlusDocsProject
  projectRoot: string
  resolveLastUpdated?: (sourcePath: string) => Date | undefined
}

function isPathInside(root: string, path: string): boolean {
  const pathFromRoot = relative(root, path)
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot))
}

function pathsOverlap(left: string, right: string): boolean {
  return isPathInside(left, right) || isPathInside(right, left)
}

function canonicalPath(path: string): string {
  const resolvedPath = resolve(path)
  let existingPath = resolvedPath
  while (!existsSync(existingPath)) {
    const parentPath = dirname(existingPath)
    if (parentPath === existingPath)
      return resolvedPath
    existingPath = parentPath
  }
  return resolve(
    realpathSync.native(existingPath),
    relative(existingPath, resolvedPath),
  )
}

function renameDirectoryWithRetry(sourcePath: string, destinationPath: string): void {
  const waitBuffer = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(sourcePath, destinationPath)
      return
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt >= 5 || !code || !['EACCES', 'EBUSY', 'EPERM'].includes(code))
        throw error
      Atomics.wait(waitBuffer, 0, 0, 50 * (attempt + 1))
    }
  }
}

function assertContentDirectory(value: string): void {
  const normalized = value.replaceAll('\\', '/')
  if (
    !normalized
    || normalized !== value
    || normalized.startsWith('/')
    || /^[A-Z]:\//i.test(normalized)
    || normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')
  ) {
    throw new TypeError(`Documentation sourceDirectory must be a normalized relative directory: ${value}`)
  }
}

function assertRuntimeDestination(
  contentRoot: string,
  canonicalContentRoot: string,
  destinationPath: string,
): void {
  if (!isPathInside(contentRoot, destinationPath))
    throw new TypeError(`Documentation runtime destination is outside the content root: ${destinationPath}`)
  if (!isPathInside(canonicalContentRoot, canonicalPath(destinationPath)))
    throw new TypeError(`Documentation runtime destination resolves outside the content root: ${destinationPath}`)
}

function contentProjections(options: ElementPlusDocsContentOptions): ContentProjection[] {
  const contentRoot = elementPlusDocsContentRoot(options.generatedRoot)
  const canonicalContentRoot = canonicalPath(contentRoot)
  const canonicalDocsRoot = canonicalPath(options.docsRoot)
  if (!isPathInside(options.docsRoot, options.generatedRoot))
    throw new TypeError(`Documentation generated root is outside the docs root: ${options.generatedRoot}`)
  if (!isPathInside(canonicalDocsRoot, canonicalPath(options.generatedRoot)))
    throw new TypeError(`Documentation generated root resolves outside the docs root: ${options.generatedRoot}`)
  if (!isPathInside(canonicalDocsRoot, canonicalContentRoot))
    throw new TypeError(`Documentation content root resolves outside the docs root: ${contentRoot}`)
  const projections = Object.values(options.project.documentation.locales).map((locale) => {
    assertContentDirectory(locale.sourceDirectory)
    return {
      destinationRoot: resolve(contentRoot, locale.sourceDirectory),
      injectLastUpdated: true,
      optional: false,
      sourceRoot: resolve(options.docsRoot, locale.sourceDirectory),
    }
  })
  const publicRoot = resolve(options.docsRoot, 'public')
  projections.push({
    destinationRoot: resolve(contentRoot, 'public'),
    injectLastUpdated: false,
    optional: true,
    sourceRoot: publicRoot,
  })
  for (const projection of projections) {
    if (!isPathInside(options.docsRoot, projection.sourceRoot))
      throw new TypeError(`Documentation content source is outside the docs root: ${projection.sourceRoot}`)
    const canonicalSourceRoot = canonicalPath(projection.sourceRoot)
    if (!isPathInside(canonicalDocsRoot, canonicalSourceRoot))
      throw new TypeError(`Documentation content source resolves outside the docs root: ${projection.sourceRoot}`)
    if (pathsOverlap(canonicalContentRoot, canonicalSourceRoot))
      throw new TypeError(`Documentation content source overlaps the runtime content root: ${projection.sourceRoot}`)
    assertRuntimeDestination(contentRoot, canonicalContentRoot, projection.destinationRoot)
  }
  for (const [index, projection] of projections.entries()) {
    for (const candidate of projections.slice(index + 1)) {
      if (
        pathsOverlap(canonicalPath(projection.sourceRoot), canonicalPath(candidate.sourceRoot))
        || pathsOverlap(canonicalPath(projection.destinationRoot), canonicalPath(candidate.destinationRoot))
      ) {
        throw new TypeError('Documentation content projections must not overlap')
      }
    }
  }
  return projections
}

function gitLastUpdated(projectRoot: string, sourcePath: string): Date | undefined {
  if (!isPathInside(projectRoot, sourcePath))
    throw new TypeError(`Documentation content source is outside the project root: ${sourcePath}`)
  const sourcePathFromRoot = relative(projectRoot, sourcePath).replaceAll('\\', '/')
  const result = spawnSync('git', [
    '-C',
    projectRoot,
    '-c',
    'i18n.logOutputEncoding=UTF-8',
    'log',
    '-1',
    '--format=%cI',
    '--',
    sourcePathFromRoot,
  ], {
    encoding: 'utf8',
    windowsHide: true,
  })
  const value = result.status === 0 ? result.stdout.trim() : ''
  if (!value)
    return undefined
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.valueOf()) ? undefined : timestamp
}

function renderProjectedMarkdown(
  source: string,
  lastUpdated: Date | undefined,
): string {
  if (!lastUpdated)
    return source
  const parsed = matter(source)
  if (parsed.data.lastUpdated === undefined)
    parsed.data.lastUpdated = lastUpdated
  return matter.stringify(parsed.content, parsed.data)
}

function projectFile(
  sourcePath: string,
  destinationPath: string,
  projection: ContentProjection,
  options: ElementPlusDocsContentOptions,
): void {
  const metadata = lstatSync(sourcePath)
  if (metadata.isSymbolicLink())
    throw new TypeError(`Documentation content cannot contain symbolic links: ${sourcePath}`)
  if (!metadata.isFile())
    return
  mkdirSync(dirname(destinationPath), { recursive: true })
  if (projection.injectLastUpdated && extname(sourcePath).toLowerCase() === '.md') {
    const resolveLastUpdated = options.resolveLastUpdated
      ?? (path => gitLastUpdated(options.projectRoot, path))
    const source = readFileSync(sourcePath, 'utf8')
    writeFileSync(
      destinationPath,
      renderProjectedMarkdown(source, resolveLastUpdated(sourcePath)),
      'utf8',
    )
    return
  }
  copyFileSync(sourcePath, destinationPath)
}

function projectDirectory(
  sourceRoot: string,
  destinationRoot: string,
  projection: ContentProjection,
  options: ElementPlusDocsContentOptions,
): void {
  const metadata = lstatSync(sourceRoot)
  if (metadata.isSymbolicLink())
    throw new TypeError(`Documentation content cannot contain symbolic links: ${sourceRoot}`)
  if (!metadata.isDirectory())
    throw new TypeError(`Documentation content source is not a directory: ${sourceRoot}`)
  mkdirSync(destinationRoot, { recursive: true })
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = resolve(sourceRoot, entry.name)
    const destinationPath = resolve(destinationRoot, entry.name)
    if (entry.isSymbolicLink())
      throw new TypeError(`Documentation content cannot contain symbolic links: ${sourcePath}`)
    if (entry.isDirectory()) {
      projectDirectory(sourcePath, destinationPath, projection, options)
      continue
    }
    projectFile(sourcePath, destinationPath, projection, options)
  }
}

function resolveProjection(
  options: ElementPlusDocsContentOptions,
  sourcePath: string,
): { destinationPath: string, projection: ContentProjection } | undefined {
  const resolvedSourcePath = resolve(sourcePath)
  const contentRoot = elementPlusDocsContentRoot(options.generatedRoot)
  const canonicalContentRoot = canonicalPath(contentRoot)
  for (const projection of contentProjections(options)) {
    if (!isPathInside(projection.sourceRoot, resolvedSourcePath))
      continue
    if (!isPathInside(canonicalPath(projection.sourceRoot), canonicalPath(resolvedSourcePath)))
      throw new TypeError(`Documentation content event resolves outside its source root: ${sourcePath}`)
    const destinationPath = resolve(
      projection.destinationRoot,
      relative(projection.sourceRoot, resolvedSourcePath),
    )
    assertRuntimeDestination(contentRoot, canonicalContentRoot, destinationPath)
    return {
      destinationPath,
      projection,
    }
  }
  return undefined
}

export function elementPlusDocsContentRoot(generatedRoot: string): string {
  return resolve(generatedRoot, 'content')
}

export function synchronizeElementPlusDocsContent(
  options: ElementPlusDocsContentOptions,
): string {
  const contentRoot = elementPlusDocsContentRoot(options.generatedRoot)
  const projections = contentProjections(options)
  mkdirSync(options.generatedRoot, { recursive: true })
  const temporaryRoot = mkdtempSync(resolve(options.generatedRoot, `.content-${process.pid}-`))
  try {
    for (const projection of projections) {
      if (projection.optional && !existsSync(projection.sourceRoot))
        continue
      const temporaryDestination = resolve(
        temporaryRoot,
        relative(contentRoot, projection.destinationRoot),
      )
      projectDirectory(
        projection.sourceRoot,
        temporaryDestination,
        projection,
        options,
      )
    }
    contentProjections(options)
    rmSync(contentRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 })
    renameDirectoryWithRetry(temporaryRoot, contentRoot)
  }
  catch (error) {
    rmSync(temporaryRoot, { force: true, recursive: true })
    throw error
  }
  return contentRoot
}

function handleContentSourceEvent(
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
  sourcePath: string,
  options: ElementPlusDocsContentOptions,
): void {
  const resolved = resolveProjection(options, sourcePath)
  if (!resolved)
    return
  if (event === 'unlink' || event === 'unlinkDir') {
    rmSync(resolved.destinationPath, { force: true, recursive: event === 'unlinkDir' })
    return
  }
  if (event === 'addDir') {
    mkdirSync(resolved.destinationPath, { recursive: true })
    return
  }
  projectFile(
    resolve(sourcePath),
    resolved.destinationPath,
    resolved.projection,
    options,
  )
}

export function watchElementPlusDocsContent(
  server: Pick<ViteDevServer, 'watcher'>,
  options: ElementPlusDocsContentOptions,
): () => void {
  const watcher: FSWatcher = server.watcher
  const sourceRoots = contentProjections(options).map(projection => projection.sourceRoot)
  watcher.add(sourceRoots)
  const listeners = new Map<string, (path: string) => void>()
  for (const event of ['add', 'addDir', 'change', 'unlink', 'unlinkDir'] as const) {
    const listener = (path: string) => handleContentSourceEvent(event, path, options)
    listeners.set(event, listener)
    watcher.on(event, listener)
  }
  return () => {
    for (const [event, listener] of listeners)
      watcher.off(event, listener)
    void watcher.unwatch(sourceRoots)
  }
}
