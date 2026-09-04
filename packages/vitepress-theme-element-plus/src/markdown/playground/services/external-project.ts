import type { ElementPlusDocsExternalProjectSource } from '../../../content/playground/external/vue-project'
import type {
  ElementPlusDocsComponentPackage,
  ElementPlusDocsPlaygroundManifest,
  ElementPlusDocsPlaygroundManifestEntry,
  ElementPlusDocsProject,
} from '../../../project/types'
import type { ElementPlusDocsDemoExternalProjectContext } from '../../demo'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

interface Replacement {
  end: number
  start: number
  value: string
}

interface ExternalProjectRuntime {
  assertPackageSpecifier: (specifier: string, demoId: string) => void
  entryByPackageExport: ReadonlyMap<string, ReadonlyMap<string, [string, ElementPlusDocsPlaygroundManifestEntry]>>
  manifestImports: ReadonlyMap<string, ElementPlusDocsPlaygroundManifestEntry>
  manifestsByPackage: ReadonlyMap<string, ElementPlusDocsPlaygroundManifest>
  packagesByName: ReadonlyMap<string, ElementPlusDocsComponentPackage>
  resolvePackageVersion: (packageName: string, demoId: string) => string
}

interface DocumentationPackageManifest {
  dependencies?: Readonly<Record<string, string>>
  devDependencies?: Readonly<Record<string, string>>
  optionalDependencies?: Readonly<Record<string, string>>
  peerDependencies?: Readonly<Record<string, string>>
}

interface InstalledPackageManifest {
  exports?: unknown
  name?: unknown
  version?: unknown
}

function hasRuntimeExportTarget(target: unknown): boolean {
  if (typeof target === 'string')
    return true
  if (Array.isArray(target))
    return target.some(hasRuntimeExportTarget)
  if (!target || typeof target !== 'object')
    return false
  return Object.entries(target).some(([condition, value]) => (
    condition !== 'types' && hasRuntimeExportTarget(value)
  ))
}

