import type { CanonicalPageIR, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type {
  CanonicalProjectSourceExport,
  CanonicalSourceBindingResolver,
  CanonicalSourceLibraryBinding,
} from '../types'
import type { StandaloneSourceProject } from '../types/source'
import { normalizeProjectPath } from '../../utils'
import { canonicalSourcePage, createCanonicalSourceRegistry, textFile } from './source-canonical'
import { createStandaloneFlowRuntimeSource } from './source-flow'
import { collectSourceLibraries } from './source-libraries'
import { appSource } from './source-page'
import { assertPortableNode } from './source-portability'
import {
  canonicalProjectPackage,
  mainSource,
  projectAppSource,
  projectRouterSource,
  sourceStyles,
  standaloneHtml,
  standaloneTsconfig,
  standaloneViteConfig,
  uniquePageDirectories,
} from './source-project-files'
import { createStandaloneValidationRuntimeSource } from './source-validation'

export { createStandaloneFlowRuntimeSource, createStandaloneValidationRuntimeSource }

/** Generate a complete standalone Vue project from one indivisible compilation. */
export function createCanonicalProjectSourceExport(
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): CanonicalProjectSourceExport {
  if (
    resolver.adapter !== compilation.key.registryAdapter
    || resolver.adapterVersion !== compilation.key.registryAdapterVersion
    || resolver.registryFingerprint !== compilation.key.registryFingerprint
  ) {
    throw new Error('Standalone Source resolver does not match the ProjectCompilation Registry identity.')
  }

  const pages = compilation.ir.pageOrder.map((pageId) => {
    const page = compilation.ir.pagesById[pageId]
    if (!page)
      throw new Error(`Canonical project references unknown page "${pageId}".`)
    return canonicalSourcePage(page as CanonicalPageIR)
  })
  const project: StandaloneSourceProject = {
    id: compilation.ir.identity.projectId,
    name: compilation.ir.name,
    homePageId: compilation.ir.homePageId,
    pages,
  }
  const registry = createCanonicalSourceRegistry(compilation, resolver)
  const pageDirectories = uniquePageDirectories(project)
  const libraries = new Map<string, CanonicalSourceLibraryBinding>()
  const files: Record<ProjectPath, WorkspaceFile> = {}

  pages.forEach((page) => {
    page.root.forEach(node => assertPortableNode(node, registry))
    collectSourceLibraries(page.root, registry, libraries)
    const directory = pageDirectories.get(page.id)!
    files[normalizeProjectPath(`src/pages/${directory}/Page.vue`)] = textFile(
      appSource(page, registry),
      'vue',
    )
    files[normalizeProjectPath(`src/pages/${directory}/flows.ts`)] = textFile(
      createStandaloneFlowRuntimeSource(page.flowPlans),
      'typescript',
    )
    files[normalizeProjectPath(`src/pages/${directory}/validation.ts`)] = textFile(
      createStandaloneValidationRuntimeSource(page.root),
      'typescript',
    )
  })

  const entry = normalizeProjectPath('src/main.ts')
  files[normalizeProjectPath('index.html')] = textFile(standaloneHtml(project.name), 'html')
  files[normalizeProjectPath('package.json')] = textFile(canonicalProjectPackage(project.name, libraries), 'json')
  files[normalizeProjectPath('src/App.vue')] = textFile(projectAppSource(), 'vue')
  files[normalizeProjectPath('src/router.ts')] = textFile(projectRouterSource(project, pageDirectories), 'typescript')
  files[entry] = textFile(mainSource(libraries, true), 'typescript')
  files[normalizeProjectPath('src/styles.css')] = textFile(sourceStyles(), 'css')
  files[normalizeProjectPath('src/vite-env.d.ts')] = textFile('/// <reference types="vite/client" />\n', 'typescript')
  files[normalizeProjectPath('tsconfig.json')] = textFile(standaloneTsconfig, 'json')
  files[normalizeProjectPath('vite.config.ts')] = textFile(standaloneViteConfig, 'typescript')

  return { entry, files }
}
