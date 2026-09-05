import { existsSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import ts from 'typescript'
import {
  isWithinDirectory,
  normalizeRepositoryPath,
  walkDirectories,
  walkFiles,
} from '../utils/index.mjs'
import { collectComposableOwnershipDiagnostics } from './composable-ownership.mjs'
import { collectFeatureImportDiagnostics } from './feature-imports.mjs'
import { collectModuleCycleDiagnostics } from './module-cycles.mjs'
import {
  collectConcreteConsumers,
  createModuleGraph,
  isTypeOnlyExport,
  moduleReaches,
  parseModule,
} from './module-graph.mjs'
import {
  diagnostic,
  isExplicitFeatureDirectory,
  isProductionModule,
  nearestArchitecturalFeatureRoot,
  RESPONSIBILITY_DIRECTORIES,
} from './rule-utils.mjs'

function packageSourceEntry(manifest) {
  const rootExport = manifest.exports?.['.']
  return rootExport && typeof rootExport === 'object' ? rootExport.source : undefined
}

function normalizedPublishedFiles(manifest) {
  return new Set((Array.isArray(manifest.files) ? manifest.files : [])
    .filter(file => typeof file === 'string')
    .map(file => file.trim().replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '')))
}

function publishesRootSourceFiles(manifest) {
  const files = normalizedPublishedFiles(manifest)
  return files.has('index.ts') && files.has('src')
}

function hasExplicitSideEffects(manifest) {
  if (!Object.hasOwn(manifest, 'sideEffects'))
    return false
  return typeof manifest.sideEffects === 'boolean'
    || (Array.isArray(manifest.sideEffects)
      && manifest.sideEffects.every(pattern => typeof pattern === 'string' && pattern.trim().length > 0))
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
    return node.text
  return undefined
}

