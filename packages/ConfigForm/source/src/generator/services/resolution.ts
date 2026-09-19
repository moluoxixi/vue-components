import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  SourceComponentResolution,
  SourceConfigFormBindingResolution,
  SourceProviderResolver,
} from '../types'
import { isPortableVersion, packageNameFromSpecifier } from './serialization'

export interface ResolvedSourceComponents {
  byKey: ReadonlyMap<string, SourceComponentResolution>
  dependencies: Readonly<Record<string, string>>
}

type ResolutionResult<T>
  = | { success: true, data: T }
    | { success: false, diagnostics: ModelDiagnostic[] }

function failure(message: string, context?: Record<string, unknown>): ResolutionResult<never> {
  return {
    success: false,
    diagnostics: [{ code: 'source_resolution_failed', message, ...(context ? { context } : {}) }],
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

function dependencyError(
  dependencies: Readonly<Record<string, string>>,
): string | undefined {
  for (const [name, version] of Object.entries(dependencies)) {
    if (!name.trim() || !isPortableVersion(version))
      return `Dependency "${name}" requires a portable non-empty version.`
  }
  return undefined
}

function validateComponentResolution(
  componentKey: string,
  resolution: SourceComponentResolution,
): string | undefined {
  if (
    !isRecord(resolution)
    || typeof resolution.moduleSpecifier !== 'string'
    || typeof resolution.importName !== 'string'
    || typeof resolution.tag !== 'string'
    || !/^[A-Za-z][A-Za-z0-9._:-]*$/.test(resolution.tag)
    || typeof resolution.configComponent !== 'string'
    || !resolution.configComponent.trim()
    || !['component', 'layout-flex', 'layout-grid', 'section'].includes(resolution.render)
    || !Array.isArray(resolution.styleImports)
    || resolution.styleImports.some(item => typeof item !== 'string' || !item.trim())
    || !isRecord(resolution.dependencies)
  ) {
    return `Component "${componentKey}" returned an invalid source resolution.`
  }
  if ((resolution.moduleSpecifier === '') !== (resolution.importName === ''))
    return `Component "${componentKey}" must provide both moduleSpecifier and importName, or neither for native HTML.`
  if (resolution.importName && !isIdentifier(resolution.importName))
    return `Component "${componentKey}" returned an invalid import name.`
  const dependenciesMessage = dependencyError(resolution.dependencies)
  if (dependenciesMessage)
    return dependenciesMessage
  if (resolution.moduleSpecifier) {
    const packageName = packageNameFromSpecifier(resolution.moduleSpecifier)
    if (packageName && !resolution.dependencies[packageName])
      return `Component "${componentKey}" does not declare a version for "${packageName}".`
  }
  if (resolution.library) {
    const library = resolution.library
    if (
      !library.packageName
      || !isIdentifier(library.plugin)
      || !isPortableVersion(library.version)
      || resolution.moduleSpecifier !== library.packageName
      || resolution.importName !== library.plugin
      || resolution.dependencies[library.packageName] !== library.version
      || (library.stylesheet !== undefined && !library.stylesheet.trim())
    ) {
      return `Component "${componentKey}" returned inconsistent library metadata.`
    }
  }
  if (resolution.options) {
    if (
      !['prop', 'children'].includes(resolution.options.mode)
      || (resolution.options.mode === 'children' && !resolution.options.optionTag)
    ) {
      return `Component "${componentKey}" returned invalid options metadata.`
    }
  }
  return undefined
}

function mergeDependencies(
  target: Map<string, string>,
  dependencies: Readonly<Record<string, string>>,
): string | undefined {
  for (const [name, version] of Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right))) {
    const current = target.get(name)
    if (current !== undefined && current !== version)
      return `Dependency "${name}" resolves to both "${current}" and "${version}".`
    target.set(name, version)
  }
  return undefined
}

