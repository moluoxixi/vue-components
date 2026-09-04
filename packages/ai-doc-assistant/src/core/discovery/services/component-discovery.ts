import { existsSync, readFileSync, statSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import ts from 'typescript'

/** 组件源码发现结果：只代表公共入口导出的 SFC。 */
export interface ComponentSource {
  filePath: string
  packageName: string
  /** 公共入口上的导出名，用于 displayName 不可靠时兜底。 */
  exportName?: string
}

export interface ComponentDiscoveryOptions {
  /** 显式组件库入口文件（相对 root 或绝对路径）。 */
  componentEntries?: string[]
  /** legacy 显式 SFC glob；配置后不做入口解析。 */
  componentGlobs?: string[]
  /** 项目根目录。 */
  root: string
}

interface WorkspacePackage {
  entryPath?: string
  name: string
  packageDir: string
}

interface ImportBinding {
  importedName: string
  moduleSpecifier: string
}

interface ExportCandidate {
  exportName?: string
  filePath: string
  packageName: string
}

interface DiscoveryContext {
  root: string
  workspacePackages: Map<string, WorkspacePackage>
}

type SourceFile = ts.SourceFile

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

function normalizePath(path: string): string {
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

function fileExists(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

function resolvePath(root: string, path: string): string {
  return isAbsolute(path) ? path : resolve(root, path)
}

function resolveFileLike(base: string): string | undefined {
  if (fileExists(base))
    return base

  const ext = extname(base)
  if (ext) {
    return undefined
  }

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

function readSourceFile(filePath: string): SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && !!ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr
  while (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
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

async function loadWorkspacePackages(root: string): Promise<Map<string, WorkspacePackage>> {
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

function findNearestPackageName(ctx: DiscoveryContext, filePath: string): string {
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

function collectImports(sourceFile: SourceFile): Map<string, ImportBinding> {
  const imports = new Map<string, ImportBinding>()

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier))
      continue

    const moduleSpecifier = stmt.moduleSpecifier.text
    const clause = stmt.importClause
    if (!clause)
      continue

    if (clause.name) {
      imports.set(clause.name.text, {
        importedName: 'default',
        moduleSpecifier,
      })
    }

    const namedBindings = clause.namedBindings
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        imports.set(element.name.text, {
          importedName: element.propertyName?.text ?? element.name.text,
          moduleSpecifier,
        })
      }
    }
  }

  return imports
}

function findVariableInitializer(sourceFile: SourceFile, name: string): ts.Expression | undefined {
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt))
      continue

    for (const declaration of stmt.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration.initializer
    }
  }

  return undefined
}

function resolveModule(ctx: DiscoveryContext, fromFile: string, moduleSpecifier: string): string | undefined {
  if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/'))
    return resolveRelativeModule(fromFile, moduleSpecifier)

  const pkg = ctx.workspacePackages.get(moduleSpecifier)
  return pkg?.entryPath
}

function resolveRequiredModule(ctx: DiscoveryContext, fromFile: string, moduleSpecifier: string): string {
  const target = resolveModule(ctx, fromFile, moduleSpecifier)
  if (!target)
    throw new Error(`cannot resolve module "${moduleSpecifier}" from ${fromFile}`)
  return target
}

async function resolveExpressionToSfc(
  ctx: DiscoveryContext,
  sourceFile: SourceFile,
  imports: Map<string, ImportBinding>,
  expr: ts.Expression,
  packageName: string,
  exportName: string | undefined,
  seen: Set<string>,
): Promise<ExportCandidate[]> {
  const unwrapped = unwrapExpression(expr)

  if (ts.isIdentifier(unwrapped)) {
    const localKey = `${normalizePath(sourceFile.fileName)}#local#${unwrapped.text}#${packageName}`
    if (!seen.has(localKey)) {
      const initializer = findVariableInitializer(sourceFile, unwrapped.text)
      if (initializer) {
        seen.add(localKey)
        return resolveExpressionToSfc(ctx, sourceFile, imports, initializer, packageName, exportName, seen)
      }
    }

    const binding = imports.get(unwrapped.text)
    if (!binding)
      return []

    const target = resolveRequiredModule(ctx, sourceFile.fileName, binding.moduleSpecifier)

    if (extname(target) === '.vue') {
      return [{
        exportName,
        filePath: target,
        packageName,
      }]
    }

    return resolveExportFromFile(ctx, target, binding.importedName, exportName, packageName, seen)
  }

  if (ts.isCallExpression(unwrapped) && unwrapped.arguments[0]) {
    return resolveExpressionToSfc(ctx, sourceFile, imports, unwrapped.arguments[0], packageName, exportName, seen)
  }

  return []
}

