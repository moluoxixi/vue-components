import type { CanonicalPageIR, ProjectCompilation, SemanticCompilerEnvironment } from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type { CanonicalConfigExport, CanonicalSourceBindingResolver } from '../types'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import { normalizeProjectPath, safeProjectSlug } from '../../utils'
import { formatStaticValue, quoteKey } from '../utils'
import { configPageSource } from './config-page'

function textFile(content: string): WorkspaceFile {
  return { content, kind: 'text', language: 'typescript' }
}

function uniquePageDirectories(pages: readonly Pick<CanonicalPageIR, 'id'>[]): ReadonlyMap<string, string> {
  const used = new Set<string>()
  return new Map(pages.map((page) => {
    const base = safeProjectSlug(page.id)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    return [page.id, directory]
  }))
}

export function createCanonicalProjectConfigExport(
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): CanonicalConfigExport {
  if (
    resolver.adapter !== compilation.key.registryAdapter
    || resolver.adapterVersion !== compilation.key.registryAdapterVersion
    || resolver.registryFingerprint !== compilation.key.registryFingerprint
  ) {
    throw new Error('Config source resolver does not match the ProjectCompilation Registry identity.')
  }

  const { ir } = compilation
  const pages = ir.pageOrder.map((pageId) => {
    if (!ir.pagesById[pageId])
      throw new Error(`Canonical project references unknown page "${pageId}".`)
    // The public compiler owns page identity; never reconstruct its hashes locally.
    const result = compileCanonicalPage({
      snapshot: compilation.snapshot,
      registry: compilation.registry,
      environment: structuredClone(ir.environment) as SemanticCompilerEnvironment,
      pageId,
    })
    if (!result.success)
      throw new Error(`Config page compilation failed: ${JSON.stringify(result.diagnostics)}`)
    return result.compilation
  })
  const directories = uniquePageDirectories(pages.map(item => item.page))
  const files: Record<ProjectPath, WorkspaceFile> = {}

  pages.forEach((pageCompilation) => {
    const path = normalizeProjectPath(`pages/${directories.get(pageCompilation.key.pageId)}/form.config.ts`)
    files[path] = textFile(configPageSource(pageCompilation, compilation, resolver))
  })

  const entry = normalizeProjectPath('project.config.ts')
  const projectPages = pages.map(({ page }) => ({
    id: page.id,
    name: page.name,
    route: page.route,
    config: `./pages/${directories.get(page.id)}/form.config`,
  }))
  const imports = projectPages.map((page, index) =>
    `import * as page${index} from ${JSON.stringify(page.config)}`).join('\n')
  const mappings = projectPages.map((page, index) =>
    `  ${quoteKey(page.id, 'pageConfigs')}: page${index}`).join(',\n')
  files[entry] = textFile(`${imports}

export const project = ${formatStaticValue({
  version: compilation.snapshot.document.version,
  irVersion: ir.version,
  identity: compilation.key,
  origin: compilation.origin,
  id: ir.identity.projectId,
  name: ir.name,
  homePageId: ir.homePageId,
  pageOrder: ir.pageOrder,
  pages: projectPages,
  settings: ir.settings,
  resources: ir.resources,
  environment: ir.environment,
  registry: compilation.registry,
  registryLock: compilation.snapshot.document.registryLock,
}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}

export const pageConfigs = {
${mappings}
}
`)

  return { entry, files }
}
