import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import {
  resolveRelativeModule,
  SOURCE_MODULE_EXTENSIONS,
  walkFiles,
} from '../utils/index.mjs'

function isTypeOnlyImport(node) {
  const clause = node.importClause
  if (!clause)
    return false
  if (clause.isTypeOnly)
    return true
  return !clause.name
    && ts.isNamedImports(clause.namedBindings)
    && clause.namedBindings.elements.every(element => element.isTypeOnly)
}

export function isTypeOnlyExport(node) {
  if (!ts.isExportDeclaration(node))
    return false
  if (node.isTypeOnly)
    return true
  return Boolean(node.exportClause)
    && ts.isNamedExports(node.exportClause)
    && node.exportClause.elements.length > 0
    && node.exportClause.elements.every(element => element.isTypeOnly)
}

function collectRuntimeImportBindings(node, bindings) {
  if (isTypeOnlyImport(node) || !node.importClause)
    return
  const { importClause } = node
  if (importClause.name)
    bindings.set(importClause.name.text, node.moduleSpecifier.text)
  if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
    bindings.set(importClause.namedBindings.name.text, node.moduleSpecifier.text)
    return
  }
  if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
    for (const element of importClause.namedBindings.elements) {
      if (!element.isTypeOnly)
        bindings.set(element.name.text, node.moduleSpecifier.text)
    }
  }
}

function exportedImportSpecifiers(statement, importBindings) {
  if (ts.isExportDeclaration(statement)
    && !statement.moduleSpecifier
    && statement.exportClause
    && ts.isNamedExports(statement.exportClause)) {
    return statement.exportClause.elements.flatMap((element) => {
      if (statement.isTypeOnly || element.isTypeOnly)
        return []
      const localName = element.propertyName?.text ?? element.name.text
      return importBindings.has(localName) ? [importBindings.get(localName)] : []
    })
  }
  if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
    const specifier = importBindings.get(statement.expression.text)
    return specifier ? [specifier] : []
  }
  return []
}

function isBarrelStatement(statement) {
  return ts.isExportDeclaration(statement)
    || (ts.isImportDeclaration(statement) && isTypeOnlyImport(statement))
    || ts.isInterfaceDeclaration(statement)
    || ts.isTypeAliasDeclaration(statement)
    || statement.kind === ts.SyntaxKind.EmptyStatement
}

export function readModuleScript(file) {
  const source = readFileSync(file, 'utf8')
  if (extname(file) !== '.vue')
    return source
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length > 0)
    throw new Error(`Failed to parse Vue component ${file}: ${String(errors[0])}`)
  return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
}

export function parseModule(file) {
  const source = readModuleScript(file)
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const allSpecifiers = []
  const exportSpecifiers = []
  const specifiers = []
  const importBindings = new Map()
  let barrel = /(?:^|[/\\])index\.[cm]?[jt]sx?$/u.test(file)
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier))
      collectRuntimeImportBindings(statement, importBindings)
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node)) {
        allSpecifiers.push(node.moduleSpecifier.text)
        specifiers.push(node.moduleSpecifier.text)
      }
    }
    else if (ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (!isTypeOnlyExport(node)) {
        allSpecifiers.push(node.moduleSpecifier.text)
        exportSpecifiers.push(node.moduleSpecifier.text)
        specifiers.push(node.moduleSpecifier.text)
      }
    }
    else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && ts.isStringLiteralLike(node.arguments[0])) {
      allSpecifiers.push(node.arguments[0].text)
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  for (const statement of sourceFile.statements) {
    for (const exportSpecifier of exportedImportSpecifiers(statement, importBindings))
      exportSpecifiers.push(exportSpecifier)
  }

  if (barrel)
    barrel = sourceFile.statements.every(isBarrelStatement)
  return { allSpecifiers, barrel, exportSpecifiers, sourceFile, specifiers }
}

export function createModuleGraph(sourceRoot, extraFiles = []) {
  const files = [...new Set([
    ...walkFiles(sourceRoot, file => SOURCE_MODULE_EXTENSIONS.includes(extname(file))),
    ...extraFiles,
  ])]
  const modules = new Map()
  const reverse = new Map()
  for (const file of files) {
    const parsed = parseModule(file)
    const dependencies = new Set(parsed.specifiers
      .map(specifier => resolveRelativeModule(file, specifier))
      .filter(Boolean))
    const exportDependencies = new Set(parsed.exportSpecifiers
      .map(specifier => resolveRelativeModule(file, specifier))
      .filter(Boolean))
    modules.set(file, { ...parsed, dependencies, exportDependencies })
    for (const dependency of dependencies) {
      if (!reverse.has(dependency))
        reverse.set(dependency, new Set())
      reverse.get(dependency).add(file)
    }
  }
  return { files, modules, reverse }
}

export function collectConcreteConsumers(graph, target) {
  const consumers = new Set()
  const visited = new Set([target])
  const pending = [target]
  while (pending.length > 0) {
    const current = pending.pop()
    for (const importer of graph.reverse.get(current) ?? []) {
      if (visited.has(importer))
        continue
      visited.add(importer)
      if (graph.modules.get(importer)?.barrel)
        pending.push(importer)
      else
        consumers.add(importer)
    }
  }
  return [...consumers]
}

export function moduleReaches(graph, source, target) {
  const visited = new Set()
  const pending = [source]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === target)
      return true
    if (!current || visited.has(current))
      continue
    visited.add(current)
    pending.push(...(graph.modules.get(current)?.exportDependencies ?? []))
  }
  return false
}