function packageExportSubpath(packageName: string, specifier: string): string {
  return specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`
}

function packageExportsSpecifier(
  manifest: InstalledPackageManifest,
  packageName: string,
  specifier: string,
): boolean | undefined {
  const configured = manifest.exports
  if (configured === undefined)
    return undefined
  const subpath = packageExportSubpath(packageName, specifier)
  if (!configured || typeof configured !== 'object' || Array.isArray(configured) || typeof configured === 'string')
    return subpath === '.' && hasRuntimeExportTarget(configured)

  const entries = Object.entries(configured)
  if (!entries.some(([key]) => key.startsWith('.')))
    return subpath === '.' && hasRuntimeExportTarget(configured)
  if (Object.hasOwn(configured, subpath))
    return hasRuntimeExportTarget((configured as Record<string, unknown>)[subpath])

  const pattern = entries
    .filter(([key]) => key.includes('*'))
    .filter(([key]) => {
      const [prefix, suffix] = key.split('*') as [string, string]
      return subpath.startsWith(prefix) && subpath.endsWith(suffix)
    })
    .sort(([left], [right]) => right.length - left.length)[0]
  return pattern ? hasRuntimeExportTarget(pattern[1]) : false
}

function resolveInstalledPackageManifest(
  require: ReturnType<typeof createRequire>,
  packageName: string,
): string | undefined {
  for (const modulesDirectory of require.resolve.paths(packageName) ?? []) {
    const candidate = resolve(modulesDirectory, ...packageName.split('/'), 'package.json')
    if (!existsSync(candidate))
      continue
    const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as InstalledPackageManifest
    if (manifest.name === packageName)
      return candidate
  }
  return undefined
}

function assertPackageSpecifierResolvable(
  require: ReturnType<typeof createRequire>,
  packageName: string,
  specifier: string,
  demoId: string,
): void {
  const packageJsonPath = resolveInstalledPackageManifest(require, packageName)
  if (!packageJsonPath) {
    throw new Error(
      `Cannot resolve external playground dependency "${packageName}" in ${demoId}. Declare it in the documentation package.`,
    )
  }
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as InstalledPackageManifest
  const exported = packageExportsSpecifier(manifest, packageName, specifier)
  if (exported === false) {
    throw new Error(
      `External playground import "${specifier}" in ${demoId} is not exported by ${packageName}.`,
    )
  }
  if (exported === true)
    return
  try {
    require.resolve(specifier)
  }
  catch {
    throw new Error(
      `Cannot resolve external playground import "${specifier}" in ${demoId}.`,
    )
  }
}

function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
}

function readPackageVersion(
  require: ReturnType<typeof createRequire>,
  packageVersionCache: Map<string, string>,
  declaredDependencies: ReadonlySet<string>,
  packageName: string,
  demoId: string,
): string {
  const cached = packageVersionCache.get(packageName)
  if (cached)
    return cached
  if (!declaredDependencies.has(packageName)) {
    throw new Error(
      `External playground dependency "${packageName}" in ${demoId} is not declared by the documentation package.`,
    )
  }

  const packageJsonPath = resolveInstalledPackageManifest(require, packageName)
  if (!packageJsonPath) {
    throw new Error(
      `Cannot resolve external playground dependency "${packageName}" in ${demoId}. Declare it in the documentation package.`,
    )
  }

  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string' || !manifest.version) {
    throw new TypeError(`External playground dependency "${packageName}" has no valid package version.`)
  }
  packageVersionCache.set(packageName, manifest.version)
  return manifest.version
}

function scriptKind(language: string | undefined): ts.ScriptKind {
  if (language === 'tsx')
    return ts.ScriptKind.TSX
  if (language === 'jsx')
    return ts.ScriptKind.JSX
  return language === 'ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS
}

function mergeEntryMetadata(
  entry: ElementPlusDocsPlaygroundManifestEntry,
  dependencies: Record<string, string>,
  styleImports: Set<string>,
): void {
  for (const [name, version] of Object.entries(entry.dependencies)) {
    const existingVersion = dependencies[name]
    if (existingVersion && existingVersion !== version) {
      throw new Error(`Conflicting external playground versions for ${name}: ${existingVersion} and ${version}`)
    }
    dependencies[name] = version
  }
  for (const styleImport of entry.styleImports)
    styleImports.add(styleImport)
}

function renderNamedImport(names: readonly string[], specifier: string, typeOnly = false): string {
  return `import ${typeOnly ? 'type ' : ''}{ ${names.join(', ')} } from '${specifier}'`
}

function transformComponentRootImports(
  runtime: ExternalProjectRuntime,
  source: string,
  dependencies: Record<string, string>,
  styleImports: Set<string>,
): string {
  const { descriptor, errors } = parse(source, { filename: 'demo.vue' })
  if (errors.length > 0)
    throw new Error(`Unable to parse demo SFC: ${errors.map(String).join('; ')}`)

  const replacements: Replacement[] = []
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block)
      continue
    const sourceFile = ts.createSourceFile(
      'demo-script',
      block.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(block.lang),
    )

    for (const node of sourceFile.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteralLike(node.moduleSpecifier)) {
        continue
      }
      const packageName = node.moduleSpecifier.text
      const manifest = runtime.manifestsByPackage.get(packageName)
      if (!manifest)
        continue

      const clause = node.importClause
      if (!clause)
        throw new Error(`Side-effect imports from ${packageName} are not supported.`)
      const namedBindings = clause.namedBindings
      if (clause.name) {
        throw new Error(`External playgrounds require named imports from ${packageName}.`)
      }
      if (namedBindings && ts.isNamespaceImport(namedBindings))
        throw new Error(`External playgrounds require named imports from ${packageName}.`)
      if (!namedBindings)
        continue
      if (!ts.isNamedImports(namedBindings))
        throw new TypeError(`External playground import bindings are invalid for ${packageName}.`)

      const typeImports: string[] = []
      const runtimeImports = new Map<string, string[]>()
      for (const element of namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text
        const renderedName = element.propertyName
          ? `${element.propertyName.text} as ${element.name.text}`
          : element.name.text

        if (clause.isTypeOnly || element.isTypeOnly) {
          typeImports.push(renderedName)
          continue
        }

        const resolvedEntry = runtime.entryByPackageExport.get(packageName)?.get(importedName)
        if (!resolvedEntry) {
          throw new Error(
            `Missing component playground metadata for runtime export "${importedName}" from ${packageName}.`,
          )
        }
        const [targetSpecifier, entry] = resolvedEntry
        const imports = runtimeImports.get(targetSpecifier) ?? []
        imports.push(renderedName)
        runtimeImports.set(targetSpecifier, imports)
        mergeEntryMetadata(entry, dependencies, styleImports)
      }

      const renderedImports = [...runtimeImports].map(([specifier, names]) => (
        renderNamedImport(names, specifier)
      ))
      if (typeImports.length > 0) {
        renderedImports.push(renderNamedImport(
          typeImports,
          manifest.packageName,
          true,
        ))
      }
      replacements.push({
        end: block.loc.start.offset + node.end,
        start: block.loc.start.offset + node.getStart(sourceFile),
        value: renderedImports.join('\n'),
      })
    }
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce((output, replacement) => (
      `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`
    ), source)
}

function collectRuntimeModuleSpecifiers(source: string): Set<string> {
  const { descriptor, errors } = parse(source, { filename: 'demo.vue' })
  if (errors.length > 0)
    throw new Error(`Unable to parse transformed demo SFC: ${errors.map(String).join('; ')}`)

  const specifiers = new Set<string>()
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block)
      continue
    const sourceFile = ts.createSourceFile(
      'demo-script',
      block.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(block.lang),
    )
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const namedImports = node.importClause?.namedBindings
        const onlyTypeSpecifiers = namedImports && ts.isNamedImports(namedImports)
          && namedImports.elements.length > 0
          && namedImports.elements.every(element => element.isTypeOnly)
        if (!node.importClause?.isTypeOnly && !onlyTypeSpecifiers)
          specifiers.add(node.moduleSpecifier.text)
      }
      else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        specifiers.add(node.moduleSpecifier.text)
      }
      else if (
        ts.isCallExpression(node)
        && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1
        && ts.isStringLiteralLike(node.arguments[0]!)
      ) {
        specifiers.add(node.arguments[0].text)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return specifiers
}

function createExternalProjectRuntime(
  project: ElementPlusDocsProject,
  dependencyRoot: string,
  playgroundManifests: Readonly<Record<string, ElementPlusDocsPlaygroundManifest>>,
  resolvePackageVersion?: (packageName: string, demoId: string) => string,
): ExternalProjectRuntime {
  const packagesByName = new Map(Object.values(project.packages).map(profile => [profile.name, profile]))
  const manifestsByPackage = new Map<string, ElementPlusDocsPlaygroundManifest>()
  const manifestImports = new Map<string, ElementPlusDocsPlaygroundManifestEntry>()
  const entryByPackageExport = new Map<string, ReadonlyMap<string, [string, ElementPlusDocsPlaygroundManifestEntry]>>()
  for (const [packageId, profile] of Object.entries(project.packages)) {
    const manifest = playgroundManifests[packageId]
    if (!manifest)
      continue
    manifestsByPackage.set(profile.name, manifest)
    const entryByExport = new Map<string, [string, ElementPlusDocsPlaygroundManifestEntry]>()
    for (const [specifier, entry] of Object.entries(manifest.imports)) {
      if (manifestImports.has(specifier))
        throw new Error(`Duplicate playground manifest entry for "${specifier}".`)
      manifestImports.set(specifier, entry)
      for (const exportedName of entry.exports) {
        if (entryByExport.has(exportedName))
          throw new Error(`Duplicate playground export metadata for "${exportedName}" from ${profile.name}.`)
        entryByExport.set(exportedName, [specifier, entry])
      }
    }
    entryByPackageExport.set(profile.name, entryByExport)
  }
  const packageVersionCache = new Map<string, string>()
  const dependencyManifestPath = resolve(dependencyRoot, 'package.json')
  const dependencyManifest = JSON.parse(readFileSync(dependencyManifestPath, 'utf8')) as DocumentationPackageManifest
  const declaredDependencies = new Set([
    ...Object.keys(dependencyManifest.dependencies ?? {}),
    ...Object.keys(dependencyManifest.devDependencies ?? {}),
    ...Object.keys(dependencyManifest.optionalDependencies ?? {}),
    ...Object.keys(dependencyManifest.peerDependencies ?? {}),
  ])
  const require = createRequire(dependencyManifestPath)
  return {
    assertPackageSpecifier: resolvePackageVersion
      ? () => {}
      : (specifier, demoId) => assertPackageSpecifierResolvable(
          require,
          packageNameFromSpecifier(specifier),
          specifier,
          demoId,
        ),
    entryByPackageExport,
    manifestImports,
    manifestsByPackage,
    packagesByName,
    resolvePackageVersion: resolvePackageVersion
      ?? ((packageName, demoId) => readPackageVersion(
        require,
        packageVersionCache,
        declaredDependencies,
        packageName,
        demoId,
      )),
  }
}

export function createElementPlusDocsExternalProjectSourceResolver(options: {
  dependencyRoot: string
  playgroundManifests: Readonly<Record<string, ElementPlusDocsPlaygroundManifest>>
  project: ElementPlusDocsProject
  resolvePackageVersion?: (packageName: string, demoId: string) => string
}): (context: ElementPlusDocsDemoExternalProjectContext) => ElementPlusDocsExternalProjectSource {
  const runtime = createExternalProjectRuntime(
    options.project,
    options.dependencyRoot,
    options.playgroundManifests,
    options.resolvePackageVersion,
  )
  return (context) => {
    const dependencies: Record<string, string> = {}
    const styleImports = new Set<string>()
    const transformedSource = transformComponentRootImports(runtime, context.code, dependencies, styleImports)

    for (const specifier of collectRuntimeModuleSpecifiers(transformedSource)) {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#'))
        continue

      const manifestEntry = runtime.manifestImports.get(specifier)
      if (manifestEntry) {
        mergeEntryMetadata(manifestEntry, dependencies, styleImports)
        continue
      }
      const packageName = packageNameFromSpecifier(specifier)
      const profile = runtime.packagesByName.get(packageName)
      if (profile?.styles.includes(specifier)) {
        styleImports.add(specifier)
        continue
      }
      if (runtime.manifestsByPackage.has(packageName))
        throw new Error(`Missing component playground metadata for subpath "${specifier}".`)

      dependencies[packageName] ??= runtime.resolvePackageVersion(packageName, context.demoId)
      runtime.assertPackageSpecifier(specifier, context.demoId)
      for (const style of profile?.styles ?? [])
        styleImports.add(style)
    }

    if (dependencies['element-plus'])
      styleImports.add('element-plus/dist/index.css')

    return {
      dependencies: Object.fromEntries(
        Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)),
      ),
      source: transformedSource,
      styleImports: [...styleImports],
    }
  }
}