export function validateResolverIdentity(
  compilation: ProjectCompilation,
  resolver: SourceProviderResolver,
): ResolutionResult<true> {
  const expected = {
    adapter: compilation.key.registryAdapter,
    adapterVersion: compilation.key.registryAdapterVersion,
    registryFingerprint: compilation.key.registryFingerprint,
  }
  if (
    resolver.adapter.adapter !== expected.adapter
    || resolver.adapter.adapterVersion !== expected.adapterVersion
    || resolver.adapter.registryFingerprint !== expected.registryFingerprint
  ) {
    return failure('Source provider identity does not match the compiled registry lock.', {
      expected,
      received: { ...resolver.adapter },
    })
  }
  return { success: true, data: true }
}

export function resolveSourceComponents(
  compilation: ProjectCompilation,
  resolver: SourceProviderResolver,
): ResolutionResult<ResolvedSourceComponents> {
  const contracts = new Map<string, { contractVersion: string, contractFingerprint: string }>()
  for (const surfaceId of compilation.ir.surfaceOrder) {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return failure(`Compiled Surface "${surfaceId}" is missing.`)
    for (const nodeId of Object.keys(surface.nodesById).sort()) {
      const node = surface.nodesById[nodeId]
      if (!node)
        return failure(`Compiled node "${nodeId}" is missing.`, { surfaceId })
      const identity = {
        contractVersion: node.componentVersion,
        contractFingerprint: node.componentFingerprint,
      }
      const current = contracts.get(node.component)
      if (
        current
        && (current.contractVersion !== identity.contractVersion
          || current.contractFingerprint !== identity.contractFingerprint)
      ) {
        return failure(`Component "${node.component}" has conflicting locked contracts.`)
      }
      contracts.set(node.component, identity)
    }
  }

  const dependencies = new Map<string, string>()
  const byKey = new Map<string, SourceComponentResolution>()
  for (const [componentKey, identity] of [...contracts].sort(([left], [right]) => left.localeCompare(right))) {
    let result
    try {
      result = resolver.resolveComponent({ componentKey, ...identity })
    }
    catch (error) {
      return failure(`Source resolver threw while resolving component "${componentKey}".`, {
        componentKey,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
    if (!result.success)
      return failure(`Source resolver could not resolve component "${componentKey}": ${result.reason}`, { componentKey })
    const validationMessage = validateComponentResolution(componentKey, result.value)
    if (validationMessage)
      return failure(validationMessage, { componentKey })
    const dependencyMessage = mergeDependencies(dependencies, result.value.dependencies)
    if (dependencyMessage)
      return failure(dependencyMessage, { componentKey })
    byKey.set(componentKey, result.value)
  }
  return {
    success: true,
    data: { byKey, dependencies: Object.fromEntries(dependencies) },
  }
}

export function resolveConfigFormBinding(
  resolver: SourceProviderResolver,
): ResolutionResult<SourceConfigFormBindingResolution> {
  let result
  try {
    result = resolver.resolveConfigFormBinding()
  }
  catch (error) {
    return failure('Source resolver threw while resolving the ConfigForm binding.', {
      reason: error instanceof Error ? error.message : String(error),
    })
  }
  if (!result.success)
    return failure(`Source resolver could not resolve the ConfigForm binding: ${result.reason}`)
  const value = result.value
  const imports = [value.component, value.model]
  if (
    !isRecord(value)
    || imports.some(item => !isRecord(item)
      || typeof item.moduleSpecifier !== 'string'
      || !item.moduleSpecifier
      || typeof item.importName !== 'string'
      || !isIdentifier(item.importName))
    || !Array.isArray(value.styleImports)
    || value.styleImports.some(item => typeof item !== 'string' || !item.trim())
    || !isRecord(value.dependencies)
  ) {
    return failure('ConfigForm binding resolution is invalid.')
  }
  const dependenciesMessage = dependencyError(value.dependencies)
  if (dependenciesMessage)
    return failure(dependenciesMessage)
  for (const item of imports) {
    const packageName = packageNameFromSpecifier(item.moduleSpecifier)
    if (packageName && !value.dependencies[packageName])
      return failure(`ConfigForm binding does not declare a version for "${packageName}".`)
  }
  return { success: true, data: value }
}
