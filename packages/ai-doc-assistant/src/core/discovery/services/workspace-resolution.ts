import { existsSync, readFileSync, statSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'

export interface WorkspacePackage {
  entryPath?: string
  name: string
  packageDir: string
}

export interface DiscoveryContext {
  root: string
  workspacePackages: Map<string, WorkspacePackage>
}

const SCRIPT_EXTS = ['.ts', '.tsx', '.js', '.jsx']
const RESOLVE_EXTS = [...SCRIPT_EXTS, '.vue']
const IGNORED_PACKAGE_SEGMENTS = new Set([
  '.git',
  '.spike',
  '.vite',
  'coverage',
  'dist',
  'node_modules',
])

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function hasIgnoredSegment(path: string): boolean {
  return normalizePath(path).split('/').some(seg => IGNORED_PACKAGE_SEGMENTS.has(seg))
}

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function fileExists(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

export function resolvePath(root: string, path: string): string {
  return isAbsolute(path) ? path : resolve(root, path)
}

function resolveFileLike(base: string): string | undefined {
  if (fileExists(base))
    return base

  const ext = extname(base)
  if (ext)
    return undefined

  for (const candidateExt of RESOLVE_EXTS) {
    const candidate = `${base}${candidateExt}`
    if (fileExists(candidate))
      return candidate
  }

  for (const candidateExt of RESOLVE_EXTS) {
    const candidate = join(base, `index${candidateExt}`)
    if (fileExists(candidate))
      return candidate
  }

  return undefined
}

function resolveRelativeModule(fromFile: string, moduleSpecifier: string): string | undefined {
  return resolveFileLike(resolve(dirname(fromFile), moduleSpecifier))
}

function packageEntryFromExports(exportsValue: unknown): string | undefined {
  const rootExport = isRecord(exportsValue) && '.' in exportsValue
    ? exportsValue['.']
    : exportsValue

  if (isNonEmptyString(rootExport))
    return rootExport

  if (isRecord(rootExport) && isNonEmptyString(rootExport.source))
    return rootExport.source

  return undefined
}

function packageEntryPath(packageDir: string, packageJson: Record<string, unknown>): string | undefined {
  const candidates = [
    packageEntryFromExports(packageJson.exports),
    packageJson.source,
    './src/index.ts',
    './index.ts',
  ].filter(isNonEmptyString)

  for (const candidate of candidates) {
    const resolved = resolveFileLike(resolve(packageDir, candidate))
    if (resolved)
      return resolved
  }

  return undefined
}

export async function loadWorkspacePackages(root: string): Promise<Map<string, WorkspacePackage>> {
  const packages = new Map<string, WorkspacePackage>()
  const packageJsonPaths = ['package.json']

  for await (const entry of glob('packages/**/package.json', { cwd: root })) {
    if (!hasIgnoredSegment(entry))
      packageJsonPaths.push(entry)
  }

  for (const packageJsonPath of packageJsonPaths) {
    const absolutePath = resolve(root, packageJsonPath)
    if (!fileExists(absolutePath))
      continue

    const packageJson = parseJsonFile(absolutePath)
    if (!isRecord(packageJson) || !isNonEmptyString(packageJson.name))
      continue

    const packageDir = dirname(absolutePath)
    packages.set(packageJson.name, {
      entryPath: packageEntryPath(packageDir, packageJson),
      name: packageJson.name,
      packageDir,
    })
  }

  return packages
}

export function findNearestPackageName(ctx: DiscoveryContext, filePath: string): string {
  let best: WorkspacePackage | undefined
  for (const pkg of ctx.workspacePackages.values()) {
    const prefix = `${normalizePath(pkg.packageDir)}/`
    const file = normalizePath(filePath)
    if (file === normalizePath(pkg.packageDir) || file.startsWith(prefix)) {
      if (!best || pkg.packageDir.length > best.packageDir.length)
        best = pkg
    }
  }

  if (!best)
    throw new Error(`component source is outside known workspace packages: ${filePath}`)

  return best.name
}

function resolveModule(ctx: DiscoveryContext, fromFile: string, moduleSpecifier: string): string | undefined {
  if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/'))
    return resolveRelativeModule(fromFile, moduleSpecifier)

  const pkg = ctx.workspacePackages.get(moduleSpecifier)
  return pkg?.entryPath
}

export function resolveRequiredModule(ctx: DiscoveryContext, fromFile: string, moduleSpecifier: string): string {
  const target = resolveModule(ctx, fromFile, moduleSpecifier)
  if (!target)
    throw new Error(`cannot resolve module "${moduleSpecifier}" from ${fromFile}`)
  return target
}
