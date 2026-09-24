import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { MaterialSemanticTrigger, ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  SourceComponentResolution,
  SourceComponentResolver,
  SourceConfigFormBindingResolution,
  SourceConfigFormBindingResolver,
  SourceSemanticListenerMap,
  SourceSemanticListenerResolution,
} from '../types'
import type { ResolvedSourceComponents } from '../types/internal'
import { isPortableVersion, packageNameFromSpecifier } from './serialization'

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
  return /^[A-Z_$][\w$]*$/i.test(value)
}

const semanticTriggers = new Set<MaterialSemanticTrigger>([
  'activate',
  'submit',
  'rowActivate',
  'itemActivate',
])

function isRawEventName(value: string): boolean {
  return /^[a-z][A-Za-z0-9]*(?:[-:][a-z][A-Za-z0-9]*)*$/.test(value)
}

function listenerPropForEvent(event: string): string {
  const camelized = event.replace(/[-:]([a-z])/gu, (_, letter: string) => letter.toUpperCase())
  return `on${camelized[0]?.toUpperCase() ?? ''}${camelized.slice(1)}`
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(input).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function validateSemanticListener(
  trigger: MaterialSemanticTrigger,
  input: unknown,
): input is SourceSemanticListenerResolution {
  if (
    !isRecord(input)
    || !hasExactKeys(input, ['event', 'item', 'listenerProp'])
    || typeof input.event !== 'string'
    || !isRawEventName(input.event)
    || typeof input.listenerProp !== 'string'
    || !/^on[A-Z][A-Za-z0-9]*$/.test(input.listenerProp)
    || input.listenerProp !== listenerPropForEvent(input.event)
    || !isRecord(input.item)
  ) {
    return false
  }

  const expectsArgument = trigger === 'rowActivate' || trigger === 'itemActivate'
  if (expectsArgument) {
    return hasExactKeys(input.item, ['index', 'kind'])
      && input.item.kind === 'argument'
      && typeof input.item.index === 'number'
      && Number.isSafeInteger(input.item.index)
      && input.item.index >= 0
  }
  return hasExactKeys(input.item, ['kind']) && input.item.kind === 'none'
}

function validateSemanticListeners(
  componentKey: string,
  input: unknown,
): string | undefined {
  if (input === undefined)
    return undefined
  if (!isRecord(input))
    return `Component "${componentKey}" returned invalid semantic listener metadata.`
  for (const [key, listener] of Object.entries(input)) {
    if (!semanticTriggers.has(key as MaterialSemanticTrigger))
      return `Component "${componentKey}" returned an unknown semantic listener trigger "${key}".`
    if (!validateSemanticListener(key as MaterialSemanticTrigger, listener))
      return `Component "${componentKey}" returned an invalid semantic listener for "${key}".`
  }
  return undefined
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
    || !/^[A-Z][\w.:-]*$/i.test(resolution.tag)
    || typeof resolution.configComponent !== 'string'
    || !resolution.configComponent.trim()
    || !['component', 'dataset-list', 'dataset-table', 'layout-flex', 'layout-grid', 'section'].includes(resolution.render)
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
  const styleDependency = undeclaredImportDependency(
    [
      ...resolution.styleImports,
      ...(resolution.library?.stylesheet ? [resolution.library.stylesheet] : []),
    ],
    resolution.dependencies,
  )
  if (styleDependency) {
    return `Component "${componentKey}" style import "${styleDependency.specifier}" does not declare a version for "${styleDependency.packageName}".`
  }
  if (resolution.moduleSpecifier) {
    const packageName = packageNameFromSpecifier(resolution.moduleSpecifier)
    if (packageName && !Object.hasOwn(resolution.dependencies, packageName))
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
  const semanticListenersMessage = validateSemanticListeners(componentKey, resolution.semanticListeners)
  if (semanticListenersMessage)
    return semanticListenersMessage
  return undefined
}

function undeclaredImportDependency(
  specifiers: readonly string[],
  dependencies: Readonly<Record<string, string>>,
): { packageName: string, specifier: string } | undefined {
  for (const specifier of specifiers) {
    const packageName = packageNameFromSpecifier(specifier)
    if (packageName && !Object.hasOwn(dependencies, packageName))
      return { packageName, specifier }
  }
  return undefined
}

interface SemanticTriggerUsage {
  nodeId: string
  surfaceId: string
  trigger: MaterialSemanticTrigger
}

function collectSemanticTriggerUsages(
  compilation: ProjectCompilation,
): ResolutionResult<ReadonlyMap<string, readonly SemanticTriggerUsage[]>> {
  const usages = new Map<string, SemanticTriggerUsage[]>()
  for (const surfaceId of compilation.ir.surfaceOrder) {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return failure(`Compiled Surface "${surfaceId}" is missing.`)
    for (const interaction of surface.interactions) {
      if (interaction.kind !== 'primaryUiAction')
        continue
      const node = surface.nodesById[interaction.nodeId]
      if (!node) {
        return failure(`Primary UI action "${interaction.id}" targets a missing node.`, {
          nodeId: interaction.nodeId,
          surfaceId,
          trigger: interaction.trigger,
        })
      }
      const current = usages.get(node.component) ?? []
      current.push({ nodeId: node.id, surfaceId, trigger: interaction.trigger })
      usages.set(node.component, current)
    }
  }
  return { success: true, data: usages }
}

function validateUsedSemanticListeners(
  componentKey: string,
  listeners: SourceSemanticListenerMap | undefined,
  usages: readonly SemanticTriggerUsage[],
): ResolutionResult<true> {
  for (const usage of usages) {
    const listener = listeners?.[usage.trigger]
    if (!listener) {
      return failure(
        `Component "${componentKey}" does not resolve the used semantic trigger "${usage.trigger}".`,
        { componentKey, ...usage },
      )
    }
  }
  return { success: true, data: true }
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
  resolver: SourceComponentResolver,
): ResolutionResult<true> {
  const expected = {
    adapter: compilation.key.registryAdapter,
    adapterVersion: compilation.key.registryAdapterVersion,
    registryFingerprint: compilation.key.registryFingerprint,
  }
  const actual = resolver.adapter
  if (
    !isRecord(actual)
    || typeof actual.adapter !== 'string'
    || typeof actual.adapterVersion !== 'string'
    || typeof actual.registryFingerprint !== 'string'
    || actual.adapter !== expected.adapter
    || actual.adapterVersion !== expected.adapterVersion
    || actual.registryFingerprint !== expected.registryFingerprint
  ) {
    return failure('Source provider identity does not match the compiled registry lock.', {
      expected,
      received: isRecord(actual) ? { ...actual } : actual,
    })
  }
  return { success: true, data: true }
}

export function resolveSourceComponents(
  compilation: ProjectCompilation,
  resolver: SourceComponentResolver,
): ResolutionResult<ResolvedSourceComponents> {
  const semanticTriggerUsages = collectSemanticTriggerUsages(compilation)
  if (!semanticTriggerUsages.success)
    return semanticTriggerUsages
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
    if (!isRecord(result) || typeof result.success !== 'boolean') {
      return failure(`Source resolver returned an invalid result for component "${componentKey}".`, { componentKey })
    }
    if (!result.success) {
      return failure(
        `Source resolver could not resolve component "${componentKey}": ${typeof result.reason === 'string' ? result.reason : 'unknown reason'}`,
        { componentKey },
      )
    }
    const validationMessage = validateComponentResolution(componentKey, result.value)
    if (validationMessage)
      return failure(validationMessage, { componentKey })
    const semanticListenersResult = validateUsedSemanticListeners(
      componentKey,
      result.value.semanticListeners,
      semanticTriggerUsages.data.get(componentKey) ?? [],
    )
    if (!semanticListenersResult.success)
      return semanticListenersResult
    const dependencyMessage = mergeDependencies(dependencies, result.value.dependencies)
    if (dependencyMessage)
      return failure(dependencyMessage, { componentKey })
    byKey.set(componentKey, result.value)
  }
  const importedPackages = new Set<string>()
  for (const resolution of byKey.values()) {
    const specifiers = [
      resolution.moduleSpecifier,
      ...resolution.styleImports,
      ...(resolution.library?.stylesheet ? [resolution.library.stylesheet] : []),
    ]
    for (const specifier of specifiers) {
      const packageName = packageNameFromSpecifier(specifier)
      if (packageName)
        importedPackages.add(packageName)
    }
  }
  const dependencyNames = [...dependencies.keys()]
  const forbiddenDependencies = dependencyNames.filter(name => (
    name.startsWith('@moluoxixi/')
    || name.startsWith('@config-form/')
    || name === 'zod'
    || name.startsWith('zod/')
  ))
  if (forbiddenDependencies.length > 0) {
    return failure(`Raw source component resolution contains forbidden dependencies: ${forbiddenDependencies.join(', ')}.`)
  }
  if (importedPackages.size > 1) {
    return failure(`Raw source components resolve more than one provider UI package: ${[...importedPackages].sort().join(', ')}.`)
  }
  const undeclaredPurpose = dependencyNames.filter(name => !importedPackages.has(name))
  if (undeclaredPurpose.length > 0) {
    return failure(`Raw source component resolution declares non-provider dependencies: ${undeclaredPurpose.join(', ')}.`)
  }
  return {
    success: true,
    data: { byKey, dependencies: Object.fromEntries(dependencies) },
  }
}

export function resolveConfigFormBinding(
  resolver: SourceConfigFormBindingResolver,
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
  if (!isRecord(result) || typeof result.success !== 'boolean')
    return failure('Source resolver returned an invalid ConfigForm binding result.')
  if (!result.success) {
    return failure(
      `Source resolver could not resolve the ConfigForm binding: ${typeof result.reason === 'string' ? result.reason : 'unknown reason'}`,
    )
  }
  const value = result.value
  if (
    !isRecord(value)
    || !isRecord(value.component)
    || !isRecord(value.model)
    || [value.component, value.model].some(item => !isRecord(item)
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
  const styleDependency = undeclaredImportDependency(value.styleImports, value.dependencies)
  if (styleDependency) {
    return failure(
      `ConfigForm binding style import "${styleDependency.specifier}" does not declare a version for "${styleDependency.packageName}".`,
    )
  }
  for (const item of [value.component, value.model]) {
    const packageName = packageNameFromSpecifier(item.moduleSpecifier)
    if (packageName && !Object.hasOwn(value.dependencies, packageName))
      return failure(`ConfigForm binding does not declare a version for "${packageName}".`)
  }
  return { success: true, data: value }
}
