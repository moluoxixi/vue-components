import type { DiscoveryContext } from './workspace-resolution'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import ts from 'typescript'
import { normalizePath, resolveRequiredModule } from './workspace-resolution'

interface ImportBinding {
  importedName: string
  moduleSpecifier: string
}

export interface ExportCandidate {
  exportName?: string
  filePath: string
  packageName: string
}

type SourceFile = ts.SourceFile

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
    const localKey = `${normalizePath(sourceFile.fileName)}#local#${unwrapped.text}#${packageName}#${exportName ?? '<anonymous>'}`
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
  const key = `${normalizePath(filePath)}#${requestedName}#${packageName}#${publicName ?? '<anonymous>'}`
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

export async function discoverEntryExports(
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

export function dedupeCandidates(candidates: ExportCandidate[]): ExportCandidate[] {
  const byFile = new Map<string, ExportCandidate>()

  for (const candidate of candidates) {
    const key = `${normalizePath(candidate.packageName)}:${normalizePath(candidate.filePath)}`
    const previous = byFile.get(key)
    if (!previous || exportNameScore(candidate.exportName) > exportNameScore(previous.exportName))
      byFile.set(key, candidate)
  }

  return Array.from(byFile.values())
}
