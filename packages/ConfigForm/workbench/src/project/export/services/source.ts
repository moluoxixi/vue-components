import type { CanonicalSurfaceIR, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type {
  CanonicalProjectSourceExport,
  CanonicalSourceBindingResolver,
  CanonicalSourceLibraryBinding,
} from '../types'
import type { StandaloneSourceProject } from '../types/source'
import { getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import { createPrototypeProjectContext } from '@moluoxixi/config-form-prototype-runtime/session'
import { normalizeProjectPath } from '../../utils'
import { canonicalSourceSurface, createCanonicalSourceRegistry, textFile } from './source-canonical'
import { collectSourceLibraries } from './source-libraries'
import { appSource, standaloneSurfaceRuntimeSource } from './source-page'
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
  uniqueSurfaceDirectories,
} from './source-project-files'
import { scriptJson } from './source-serialization'
import { createStandaloneValidationRuntimeSource } from './source-validation'

export { createStandaloneValidationRuntimeSource }

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
  const surfaces = compilation.ir.surfaceOrder.map((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      throw new Error(`Canonical project references unknown Surface "${surfaceId}".`)
    return canonicalSourceSurface(surface as CanonicalSurfaceIR)
  })
  const project: StandaloneSourceProject = {
    id: compilation.ir.identity.projectId,
    name: compilation.ir.name,
    homeSurfaceId: compilation.ir.homeSurfaceId,
    surfaces,
  }
  const context = createPrototypeProjectContext(compilation)
  if (!context.success) {
    throw new Error(`ProjectCompilation cannot be exported as a Prototype project: ${context.diagnostics
      .map(diagnostic => diagnostic.message)
      .join('; ')}`)
  }
  const registry = createCanonicalSourceRegistry(compilation, resolver)
  const surfaceDirectories = uniqueSurfaceDirectories(project)
  const libraries = new Map<string, CanonicalSourceLibraryBinding>()
  const files: Record<ProjectPath, WorkspaceFile> = {}
  for (const [path, content] of Object.entries(getConfigFormRuntimeSources())) {
    const language = path.endsWith('.vue')
      ? 'vue'
      : path.endsWith('.scss') ? 'scss' : 'typescript'
    files[normalizeProjectPath(`src/runtime/${path}`)] = textFile(content, language)
  }
  files[normalizeProjectPath('src/runtime/source-page.ts')] = textFile(standaloneSurfaceRuntimeSource(), 'typescript')

  surfaces.forEach((surface) => {
    surface.root.forEach(node => assertPortableNode(node, registry))
    collectSourceLibraries(surface.root, registry, libraries)
    const directory = surfaceDirectories.get(surface.id)!
    files[normalizeProjectPath(`src/surfaces/${directory}/Surface.vue`)] = textFile(
      appSource(surface, registry),
      'vue',
    )
    files[normalizeProjectPath(`src/surfaces/${directory}/validation.ts`)] = textFile(
      createStandaloneValidationRuntimeSource(surface.root),
      'typescript',
    )
  })

  const entry = normalizeProjectPath('src/main.ts')
  files[normalizeProjectPath('index.html')] = textFile(standaloneHtml(project.name), 'html')
  files[normalizeProjectPath('package.json')] = textFile(canonicalProjectPackage(project.name, libraries), 'json')
  files[normalizeProjectPath('src/App.vue')] = textFile(projectAppSource(project, surfaceDirectories), 'vue')
  files[normalizeProjectPath('src/prototype-context.ts')] = textFile(
    `import type { PrototypeProjectContextV1 } from '@moluoxixi/config-form-prototype-runtime/session'\n\nexport const prototypeContext = ${scriptJson(context.data, 2)} as const satisfies PrototypeProjectContextV1\n`,
    'typescript',
  )
  files[normalizeProjectPath('src/router.ts')] = textFile(projectRouterSource(project), 'typescript')
  files[entry] = textFile(mainSource(libraries, true), 'typescript')
  files[normalizeProjectPath('src/styles.css')] = textFile(sourceStyles(), 'css')
  files[normalizeProjectPath('src/vite-env.d.ts')] = textFile('/// <reference types="vite/client" />\n', 'typescript')
  files[normalizeProjectPath('tsconfig.json')] = textFile(standaloneTsconfig, 'json')
  files[normalizeProjectPath('vite.config.ts')] = textFile(standaloneViteConfig, 'typescript')

  return { entry, files }
}
