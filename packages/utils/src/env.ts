import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export interface PackageManifest {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateDependencySection(section: unknown, fieldName: string, pkgPath: string): Record<string, string> {
  if (section == null) {
    return {}
  }

  if (!isRecord(section)) {
    throw new TypeError(`[core] invalid package.json field \"${fieldName}\" at ${pkgPath}: expected an object map`)
  }

  const validated: Record<string, string> = {}
  for (const [name, version] of Object.entries(section)) {
    if (typeof version !== 'string') {
      throw new TypeError(`[core] invalid package.json field \"${fieldName}.${name}\" at ${pkgPath}: expected a string version`)
    }
    validated[name] = version
  }

  return validated
}

export interface DependencyDetectionResult {
  addonDeps: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
  optionalDependencies: Record<string, string>
  deps: Record<string, string>
  runtimeDeps: Record<string, string>
}

/**
 * 判断给定路径是否存在文件或目录；只暴露布尔结果，不吞掉后续读取错误。
 */
export function isFileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

/**
 * 读取目标目录的 package.json；缺失、JSON 解析失败或根结构非法时直接抛出带路径的错误。
 */
export function readPackageJSON(cwd: string = process.cwd()): PackageManifest {
  const pkgPath = path.resolve(cwd, 'package.json')
  if (!isFileExists(pkgPath)) {
    throw new Error(`[core] package.json not found at ${pkgPath}`)
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as unknown
    if (!isRecord(parsed)) {
      throw new Error(`[core] invalid package.json shape at ${pkgPath}: expected an object`)
    }

    return {
      ...parsed,
      dependencies: validateDependencySection(parsed.dependencies, 'dependencies', pkgPath),
      devDependencies: validateDependencySection(parsed.devDependencies, 'devDependencies', pkgPath),
      optionalDependencies: validateDependencySection(parsed.optionalDependencies, 'optionalDependencies', pkgPath),
      peerDependencies: validateDependencySection(parsed.peerDependencies, 'peerDependencies', pkgPath),
    }
  }
  catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('[core]')) {
      throw cause
    }

    throw new Error(`[core] failed to read package.json at ${pkgPath}`, { cause })
  }
}

/**
 * 侦测目标项目 manifest 中的所有依赖声明；不会用空对象伪装缺失 manifest。
 */
export function detectDependencies(cwd: string = process.cwd()): DependencyDetectionResult {
  const pkg = readPackageJSON(cwd)
  const dependencies = { ...(pkg.dependencies || {}) }
  const devDependencies = { ...(pkg.devDependencies || {}) }
  const peerDependencies = { ...(pkg.peerDependencies || {}) }
  const optionalDependencies = { ...(pkg.optionalDependencies || {}) }
  const runtimeDeps = {
    ...dependencies,
    ...peerDependencies,
    ...optionalDependencies,
  }
  const deps = {
    ...runtimeDeps,
    ...devDependencies,
  }
  const addonDeps = { ...deps }

  return {
    addonDeps,
    dependencies,
    devDependencies,
    deps,
    optionalDependencies,
    peerDependencies,
    runtimeDeps,
  }
}
