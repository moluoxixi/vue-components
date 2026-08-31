import type {
  ComponentContract,
  ComponentContractMigration,
  ComponentContractRegistry,
  ModelDiagnostic,
  ModelJsonObject,
  PageNode,
  ProjectDocument,
  RegistryContractSnapshot,
  RegistryContractSnapshotParseResult,
  RegistryLock,
} from './types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { z } from 'zod'
import { modelJsonObjectSchema, pageNodeSchema } from './schema'
import { REGISTRY_CONTRACT_SNAPSHOT_VERSION } from './types'

const FORBIDDEN_MEMBER_NAMES = new Set(['__proto__', 'constructor', 'prototype'])
const keySchema = z.string().trim().min(1).max(128).regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
const memberNameSchema = z.string().trim().min(1).max(128).refine(name => !FORBIDDEN_MEMBER_NAMES.has(name), 'Object member name is not allowed')
const versionSchema = z.string().trim().min(1).max(80)
const pathSchema = z.array(memberNameSchema).min(1)

export const componentContractSchema: z.ZodType<ComponentContract> = z.object({
  key: keySchema,
  version: versionSchema,
  kind: z.enum(['field', 'layout']),
  props: z.array(z.object({
    key: memberNameSchema,
    path: pathSchema,
    valueKind: z.string().trim().min(1).optional(),
    required: z.boolean().optional(),
  }).strict()),
  events: z.array(z.object({ name: memberNameSchema }).strict()),
  bindings: z.array(z.object({
    name: memberNameSchema,
    valueProp: memberNameSchema,
    trigger: memberNameSchema,
  }).strict()),
  slots: z.array(z.object({
    name: memberNameSchema,
    accepts: z.array(z.enum(['field', 'layout'])).min(1).optional(),
    components: z.array(keySchema).min(1).optional(),
  }).strict()),
  allowedParents: z.array(z.object({
    component: keySchema,
    slot: memberNameSchema,
  }).strict()),
  defaults: modelJsonObjectSchema,
}).strict()

const registryContractComponentSnapshotSchema = z.object({
  key: keySchema,
  contractVersion: versionSchema,
  fingerprint: z.string().trim().min(1),
  contract: componentContractSchema,
}).strict()

export const registryContractSnapshotSchema = z.object({
  schemaVersion: z.literal(REGISTRY_CONTRACT_SNAPSHOT_VERSION),
  adapter: keySchema,
  adapterVersion: versionSchema,
  fingerprint: z.string().trim().min(1),
  components: z.array(registryContractComponentSnapshotSchema),
}).strict()

export interface CreateComponentContractRegistryOptions {
  adapter: string
  version: string
  migrations?: readonly ComponentContractMigration[]
}

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
  const migrations = createMigrationIndex(options.migrations ?? [], byKey)

  function migrationPath(component: string, fromVersion: string): ComponentContractMigration[] | undefined {
    const contract = byKey.get(component)
    if (!contract)
      return undefined
    if (fromVersion === contract.version)
      return []
    const byVersion = migrations.get(component)
    const path: ComponentContractMigration[] = []
    const visited = new Set<string>()
    let version = fromVersion
    while (version !== contract.version) {
      if (visited.has(version))
        return undefined
      visited.add(version)
      const migration = byVersion?.get(version)
      if (!migration)
        return undefined
      path.push(migration)
      version = migration.toVersion
    }
    return path
  }

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
          const path = migrationPath(component, expected.contractVersion)
          diagnostics.push({
            code: path
              ? 'MODEL_REGISTRY_COMPONENT_MIGRATION_REQUIRED'
              : 'MODEL_REGISTRY_COMPONENT_VERSION_UNSUPPORTED',
            message: path
              ? `Component ${component} can migrate from ${expected.contractVersion} to ${actual.contractVersion}.`
              : `Component ${component} cannot migrate from ${expected.contractVersion} to ${actual.contractVersion}.`,
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
    migrateNode(node: PageNode, fromVersion: string) {
      const contract = byKey.get(node.component)
      const path = migrationPath(node.component, fromVersion)
      if (!contract || !path) {
        return {
          success: false as const,
          node,
          diagnostics: [{
            code: contract ? 'MODEL_COMPONENT_MIGRATION_UNAVAILABLE' : 'MODEL_COMPONENT_UNKNOWN',
            message: contract
              ? `No migration path exists for ${node.component} from ${fromVersion} to ${contract.version}.`
              : `Component is not registered: ${node.component}`,
            nodeId: node.id,
          }],
        }
      }
      let candidate = structuredClone(node)
      const appliedVersions: string[] = []
      for (const migration of path) {
        let first: PageNode
        let second: PageNode
        try {
          first = migration.migrate(structuredClone(candidate))
          second = migration.migrate(structuredClone(candidate))
        }
        catch (cause) {
          return {
            success: false as const,
            node,
            diagnostics: [{
              code: 'MODEL_COMPONENT_MIGRATION_FAILED',
              message: cause instanceof Error ? cause.message : String(cause),
              nodeId: node.id,
            }],
          }
        }
        const parsed = pageNodeSchema.safeParse(first)
        const deterministic = getConfigFormJsonSemanticHash(first) === getConfigFormJsonSemanticHash(second)
        if (!parsed.success
          || !deterministic
          || parsed.data.id !== node.id
          || parsed.data.component !== node.component
          || parsed.data.kind !== contract.kind) {
          return {
            success: false as const,
            node,
            diagnostics: [{
              code: deterministic
                ? 'MODEL_COMPONENT_MIGRATION_RESULT_INVALID'
                : 'MODEL_COMPONENT_MIGRATION_NON_DETERMINISTIC',
              message: `Component migration returned an invalid result for ${node.component}.`,
              nodeId: node.id,
            }],
          }
        }
        candidate = parsed.data
        appliedVersions.push(migration.toVersion)
      }
      return {
        success: true as const,
        node: candidate,
        fromVersion,
        toVersion: contract.version,
        appliedVersions,
      }
    },
  })
}

