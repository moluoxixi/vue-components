import type {
  ComponentContract,
  ComponentContractRegistry,
  CreateComponentContractRegistryOptions,
  ModelDiagnostic,
  ModelJsonObject,
  RegistryContractSnapshot,
  RegistryContractSnapshotParseResult,
  RegistryLock,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { REGISTRY_CONTRACT_SNAPSHOT_VERSION } from '../constants'
import { componentContractSchema, registryContractSnapshotSchema } from '../schemas'

export class ComponentContractRegistryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ComponentContractRegistryError'
    this.code = code
  }
}

export function createComponentContractRegistry(
  contracts: readonly ComponentContract[],
  options: CreateComponentContractRegistryOptions,
): ComponentContractRegistry {
  if (!options.adapter.trim() || !options.version.trim()) {
    throw new ComponentContractRegistryError(
      'MODEL_REGISTRY_IDENTITY_INVALID',
      'Component contract registries require non-empty adapter and version values.',
    )
  }

  const byKey = new Map<string, ComponentContract>()
  for (const input of contracts) {
    const result = componentContractSchema.safeParse(input)
    if (!result.success) {
      const issue = result.error.issues[0]
      const path = issue?.path.length ? ` at ${formatIssuePath(issue.path)}` : ''
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_CONTRACT_INVALID',
        `Invalid component contract ${input.key || '<unknown>'}${path}: ${issue?.message ?? 'invalid contract'}`,
      )
    }
    const contract = structuredClone(result.data)
    if (byKey.has(contract.key)) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_CONTRACT_DUPLICATE',
        `Duplicate component contract: ${contract.key}`,
      )
    }
    assertUniqueNames(contract.key, 'property', contract.props.map(item => item.key))
    assertUniqueNames(contract.key, 'event', contract.events.map(item => item.name))
    assertUniqueNames(contract.key, 'binding', contract.bindings.map(item => item.name))
    assertUniqueNames(contract.key, 'slot', contract.slots.map(item => item.name))
    if (contract.kind === 'field' && contract.slots.length > 0) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_FIELD_SLOT_INVALID',
        `Field component contracts cannot define slots: ${contract.key}`,
      )
    }
    byKey.set(contract.key, contract)
  }

  const ordered = [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key))
  const componentLocks = Object.fromEntries(ordered.map(contract => [
    contract.key,
    {
      contractVersion: contract.version,
      fingerprint: contractFingerprint(contract),
    },
  ]))
  const lock: RegistryLock = deepFreeze({
    adapter: options.adapter,
    version: options.version,
    fingerprint: registryLockFingerprint(componentLocks),
    components: componentLocks,
  })
  return Object.freeze({
    lock,
    analyzeLock(candidate: RegistryLock) {
      const diagnostics: ModelDiagnostic[] = []
      if (candidate.adapter !== lock.adapter) {
        diagnostics.push({
          code: 'MODEL_REGISTRY_ADAPTER_MISMATCH',
          message: `Registry adapter ${candidate.adapter} does not match ${lock.adapter}.`,
          path: ['adapter'],
        })
        return diagnostics
      }
      if (candidate.version !== lock.version) {
        diagnostics.push({
          code: 'MODEL_REGISTRY_VERSION_MISMATCH',
          message: `Registry version ${candidate.version} does not match ${lock.version}.`,
          path: ['version'],
        })
      }
      if (candidate.fingerprint !== registryLockFingerprint(candidate.components)) {
        diagnostics.push({
          code: 'MODEL_REGISTRY_FINGERPRINT_MISMATCH',
          message: 'Registry fingerprint does not match its component contracts.',
          path: ['fingerprint'],
        })
      }
      Object.entries(candidate.components).forEach(([component, expected]) => {
        const actual = lock.components[component]
        if (!actual) {
          diagnostics.push({
            code: 'MODEL_REGISTRY_COMPONENT_MISSING',
            message: `Component is not registered: ${component}`,
            path: ['components', component],
          })
          return
        }
        if (expected.contractVersion !== actual.contractVersion) {
          diagnostics.push({
            code: 'MODEL_REGISTRY_COMPONENT_VERSION_MISMATCH',
            message: `Component ${component} contract ${expected.contractVersion} does not match ${actual.contractVersion}.`,
            path: ['components', component, 'contractVersion'],
          })
          return
        }
        if (expected.fingerprint !== actual.fingerprint) {
          diagnostics.push({
            code: 'MODEL_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
            message: `Component contract fingerprint does not match: ${component}`,
            path: ['components', component, 'fingerprint'],
          })
        }
      })
      return diagnostics
    },
    get(key: string) {
      const contract = byKey.get(key)
      return contract ? structuredClone(contract) : undefined
    },
    list() {
      return structuredClone(ordered)
    },
  })
}

export function createComponentDefaults(
  registry: ComponentContractRegistry,
  component: string,
): ModelJsonObject {
  const contract = registry.get(component)
  if (!contract) {
    throw new ComponentContractRegistryError(
      'MODEL_COMPONENT_UNKNOWN',
      `Component is not registered: ${component}`,
    )
  }
  return structuredClone(contract.defaults)
}

