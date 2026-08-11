import type { ElementPlusDocsExternalProjectSource } from '@moluoxixi/vitepress-theme-element-plus'
import type { ElementPlusDocsDemoExternalProjectContext } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, parse as parsePath, resolve } from 'node:path'
import componentPlaygroundManifest from '@moluoxixi/components/playground-manifest'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

interface PlaygroundImportEntry {
  dependencies: Readonly<Record<string, string>>
  exports: readonly string[]
  styleImports: readonly string[]
}

interface Replacement {
  end: number
  start: number
  value: string
}

const require = createRequire(import.meta.url)
const packageVersionCache = new Map<string, string>()
const manifestImports = componentPlaygroundManifest.imports as Readonly<Record<string, PlaygroundImportEntry>>
const entryByExport = new Map<string, [string, PlaygroundImportEntry]>()

for (const [specifier, entry] of Object.entries(manifestImports)) {
  for (const exportedName of entry.exports) {
    if (entryByExport.has(exportedName))
      throw new Error(`Duplicate component playground export metadata for "${exportedName}".`)
    entryByExport.set(exportedName, [specifier, entry])
  }
}

function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
}

function readPackageVersion(packageName: string, demoId: string): string {
  const cached = packageVersionCache.get(packageName)
  if (cached)
    return cached

  let packageJsonPath: string | undefined
  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`)
  }
  catch {
    let directory = dirname(require.resolve(packageName))
    const root = parsePath(directory).root
    while (directory !== root) {
      const candidate = resolve(directory, 'package.json')
      if (existsSync(candidate)) {
        const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: unknown }
        if (manifest.name === packageName) {
          packageJsonPath = candidate
          break
        }
      }
      directory = dirname(directory)
    }
  }

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
  entry: PlaygroundImportEntry,
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
      if (!ts.isImportDeclaration(node)
        || !ts.isStringLiteralLike(node.moduleSpecifier)
        || node.moduleSpecifier.text !== componentPlaygroundManifest.packageName) {
        continue
      }

      const clause = node.importClause
      if (!clause)
        throw new Error(`Side-effect imports from ${componentPlaygroundManifest.packageName} are not supported.`)
      if (clause.name || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))) {
        throw new Error(`External playgrounds require named imports from ${componentPlaygroundManifest.packageName}.`)
      }
      if (!clause.namedBindings)
        continue

      const typeImports: string[] = []
      const runtimeImports = new Map<string, string[]>()
      for (const element of clause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text
        const renderedName = element.propertyName
          ? `${element.propertyName.text} as ${element.name.text}`
          : element.name.text

        if (clause.isTypeOnly || element.isTypeOnly) {
          typeImports.push(renderedName)
          continue
        }

        const resolvedEntry = entryByExport.get(importedName)
        if (!resolvedEntry) {
          throw new Error(
            `Missing component playground metadata for runtime export "${importedName}" from ${componentPlaygroundManifest.packageName}.`,
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
          componentPlaygroundManifest.packageName,
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

export function resolveComponentsExternalProjectSource(
  context: ElementPlusDocsDemoExternalProjectContext,
): ElementPlusDocsExternalProjectSource {
  const dependencies: Record<string, string> = {}
  const styleImports = new Set<string>()
  const transformedSource = transformComponentRootImports(context.code, dependencies, styleImports)

  for (const specifier of collectRuntimeModuleSpecifiers(transformedSource)) {
    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#'))
      continue

    const componentEntry = manifestImports[specifier]
    if (componentEntry) {
      mergeEntryMetadata(componentEntry, dependencies, styleImports)
      continue
    }
    if (specifier === `${componentPlaygroundManifest.packageName}/styles`)
      continue
    if (packageNameFromSpecifier(specifier) === componentPlaygroundManifest.packageName) {
      throw new Error(`Missing component playground metadata for subpath "${specifier}".`)
    }

    const packageName = packageNameFromSpecifier(specifier)
    dependencies[packageName] ??= readPackageVersion(packageName, context.demoId)
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
