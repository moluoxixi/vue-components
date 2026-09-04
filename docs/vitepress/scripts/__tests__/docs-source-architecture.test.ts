// @vitest-environment node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const docsRoot = fileURLToPath(new URL('../..', import.meta.url))
const vitepressRoot = join(docsRoot, '.vitepress')

const featureRoots = [
  'catalog',
  'site',
  'theme',
] as const

const removedFlatModules = [
  'catalog/component-manifest.ts',
  'catalog/docs-i18n.ts',
  'catalog/utility-manifest.ts',
  'site/auto-loaders.ts',
  'site/docs-site.ts',
  'site/generated-paths.ts',
  'site/repository-config.ts',
  'site/repository.ts',
  'theme/content.ts',
  'theme/content.test.ts',
] as const

const nodeLifecycleEntries = [
  'scripts/generate-component-routes.mts',
  'scripts/generate-utility-routes.mts',
  'scripts/extract-api.mts',
] as const

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.name.endsWith('.ts') || entry.name.endsWith('.mts')
        ? [path]
        : []
  })
}

function collectResponsibilityDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name === '__tests__')
      return []
    const path = join(directory, entry.name)
    return [path, ...collectResponsibilityDirectories(path)]
  })
}

function runtimeSpecifiers(path: string): string[] {
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const importsOnlyTypes = node.importClause?.isTypeOnly
        || Boolean(node.importClause
          && !node.importClause.name
          && node.importClause.namedBindings
          && ts.isNamedImports(node.importClause.namedBindings)
          && node.importClause.namedBindings.elements.every(element => element.isTypeOnly))
      if (!importsOnlyTypes && ts.isStringLiteral(node.moduleSpecifier))
        specifiers.push(node.moduleSpecifier.text)
    }
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) {
      const exportsOnlyTypes = Boolean(
        node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.every(element => element.isTypeOnly),
      )
      if (!exportsOnlyTypes && ts.isStringLiteral(node.moduleSpecifier))
        specifiers.push(node.moduleSpecifier.text)
    }
    else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

function collectNodeRuntimeImportViolations(): string[] {
  const pending = nodeLifecycleEntries.map(entry => join(docsRoot, entry))
  const visited = new Set<string>()
  const violations: string[] = []

  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path))
      continue
    visited.add(path)

    for (const specifier of runtimeSpecifiers(path).filter(specifier => specifier.startsWith('.'))) {
      const location = `${relative(docsRoot, path).replaceAll('\\', '/')}: ${specifier}`
      if (!/\.(?:[cm]?[jt]s|json)$/.test(specifier)) {
        violations.push(location)
        continue
      }

      const dependency = resolve(dirname(path), specifier)
      if (!existsSync(dependency)) {
        violations.push(`${location} (missing)`)
        continue
      }
      if (/\.[cm]?[jt]s$/.test(dependency) && !visited.has(dependency))
        pending.push(dependency)
    }
  }

  return violations.sort()
}

function resolveLocalModule(importer: string, specifier: string): string | undefined {
  const target = resolve(dirname(importer), specifier)
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.mts`,
    join(target, 'index.ts'),
    join(target, 'index.mts'),
  ]
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile())
}

function collectClientNodeImportViolations(): string[] {
  const pending = [join(vitepressRoot, 'theme/index.ts')]
  const visited = new Set<string>()
  const violations: string[] = []

  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path))
      continue
    visited.add(path)

    for (const specifier of runtimeSpecifiers(path)) {
      if (specifier.startsWith('node:')) {
        violations.push(`${relative(docsRoot, path).replaceAll('\\', '/')}: ${specifier}`)
        continue
      }
      if (!specifier.startsWith('.'))
        continue
      const dependency = resolveLocalModule(path, specifier)
      if (dependency && /\.[cm]?[jt]s$/.test(dependency) && !visited.has(dependency))
        pending.push(dependency)
    }
  }

  return violations.sort()
}

function hasGlobalSourceResolveCondition(path: string): boolean {
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  let found = false

  function visit(node: ts.Node): void {
    if (ts.isPropertyAssignment(node)
      && node.name.getText(sourceFile) === 'conditions'
      && ts.isArrayLiteralExpression(node.initializer)
      && node.initializer.elements.some(element => ts.isStringLiteral(element) && element.text === 'source')) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return found
}

describe('documentation source architecture', () => {
  it('keeps feature roots limited to barrels and responsibility directories', () => {
    const unexpectedFiles = featureRoots.flatMap((root) => {
      const directory = join(vitepressRoot, root)
      return readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name !== 'index.ts')
        .map(entry => `${root}/${entry.name}`)
    })

    expect(unexpectedFiles).toEqual([])
  })

  it('gives every responsibility directory a local barrel', () => {
    const missingBarrels = featureRoots.flatMap((root) => {
      const directory = join(vitepressRoot, root)
      return collectResponsibilityDirectories(directory)
        .filter(path => !existsSync(join(path, 'index.ts')))
        .map(path => relative(vitepressRoot, path).replaceAll('\\', '/'))
    })

    expect(missingBarrels).toEqual([])
  })

  it('does not restore removed flat modules or imports', () => {
    expect(removedFlatModules.filter(path => existsSync(join(vitepressRoot, path))))
      .toEqual([])

    const forbiddenImport = /from\s+['"][^'"]*(?:catalog\/(?:component-manifest|docs-i18n|utility-manifest)|site\/(?:auto-loaders|docs-site|generated-paths|repository-config)|theme\/content)(?:\.ts)?['"]/g
    const importHits = collectTypeScriptFiles(docsRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(forbiddenImport)].map(match => (
        `${relative(docsRoot, path).replaceAll('\\', '/')}: ${match[0]}`
      ))
    })

    expect(importHits).toEqual([])
  })

  it('keeps Node lifecycle runtime imports directly resolvable by native ESM', () => {
    expect(collectNodeRuntimeImportViolations()).toEqual([])
  })

  it('keeps Node builtins out of the browser theme module graph', () => {
    expect(collectClientNodeImportViolations()).toEqual([])
  })

  it('consumes built package exports without a global source resolve condition', () => {
    expect(hasGlobalSourceResolveCondition(join(vitepressRoot, 'config.ts'))).toBe(false)
  })
})