function createMigrationIndex(
  migrations: readonly ComponentContractMigration[],
  contracts: ReadonlyMap<string, ComponentContract>,
): Map<string, Map<string, ComponentContractMigration>> {
  const index = new Map<string, Map<string, ComponentContractMigration>>()
  migrations.forEach((migration) => {
    if (!contracts.has(migration.component)) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_MIGRATION_COMPONENT_UNKNOWN',
        `Migration references an unknown component: ${migration.component}`,
      )
    }
    if (!migration.fromVersion.trim()
      || !migration.toVersion.trim()
      || migration.fromVersion === migration.toVersion) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_MIGRATION_VERSION_INVALID',
        `Migration versions are invalid for ${migration.component}.`,
      )
    }
    const byVersion = index.get(migration.component) ?? new Map<string, ComponentContractMigration>()
    if (byVersion.has(migration.fromVersion)) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_MIGRATION_AMBIGUOUS',
        `Multiple migrations start at ${migration.component}@${migration.fromVersion}.`,
      )
    }
    byVersion.set(migration.fromVersion, migration)
    index.set(migration.component, byVersion)
  })
  return index
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

/** Select the immutable compatibility lock for the components used by a project. */
export function createProjectRegistryLock(
  project: Pick<ProjectDocument, 'pagesById'>,
  registry: ComponentContractRegistry,
): RegistryLock {
  const componentKeys = new Set<string>()
  Object.values(project.pagesById).forEach((page) => {
    Object.values(page.graph.nodesById).forEach(node => componentKeys.add(node.component))
  })
  return createRegistryLockForComponents(registry, componentKeys)
}

export function createRegistryLockForComponents(
  registry: ComponentContractRegistry,
  componentKeys: Iterable<string>,
): RegistryLock {
  const components: RegistryLock['components'] = Object.create(null)
  for (const key of [...new Set(componentKeys)].sort((left, right) => left.localeCompare(right))) {
    const contract = registry.get(key)
    if (!contract) {
      throw new ComponentContractRegistryError(
        'MODEL_COMPONENT_UNKNOWN',
        `Component is not registered: ${key}`,
      )
    }
    components[key] = {
      contractVersion: contract.version,
      fingerprint: contractFingerprint(contract),
    }
  }
  return deepFreeze({
    adapter: registry.lock.adapter,
    version: registry.lock.version,
    fingerprint: registryLockFingerprint(components),
    components,
  })
}

export function selectRegistryLockComponents(
  lock: RegistryLock,
  componentKeys: Iterable<string>,
): RegistryLock {
  const components: RegistryLock['components'] = Object.create(null)
  for (const key of [...new Set(componentKeys)].sort((left, right) => left.localeCompare(right))) {
    const component = lock.components[key]
    if (!component) {
      throw new ComponentContractRegistryError(
        'MODEL_REGISTRY_COMPONENT_LOCK_MISSING',
        `Registry lock does not contain component: ${key}`,
      )
    }
    components[key] = structuredClone(component)
  }
  return deepFreeze({
    adapter: lock.adapter,
    version: lock.version,
    fingerprint: registryLockFingerprint(components),
    components,
  })
}

/** Create a deterministic, function-free snapshot for compiler and worker boundaries. */
export function createRegistryContractSnapshot(
  registry: ComponentContractRegistry,
): RegistryContractSnapshot {
  return freezeRegistrySnapshot({
    schemaVersion: REGISTRY_CONTRACT_SNAPSHOT_VERSION,
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

function registryLockFingerprint(components: RegistryLock['components']): string {
  const ordered = Object.fromEntries(Object.entries(components)
    .sort(([left], [right]) => left.localeCompare(right)))
  return `fnv1a:${getConfigFormJsonSemanticHash(ordered)}`
}

function freezeRegistrySnapshot(snapshot: z.infer<typeof registryContractSnapshotSchema>): RegistryContractSnapshot {
  return deepFreeze(snapshot) as RegistryContractSnapshot
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(child => deepFreeze(child))
  return Object.freeze(value)
}
