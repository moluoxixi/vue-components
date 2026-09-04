import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import {
  isWithinDirectory,
  normalizeRepositoryPath,
} from '../utils/index.mjs'
import { createModuleGraph } from './module-graph.mjs'
import {
  diagnostic,
  isProductionModule,
  nearestArchitecturalFeatureRoot,
  RESPONSIBILITY_DIRECTORIES,
} from './rule-utils.mjs'

function isAncestorResponsibilityEntry(graph, importerFeature, targetFeature, target) {
  if (!isWithinDirectory(importerFeature, targetFeature))
    return false
  const targetDirectory = dirname(target)
  return target === resolve(targetDirectory, 'index.ts')
    && RESPONSIBILITY_DIRECTORIES.has(basename(targetDirectory))
    && graph.modules.get(target)?.barrel === true
}

export function collectFeatureImportDiagnostics(repositoryRoot, packages) {
  return packages.flatMap((pkg) => {
    if (!existsSync(pkg.sourceRoot))
      return []
    const graph = createModuleGraph(pkg.sourceRoot)
    return graph.files.filter(isProductionModule).flatMap((importer) => {
      const importerFeature = nearestArchitecturalFeatureRoot(importer, pkg.sourceRoot)
      if (!importerFeature)
        return []
      return [...(graph.modules.get(importer)?.dependencies ?? [])].flatMap((target) => {
        if (!isProductionModule(target))
          return []
        const targetFeature = nearestArchitecturalFeatureRoot(target, pkg.sourceRoot)
        if (!targetFeature
          || targetFeature === importerFeature
          || isAncestorResponsibilityEntry(graph, importerFeature, targetFeature, target)
          || target === resolve(targetFeature, 'index.ts')) {
          return []
        }
        const targetPath = normalizeRepositoryPath(repositoryRoot, target)
        return [diagnostic(
          'feature.cross-feature-deep-import',
          normalizeRepositoryPath(repositoryRoot, importer),
          pkg.relativeRoot,
          `Cross-feature imports must use the target feature entry ${normalizeRepositoryPath(repositoryRoot, resolve(targetFeature, 'index.ts'))}.`,
          [targetPath],
        )]
      })
    })
  })
}
