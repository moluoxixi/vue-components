import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import ts from 'typescript'
import {
  normalizeRepositoryPath,
  resolveRelativeModule,
  walkFiles,
} from '../utils/index.mjs'
import { parseModule } from './module-graph.mjs'
import {
  diagnostic,
  isProductionModule,
  nearestResponsibilityDirectory,
} from './rule-utils.mjs'

const VUE_OWNERSHIP_APIS = new Set([
  'computed',
  'customRef',
  'effectScope',
  'getCurrentInstance',
  'inject',
  'onActivated',
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onDeactivated',
  'onErrorCaptured',
  'onMounted',
  'onRenderTracked',
  'onRenderTriggered',
  'onScopeDispose',
  'onServerPrefetch',
  'onUnmounted',
  'onUpdated',
  'onWatcherCleanup',
  'provide',
  'reactive',
  'readonly',
  'ref',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'toRef',
  'toRefs',
  'triggerRef',
  'useAttrs',
  'useCssModule',
  'useId',
  'useModel',
  'useSlots',
  'useSSRContext',
  'useTemplateRef',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
])

function hasExportModifier(node) {
  return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function collectCallableDeclarations(sourceFile) {
  const callables = new Map()
  const exported = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      callables.set(statement.name.text, statement)
      if (hasExportModifier(statement))
        exported.set(statement.name.text, statement)
      continue
    }
    if (!ts.isVariableStatement(statement))
      continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)
        || (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer))) {
        continue
      }
      callables.set(declaration.name.text, declaration.initializer)
      if (hasExportModifier(statement))
        exported.set(declaration.name.text, declaration.initializer)
    }
  }
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)
      || statement.moduleSpecifier
      || statement.isTypeOnly
      || !statement.exportClause
      || !ts.isNamedExports(statement.exportClause)) {
      continue
    }
    for (const element of statement.exportClause.elements) {
      const localName = element.propertyName?.text ?? element.name.text
      const callable = callables.get(localName)
      if (!element.isTypeOnly && callable)
        exported.set(element.name.text, callable)
    }
  }
  return { callables, exported }
}

function collectRuntimeImportBindings(sourceFile) {
  const bindings = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)
      || !ts.isStringLiteralLike(statement.moduleSpecifier)
      || !statement.importClause
      || statement.importClause.isTypeOnly) {
      continue
    }
    const source = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (clause.name)
      bindings.set(clause.name.text, { imported: 'default', source })
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.set(clause.namedBindings.name.text, { imported: '*', source })
      continue
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly) {
          bindings.set(element.name.text, {
            imported: element.propertyName?.text ?? element.name.text,
            source,
          })
        }
      }
    }
  }
  return bindings
}

function collectForwardedCallables(file, callableName, sourceFile) {
  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)
      || !statement.moduleSpecifier
      || !ts.isStringLiteralLike(statement.moduleSpecifier)
      || statement.isTypeOnly) {
      return []
    }
    const target = resolveRelativeModule(file, statement.moduleSpecifier.text)
    if (!target)
      return []
    if (!statement.exportClause)
      return [{ file: target, name: callableName }]
    if (!ts.isNamedExports(statement.exportClause))
      return []
    return statement.exportClause.elements.flatMap((element) => {
      if (element.isTypeOnly || element.name.text !== callableName)
        return []
      return [{ file: target, name: element.propertyName?.text ?? element.name.text }]
    })
  })
}

function callableHasVueOwnership(file, callableName, cache, visiting = new Set()) {
  const key = `${file}:${callableName}`
  if (cache.has(key))
    return cache.get(key)
  if (visiting.has(key))
    return false
  visiting.add(key)

  const sourceFile = parseModule(file).sourceFile
  const { callables, exported } = collectCallableDeclarations(sourceFile)
  const callable = callables.get(callableName) ?? exported.get(callableName)
  if (!callable) {
    const forwarded = collectForwardedCallables(file, callableName, sourceFile)
      .some(target => callableHasVueOwnership(target.file, target.name, cache, visiting))
    visiting.delete(key)
    cache.set(key, forwarded)
    return forwarded
  }
  const imports = collectRuntimeImportBindings(sourceFile)
  let ownsVueState = false
  const visit = (node) => {
    if (ownsVueState)
      return
    if (node !== callable && (ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node)
      || ts.isClassDeclaration(node)
      || ts.isClassExpression(node))) {
      return
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const localName = node.expression.text
        const binding = imports.get(localName)
        if (binding?.source === 'vue' && VUE_OWNERSHIP_APIS.has(binding.imported)) {
          ownsVueState = true
          return
        }
        if (binding && (/^use[A-Z]/u.test(localName) || /^use[A-Z]/u.test(binding.imported))) {
          if (!binding.source.startsWith('.')) {
            ownsVueState = true
            return
          }
          const dependency = resolveRelativeModule(file, binding.source)
          const importedName = binding.imported === 'default' ? localName : binding.imported
          if (dependency && callableHasVueOwnership(dependency, importedName, cache, visiting)) {
            ownsVueState = true
            return
          }
        }
        if (!binding && callables.has(localName)
          && callableHasVueOwnership(file, localName, cache, visiting)) {
          ownsVueState = true
          return
        }
      }
      else if (ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)) {
        const namespace = imports.get(node.expression.expression.text)
        if (namespace?.source === 'vue'
          && namespace.imported === '*'
          && VUE_OWNERSHIP_APIS.has(node.expression.name.text)) {
          ownsVueState = true
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(callable)
  visiting.delete(key)
  cache.set(key, ownsVueState)
  return ownsVueState
}

export function collectComposableOwnershipDiagnostics(repositoryRoot, packages) {
  const cache = new Map()
  return packages.flatMap((pkg) => {
    if (!existsSync(pkg.sourceRoot))
      return []
    return walkFiles(pkg.sourceRoot, isProductionModule).flatMap((file) => {
      if (basename(nearestResponsibilityDirectory(file, pkg.sourceRoot) ?? '') !== 'composables')
        return []
      const { exported } = collectCallableDeclarations(parseModule(file).sourceFile)
      const offenders = [...exported.keys()]
        .filter(name => /^use[A-Z]/u.test(name))
        .filter(name => !callableHasVueOwnership(file, name, cache))
        .sort()
      if (offenders.length === 0)
        return []
      return [diagnostic(
        'composable.vue-ownership-required',
        normalizeRepositoryPath(repositoryRoot, file),
        pkg.relativeRoot,
        `Composable exports must own Vue reactive state, injection, watchers, or lifecycle; move pure functions to services or utils: ${offenders.join(', ')}.`,
      )]
    })
  })
}