/** Create a deterministic, function-free snapshot for compiler and worker boundaries. */
export function createRegistryContractSnapshot(
  registry: ComponentContractRegistry,
): RegistryContractSnapshot {
  return freezeRegistrySnapshot({
    version: REGISTRY_CONTRACT_SNAPSHOT_VERSION,
    adapter: registry.lock.adapter,
    adapterVersion: registry.lock.version,
    fingerprint: registry.lock.fingerprint,
    components: registry.list().map(contract => ({
      key: contract.key,
      contractVersion: contract.version,
      fingerprint: contractFingerprint(contract),
      contract,
    })),
  })
}

/** Parse and verify both registry-level and per-component semantic identities. */
export function parseRegistryContractSnapshot(input: unknown): RegistryContractSnapshotParseResult {
  const parsed = registryContractSnapshotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map(issue => ({
        code: 'MODEL_REGISTRY_SNAPSHOT_INVALID',
        message: issue.message,
        path: issue.path,
      })),
    }
  }

  const diagnostics: ModelDiagnostic[] = []
  const keys = new Set<string>()
  let previousKey: string | undefined
  parsed.data.components.forEach((component, index) => {
    const path = ['components', index]
    if (keys.has(component.key)) {
      diagnostics.push({
        code: 'MODEL_REGISTRY_SNAPSHOT_COMPONENT_DUPLICATE',
        message: `Duplicate registry snapshot component: ${component.key}`,
        path: [...path, 'key'],
      })
    }
    keys.add(component.key)
    if (previousKey !== undefined && previousKey.localeCompare(component.key) >= 0) {
      diagnostics.push({
        code: 'MODEL_REGISTRY_SNAPSHOT_ORDER_INVALID',
        message: 'Registry snapshot components must be sorted by key.',
        path: [...path, 'key'],
      })
    }
    previousKey = component.key
    if (component.key !== component.contract.key || component.contractVersion !== component.contract.version) {
      diagnostics.push({
        code: 'MODEL_REGISTRY_SNAPSHOT_IDENTITY_MISMATCH',
        message: `Registry snapshot identity does not match its contract: ${component.key}`,
        path,
      })
    }
    if (component.fingerprint !== contractFingerprint(component.contract)) {
      diagnostics.push({
        code: 'MODEL_REGISTRY_SNAPSHOT_COMPONENT_FINGERPRINT_MISMATCH',
        message: `Registry snapshot component fingerprint does not match: ${component.key}`,
        path: [...path, 'fingerprint'],
      })
    }
  })

  const expectedFingerprint = registryLockFingerprint(Object.fromEntries(
    parsed.data.components.map(component => [component.key, {
      contractVersion: component.contractVersion,
      fingerprint: component.fingerprint,
    }]),
  ))
  if (parsed.data.fingerprint !== expectedFingerprint) {
    diagnostics.push({
      code: 'MODEL_REGISTRY_SNAPSHOT_FINGERPRINT_MISMATCH',
      message: 'Registry snapshot fingerprint does not match its component contracts.',
      path: ['fingerprint'],
    })
  }
  if (diagnostics.length > 0)
    return { success: false, diagnostics }
  return {
    success: true,
    data: freezeRegistrySnapshot(structuredClone(parsed.data)),
    diagnostics: [],
  }
}

export function assertRegistryContractSnapshot(input: unknown): RegistryContractSnapshot {
  const result = parseRegistryContractSnapshot(input)
  if (!result.success) {
    const diagnostic = result.diagnostics[0]
    throw new ComponentContractRegistryError(
      diagnostic?.code ?? 'MODEL_REGISTRY_SNAPSHOT_INVALID',
      diagnostic?.message ?? 'Registry contract snapshot is invalid.',
    )
  }
  return result.data
}

function assertUniqueNames(component: string, kind: string, names: string[]): void {
  const seen = new Set<string>()
  const duplicate = names.find((name) => {
    if (seen.has(name))
      return true
    seen.add(name)
    return false
  })
  if (duplicate) {
    throw new ComponentContractRegistryError(
      'MODEL_COMPONENT_CONTRACT_DUPLICATE_MEMBER',
      `Duplicate ${kind} ${duplicate} in component contract ${component}.`,
    )
  }
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => (
    typeof segment === 'number'
      ? `${formatted}[${segment}]`
      : formatted
        ? `${formatted}.${String(segment)}`
        : String(segment)
  ), '')
}

function contractFingerprint(contract: ComponentContract): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(contract)}`
}

export function registryLockFingerprint(components: RegistryLock['components']): string {
  const ordered = Object.fromEntries(Object.entries(components)
    .sort(([left], [right]) => left.localeCompare(right)))
  return `fnv1a:${getConfigFormJsonSemanticHash(ordered)}`
}

function freezeRegistrySnapshot(snapshot: RegistryContractSnapshot): RegistryContractSnapshot {
  return deepFreeze(snapshot)
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(child => deepFreeze(child))
  return Object.freeze(value)
}