async function resolveLocalExport(
  ctx: DiscoveryContext,
  filePath: string,
  localName: string,
  publicName: string | undefined,
  packageName: string,
  seen: Set<string>,
): Promise<ExportCandidate[]> {
  const sourceFile = readSourceFile(filePath)
  const imports = collectImports(sourceFile)

  for (const stmt of sourceFile.statements) {
    if (
      ts.isVariableStatement(stmt)
      && isExported(stmt)
      && stmt.declarationList.declarations.length
    ) {
      for (const declaration of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== localName || !declaration.initializer)
          continue

        return resolveExpressionToSfc(ctx, sourceFile, imports, declaration.initializer, packageName, publicName, seen)
      }
    }
  }

  const importBinding = imports.get(localName)
  if (importBinding) {
    const target = resolveRequiredModule(ctx, filePath, importBinding.moduleSpecifier)

    if (extname(target) === '.vue') {
      return [{
        exportName: publicName,
        filePath: target,
        packageName,
      }]
    }

    return resolveExportFromFile(ctx, target, importBinding.importedName, publicName, packageName, seen)
  }

  return []
}

async function resolveExportFromFile(
  ctx: DiscoveryContext,
  filePath: string,
  requestedName: string,
  publicName: string | undefined,
  packageName: string,
  seen: Set<string>,
): Promise<ExportCandidate[]> {
  const key = `${normalizePath(filePath)}#${requestedName}#${packageName}`
  if (seen.has(key))
    return []
  seen.add(key)

  const sourceFile = readSourceFile(filePath)

  for (const stmt of sourceFile.statements) {
    if (!ts.isExportDeclaration(stmt) || stmt.isTypeOnly)
      continue

    const moduleSpecifier = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
      ? stmt.moduleSpecifier.text
      : undefined
    if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause))
      continue

    for (const element of stmt.exportClause.elements) {
      const exportedName = element.name.text
      if (exportedName !== requestedName)
        continue

      const importedName = element.propertyName?.text ?? exportedName
      if (!moduleSpecifier)
        return resolveLocalExport(ctx, filePath, importedName, publicName, packageName, seen)

      const target = resolveRequiredModule(ctx, filePath, moduleSpecifier)

      if (extname(target) === '.vue') {
        return [{
          exportName: publicName,
          filePath: target,
          packageName,
        }]
      }

      return resolveExportFromFile(ctx, target, importedName, publicName, packageName, seen)
    }
  }

  if (requestedName === 'default') {
    for (const stmt of sourceFile.statements) {
      if (!ts.isExportAssignment(stmt))
        continue

      return resolveExpressionToSfc(ctx, sourceFile, collectImports(sourceFile), stmt.expression, packageName, publicName, seen)
    }
  }

  return resolveLocalExport(ctx, filePath, requestedName, publicName, packageName, seen)
}

async function discoverEntryExports(
  ctx: DiscoveryContext,
  entryPath: string,
  packageName: string,
  seen: Set<string>,
): Promise<ExportCandidate[]> {
  const key = `${normalizePath(entryPath)}#*#${packageName}`
  if (seen.has(key))
    return []
  seen.add(key)

  const sourceFile = readSourceFile(entryPath)
  const imports = collectImports(sourceFile)
  const candidates: ExportCandidate[] = []

  for (const stmt of sourceFile.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly)
        continue

      const moduleSpecifier = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined
      if (!stmt.exportClause) {
        if (!moduleSpecifier)
          continue
        const target = resolveRequiredModule(ctx, entryPath, moduleSpecifier)
        if (extname(target) !== '.vue')
          candidates.push(...await discoverEntryExports(ctx, target, packageName, seen))
        continue
      }

      if (!ts.isNamedExports(stmt.exportClause))
        continue

      for (const element of stmt.exportClause.elements) {
        const exportName = element.name.text
        const importedName = element.propertyName?.text ?? exportName
        if (!moduleSpecifier) {
          candidates.push(...await resolveLocalExport(ctx, entryPath, importedName, exportName, packageName, seen))
          continue
        }
        const target = resolveRequiredModule(ctx, entryPath, moduleSpecifier)
        if (extname(target) === '.vue') {
          candidates.push({ exportName, filePath: target, packageName })
        }
        else {
          candidates.push(...await resolveExportFromFile(ctx, target, importedName, exportName, packageName, seen))
        }
      }

      continue
    }

    if (
      ts.isVariableStatement(stmt)
      && isExported(stmt)
      && stmt.declarationList.declarations.length
    ) {
      for (const declaration of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
          continue

        candidates.push(
          ...await resolveExpressionToSfc(
            ctx,
            sourceFile,
            imports,
            declaration.initializer,
            packageName,
            declaration.name.text,
            seen,
          ),
        )
      }
    }
  }

  return candidates
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