function referencesSourceRootEntry(node) {
  let found = false
  const visit = (child) => {
    if (ts.isStringLiteralLike(child)) {
      const value = child.text.replaceAll('\\', '/').replace(/^\.\//u, '')
      if (/^src\/index(?:\.[cm]?[jt]sx?)?$/u.test(value))
        found = true
    }
    if (!found)
      ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function buildConfigUsesSourceRootEntry(pkg) {
  return [
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'tsup.config.ts',
    'tsup.config.mts',
  ].map(fileName => resolve(pkg.root, fileName)).find((file) => {
    if (!existsSync(file))
      return false
    return parseModule(file).sourceFile.statements.some((statement) => {
      let invalidEntry = false
      const visit = (node) => {
        if (ts.isPropertyAssignment(node)
          && ['entry', 'input'].includes(propertyName(node.name))
          && referencesSourceRootEntry(node.initializer)) {
          invalidEntry = true
        }
        if (!invalidEntry)
          ts.forEachChild(node, visit)
      }
      visit(statement)
      return invalidEntry
    })
  })
}

function hasConsistentOutputEntries(manifest) {
  const rootExport = manifest.exports?.['.']
  if (!rootExport || typeof rootExport !== 'object')
    return false
  const runtimeOutput = manifest.module ?? manifest.main
  return (!manifest.main || !manifest.module || manifest.main === manifest.module)
    && (!runtimeOutput || rootExport.import === runtimeOutput)
    && (!manifest.types || rootExport.types === manifest.types)
}

export function collectPackageEntryDiagnostics(repositoryRoot, packages) {
  return packages.flatMap((pkg) => {
    const diagnostics = []
    const published = pkg.manifest.private !== true
    if (!existsSync(pkg.sourceRoot)) {
      diagnostics.push(diagnostic(
        'package.src-required',
        `${pkg.relativeRoot}/src`,
        pkg.relativeRoot,
        'Package must keep production implementation under src/.',
      ))
      return diagnostics
    }
    if (!existsSync(pkg.rootEntry)) {
      diagnostics.push(diagnostic(
        'package.root-index-required',
        `${pkg.relativeRoot}/index.ts`,
        pkg.relativeRoot,
        'Package must expose its source entry from root index.ts.',
      ))
    }
    else {
      const specifiers = parseModule(pkg.rootEntry).allSpecifiers
      if (specifiers.some(specifier => /^\.\/src(?:\/index(?:\.[cm]?[jt]s)?)?$/u.test(specifier))) {
        diagnostics.push(diagnostic(
          'package.root-index-explicit-exports',
          normalizeRepositoryPath(repositoryRoot, pkg.rootEntry),
          pkg.relativeRoot,
          'Root index.ts must export named src features instead of forwarding the src root.',
        ))
      }
    }
    if (existsSync(pkg.sourceRootEntry)) {
      diagnostics.push(diagnostic(
        'package.src-index-forbidden',
        normalizeRepositoryPath(repositoryRoot, pkg.sourceRootEntry),
        pkg.relativeRoot,
        'src/index.ts duplicates the package root entry and must be removed.',
      ))
    }
    if (published && packageSourceEntry(pkg.manifest) !== './index.ts') {
      diagnostics.push(diagnostic(
        'package.source-entry',
        `${pkg.relativeRoot}/package.json`,
        pkg.relativeRoot,
        'Published package exports["."].source must point to ./index.ts.',
      ))
    }
    if (published
      && packageSourceEntry(pkg.manifest) === './index.ts'
      && !publishesRootSourceFiles(pkg.manifest)) {
      diagnostics.push(diagnostic(
        'package.source-files',
        `${pkg.relativeRoot}/package.json`,
        pkg.relativeRoot,
        'Published package files must include index.ts and src when exports["."].source points to ./index.ts.',
      ))
    }
    if (published && !existsSync(resolve(pkg.root, 'README.md'))) {
      diagnostics.push(diagnostic(
        'package.readme-required',
        `${pkg.relativeRoot}/README.md`,
        pkg.relativeRoot,
        'Published package must include a package-root README.md.',
      ))
    }
    if (published && !hasExplicitSideEffects(pkg.manifest)) {
      diagnostics.push(diagnostic(
        'package.side-effects-explicit',
        `${pkg.relativeRoot}/package.json`,
        pkg.relativeRoot,
        'Published package must declare sideEffects as a boolean or an array of non-empty file patterns.',
      ))
    }
    const invalidBuildConfig = buildConfigUsesSourceRootEntry(pkg)
    const buildScript = pkg.manifest.scripts?.build ?? ''
    const buildScriptUsesSourceRootEntry = /(?:^|[\s"'=])\.?\/?src[\\/]index(?:\.[cm]?[jt]sx?)?(?=$|[\s"',])/u.test(buildScript)
    if (buildScriptUsesSourceRootEntry || invalidBuildConfig) {
      diagnostics.push(diagnostic(
        'package.build-entry',
        invalidBuildConfig
          ? normalizeRepositoryPath(repositoryRoot, invalidBuildConfig)
          : `${pkg.relativeRoot}/package.json`,
        pkg.relativeRoot,
        'Build configuration must use the package root index.ts as the primary entry.',
      ))
    }
    if (published && !hasConsistentOutputEntries(pkg.manifest)) {
      diagnostics.push(diagnostic(
        'package.output-entry',
        `${pkg.relativeRoot}/package.json`,
        pkg.relativeRoot,
        'Published package main/module/types fields must match exports["."].import and exports["."].types.',
      ))
    }
    return diagnostics
  })
}

function hasRuntimeExport(sourceFile) {
  return sourceFile.statements.some((statement) => {
    if (ts.isExportDeclaration(statement))
      return !isTypeOnlyExport(statement)
    if (ts.isExportAssignment(statement))
      return true
    const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    return exported && (
      ts.isClassDeclaration(statement)
      || ts.isEnumDeclaration(statement)
      || ts.isFunctionDeclaration(statement)
      || ts.isVariableStatement(statement)
    )
  })
}

export function collectFeatureStructureDiagnostics(repositoryRoot, packages) {
  return packages.flatMap((pkg) => {
    if (!existsSync(pkg.sourceRoot))
      return []
    const diagnostics = []
    const directories = walkDirectories(pkg.sourceRoot)
    for (const directory of directories) {
      const entry = resolve(directory, 'index.ts')
      if (isExplicitFeatureDirectory(directory) && !existsSync(entry)) {
        diagnostics.push(diagnostic(
          'feature.index-required',
          normalizeRepositoryPath(repositoryRoot, entry),
          pkg.relativeRoot,
          'Directories directly below features/ must expose an index.ts feature entry.',
        ))
      }
      if (basename(directory) !== 'style'
        && existsSync(entry)
        && parseModule(entry).barrel === false) {
        diagnostics.push(diagnostic(
          'feature.index-barrel-only',
          normalizeRepositoryPath(repositoryRoot, entry),
          pkg.relativeRoot,
          'Feature and responsibility index.ts files must contain exports only.',
        ))
      }
      if (!existsSync(entry) || RESPONSIBILITY_DIRECTORIES.has(basename(directory)))
        continue
      for (const file of walkFiles(directory, candidate => dirname(candidate) === directory && isProductionModule(candidate))) {
        if (!['index.ts', 'index.vue'].includes(basename(file))) {
          diagnostics.push(diagnostic(
            'feature.root-file',
            normalizeRepositoryPath(repositoryRoot, file),
            pkg.relativeRoot,
            'Feature root files must move into a responsibility directory.',
          ))
        }
      }
    }

    for (const file of walkFiles(pkg.sourceRoot, isProductionModule)) {
      const normalized = normalizeRepositoryPath(repositoryRoot, file)
      if (!normalized.includes('/types/') || extname(file) !== '.ts')
        continue
      if (hasRuntimeExport(parseModule(file).sourceFile)) {
        diagnostics.push(diagnostic(
          'types.runtime-export',
          normalized,
          pkg.relativeRoot,
          'types/ may export types only.',
        ))
      }
    }
    return diagnostics
  })
}

function nearestFeatureRoot(file, sourceRoot) {
  let directory = dirname(file)
  while (directory !== sourceRoot && isWithinDirectory(directory, sourceRoot)) {
    if (existsSync(resolve(directory, 'index.ts')) && !RESPONSIBILITY_DIRECTORIES.has(basename(directory)))
      return directory
    directory = dirname(directory)
  }
  return undefined
}

function ownershipRoot(file, sourceRoot) {
  const featureRoot = nearestFeatureRoot(file, sourceRoot)
  if (featureRoot)
    return featureRoot
  const relativePath = file.slice(sourceRoot.length + 1).replaceAll('\\', '/')
  const topLevelDirectory = relativePath.split('/')[0]
  return topLevelDirectory && relativePath.includes('/')
    ? resolve(sourceRoot, topLevelDirectory)
    : sourceRoot
}

function expectedChildDirectory(parent) {
  return basename(parent) === 'index.vue'
    ? resolve(dirname(parent), 'components')
    : resolve(dirname(parent), basename(parent, '.vue'), 'components')
}

export function collectComponentOwnershipDiagnostics(repositoryRoot, packages) {
  return packages.flatMap((pkg) => {
    if (!existsSync(pkg.sourceRoot))
      return []
    const graph = createModuleGraph(pkg.sourceRoot, existsSync(pkg.rootEntry) ? [pkg.rootEntry] : [])
    const components = graph.files.filter(file => extname(file) === '.vue' && isProductionModule(file))
    return components.flatMap((component) => {
      const path = normalizeRepositoryPath(repositoryRoot, component)
      const publicComponent = existsSync(pkg.rootEntry) && moduleReaches(graph, pkg.rootEntry, component)
      const componentFeatureRoot = nearestFeatureRoot(component, pkg.sourceRoot)
      const featureShell = basename(component) === 'index.vue' && componentFeatureRoot === dirname(component)
      if (publicComponent || featureShell)
        return []

      const consumers = collectConcreteConsumers(graph, component)
        .filter(isProductionModule)
      const owners = consumers.map(consumer => normalizeRepositoryPath(repositoryRoot, consumer))
      if (consumers.length === 0) {
        return [diagnostic(
          'component.owner-required',
          path,
          pkg.relativeRoot,
          'Non-public Vue component has no statically resolved owner.',
        )]
      }
      if (consumers.length === 1 && extname(consumers[0]) === '.vue') {
        const childDirectory = expectedChildDirectory(consumers[0])
        if (!isWithinDirectory(component, childDirectory)) {
          return [diagnostic(
            'component.single-parent-location',
            path,
            pkg.relativeRoot,
            `Single-parent component must live under ${normalizeRepositoryPath(repositoryRoot, childDirectory)}.`,
            owners,
          )]
        }
        return []
      }

      const featureRoots = [...new Set(consumers.map(consumer => ownershipRoot(consumer, pkg.sourceRoot)))]
      const packageComponents = resolve(pkg.sourceRoot, 'components')
      if (dirname(component) === packageComponents) {
        const sharedFeatureRoots = [...new Set(consumers
          .map(consumer => nearestArchitecturalFeatureRoot(consumer, pkg.sourceRoot))
          .filter(Boolean))]
        if (sharedFeatureRoots.length < 2) {
          return [diagnostic(
            'component.shared-feature-owners',
            path,
            pkg.relativeRoot,
            'Package-level shared components require at least two independent feature owners.',
            owners,
          )]
        }
      }
      if (featureRoots.length === 1) {
        const featureComponents = resolve(featureRoots[0], 'components')
        if (!isWithinDirectory(component, featureComponents)) {
          return [diagnostic(
            'component.single-feature-location',
            path,
            pkg.relativeRoot,
            `Single-feature component must live under ${normalizeRepositoryPath(repositoryRoot, featureComponents)}.`,
            owners,
          )]
        }
      }
      return []
    })
  })
}

export function collectPackageArchitectureDiagnostics(repositoryRoot, packages) {
  return [
    ...collectPackageEntryDiagnostics(repositoryRoot, packages),
    ...collectFeatureStructureDiagnostics(repositoryRoot, packages),
    ...collectFeatureImportDiagnostics(repositoryRoot, packages),
    ...collectComposableOwnershipDiagnostics(repositoryRoot, packages),
    ...collectComponentOwnershipDiagnostics(repositoryRoot, packages),
    ...collectModuleCycleDiagnostics(repositoryRoot, packages),
  ].sort((left, right) => (
    left.rule.localeCompare(right.rule)
    || left.path.localeCompare(right.path)
    || JSON.stringify(left.owners ?? []).localeCompare(JSON.stringify(right.owners ?? []))
  ))
}
