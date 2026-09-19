import type { CanonicalSurfaceIR, ProjectCompilation, SemanticCompilerEnvironment } from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type { CanonicalConfigExport, CanonicalSourceBindingResolver } from '../types'
import { compileCanonicalSurface } from '@moluoxixi/config-form-compiler'
import { normalizeProjectPath, safeProjectSlug } from '../../utils'
import { formatStaticValue, quoteKey } from '../utils'
import { configSurfaceSource } from './config-page'

function textFile(content: string): WorkspaceFile {
  return { content, kind: 'text', language: 'typescript' }
}

function uniqueSurfaceDirectories(surfaces: readonly Pick<CanonicalSurfaceIR, 'id'>[]): ReadonlyMap<string, string> {
  const used = new Set<string>()
  return new Map(surfaces.map((surface) => {
    const base = safeProjectSlug(surface.id)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    return [surface.id, directory]
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
  const surfaceCompilations = ir.surfaceOrder.map((surfaceId) => {
    if (!ir.surfacesById[surfaceId])
      throw new Error(`Canonical project references unknown Surface "${surfaceId}".`)
    // The public compiler owns Surface identity; never reconstruct its hashes locally.
    const result = compileCanonicalSurface({
      snapshot: compilation.snapshot,
      registry: compilation.registry,
      environment: structuredClone(ir.environment) as SemanticCompilerEnvironment,
      surfaceId,
    })
    if (!result.success)
      throw new Error(`Config Surface compilation failed: ${JSON.stringify(result.diagnostics)}`)
    return result.compilation
  })
  const directories = uniqueSurfaceDirectories(surfaceCompilations.map(item => item.surface))
  const files: Record<ProjectPath, WorkspaceFile> = {}

  surfaceCompilations.forEach((surfaceCompilation) => {
    const path = normalizeProjectPath(`surfaces/${directories.get(surfaceCompilation.key.surfaceId)}/form.config.ts`)
    files[path] = textFile(configSurfaceSource(surfaceCompilation, compilation, resolver))
  })

  const entry = normalizeProjectPath('project.config.ts')
  const projectSurfaces = surfaceCompilations.map(({ surface }) => ({
    id: surface.id,
    name: surface.name,
    kind: surface.kind,
    ...(surface.kind === 'page' ? { route: surface.route } : { presentation: surface.presentation }),
    config: `./surfaces/${directories.get(surface.id)}/form.config`,
  }))
  const imports = projectSurfaces.map((surface, index) =>
    `import * as surface${index} from ${JSON.stringify(surface.config)}`).join('\n')
  const mappings = projectSurfaces.map((surface, index) =>
    `  ${quoteKey(surface.id, 'surfaceConfigs')}: surface${index}`).join(',\n')
  files[entry] = textFile(`${imports}

export const project = ${formatStaticValue({
  version: compilation.snapshot.document.version,
  irVersion: ir.version,
  identity: compilation.key,
  origin: compilation.origin,
  id: ir.identity.projectId,
  name: ir.name,
  homeSurfaceId: ir.homeSurfaceId,
  surfaceOrder: ir.surfaceOrder,
  surfaces: projectSurfaces,
  settings: ir.settings,
  resources: ir.resources,
  environment: ir.environment,
  registry: compilation.registry,
  registryLock: compilation.snapshot.document.registryLock,
}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}

export const surfaceConfigs = {
${mappings}
}
`)

  return { entry, files }
}