function exportNameScore(name: string | undefined): number {
  if (!name)
    return 0
  return isPascalCase(name) ? 2 : 1
}

function dedupeCandidates(candidates: ExportCandidate[]): ComponentSource[] {
  const byFile = new Map<string, ExportCandidate>()

  for (const candidate of candidates) {
    const key = `${normalizePath(candidate.packageName)}:${normalizePath(candidate.filePath)}`
    const previous = byFile.get(key)
    if (!previous || exportNameScore(candidate.exportName) > exportNameScore(previous.exportName))
      byFile.set(key, candidate)
  }

  return Array.from(byFile.values())
}

async function discoverFromEntries(ctx: DiscoveryContext, entries: string[]): Promise<ComponentSource[]> {
  const candidates: ExportCandidate[] = []

  for (const entry of entries) {
    const entryPath = resolvePath(ctx.root, entry)
    if (!fileExists(entryPath))
      throw new Error(`component entry not found: ${entry}`)

    const packageName = findNearestPackageName(ctx, entryPath)
    candidates.push(...await discoverEntryExports(ctx, entryPath, packageName, new Set()))
  }

  const components = dedupeCandidates(candidates)
  if (!components.length)
    throw new Error(`no public Vue components exported from configured entries: ${entries.join(', ')}`)

  return components
}

async function discoverFromGlobs(ctx: DiscoveryContext, globs: string[]): Promise<ComponentSource[]> {
  const candidates: ComponentSource[] = []

  for (const pattern of globs) {
    for await (const entry of glob(pattern, { cwd: ctx.root })) {
      const filePath = resolve(ctx.root, entry)
      if (extname(filePath) !== '.vue')
        continue
      candidates.push({
        filePath,
        packageName: findNearestPackageName(ctx, filePath),
      })
    }
  }

  if (!candidates.length)
    throw new Error(`componentGlobs matched no Vue component files: ${globs.join(', ')}`)

  return candidates
}

function autoEntries(packages: Map<string, WorkspacePackage>): WorkspacePackage[] {
  return Array.from(packages.values())
    .filter(pkg => pkg.entryPath)
    .sort((a, b) => normalizePath(a.entryPath!).localeCompare(normalizePath(b.entryPath!), 'en'))
}

async function discoverAuto(ctx: DiscoveryContext): Promise<ComponentSource[]> {
  const rootPackage = Array.from(ctx.workspacePackages.values()).find(pkg =>
    normalizePath(pkg.packageDir) === normalizePath(ctx.root) && pkg.entryPath,
  )

  if (rootPackage?.entryPath) {
    const components = dedupeCandidates(await discoverEntryExports(ctx, rootPackage.entryPath, rootPackage.name, new Set()))
    if (!components.length) {
      throw new Error(
        `component entry auto-discovery failed: no public Vue components exported from root package entry ${rootPackage.entryPath}`,
      )
    }
    return components
  }

  const discovered: { components: ComponentSource[], pkg: WorkspacePackage }[] = []
  const entries = autoEntries(ctx.workspacePackages)
  if (!entries.length)
    throw new Error('component entry auto-discovery failed: no package public source entry found')

  for (const pkg of entries) {
    const components = dedupeCandidates(await discoverEntryExports(ctx, pkg.entryPath!, pkg.name, new Set()))
    if (components.length)
      discovered.push({ components, pkg })
  }

  if (!discovered.length)
    throw new Error('component entry auto-discovery failed: no public Vue components exported from package entries')

  if (discovered.length > 1) {
    const names = discovered.map(item => `${item.pkg.name}:${normalizePath(item.pkg.entryPath!)}`).join(', ')
    throw new Error(`multiple component package entries found (${names}); configure componentEntries`)
  }

  return discovered[0].components
}

/**
 * 发现组件库公共组件源码。
 *
 * 规则：
 * - componentEntries 与 componentGlobs 都是显式配置，二者同时出现即配置冲突。
 * - 未配置时仅从 package public entry 自动识别；识别或解析不到组件即失败。
 * - 不从入口解析失败降级到 glob，避免把内部实现组件误当公共契约。
 */
export async function discoverComponentSources(options: ComponentDiscoveryOptions): Promise<ComponentSource[]> {
  if (options.componentEntries?.length && options.componentGlobs?.length) {
    throw new Error('componentEntries and componentGlobs cannot be used together')
  }

  const workspacePackages = await loadWorkspacePackages(options.root)
  const ctx: DiscoveryContext = { root: options.root, workspacePackages }

  if (options.componentEntries?.length)
    return discoverFromEntries(ctx, options.componentEntries)

  if (options.componentGlobs?.length)
    return discoverFromGlobs(ctx, options.componentGlobs)

  return discoverAuto(ctx)
}
