import type {
  MemoryProjectRepositoryOptions,
  PersistedProjectEnvelope,
  ProjectCommitMetadata,
  ProjectDataset,
  ProjectDocument,
  ProjectEmbeddedResource,
  ProjectEmbeddedResourceRead,
  ProjectEmbeddedResourceWrite,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
  ProjectRepositoryCreateInput,
  ProjectRepositoryErrorCode,
  ProjectRepositorySeed,
  ProjectResource,
  ProjectSummary,
  ProjectSurface,
  ProjectVersionLabelInput,
  ProjectVersionRetentionPolicy,
  ProjectVersionSummary,
  RegistryLock,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { assertProjectDocument } from '../schemas'

const CONTENT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/

export class ProjectRepositoryError extends Error {
  readonly code: ProjectRepositoryErrorCode

  constructor(code: ProjectRepositoryErrorCode, message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ProjectRepositoryError'
    this.code = code
  }
}

interface StoredEntity<T> {
  checksum: string
  revision: number
  value: T
}

interface StoredProjectManifest {
  checksum: string
  revision: number
  version: ProjectDocument['version']
  id: string
  name: string
  repositoryRevision: number
  createdAt: string
  updatedAt: string
  homeSurfaceId: string
  surfaceOrder: string[]
  datasetOrder: string[]
  theme: ProjectDocument['theme']
  registryLock: RegistryLock
  settings: ProjectDocument['settings']
}

interface StoredEmbeddedResource {
  resourceId: string
  contentHash: string
  byteLength: number
  bytes: Uint8Array
}

interface CommitReceipt {
  commandId: string
  project: PersistedProjectEnvelope
  expectedRepositoryRevision: number
  payloadChecksum: string
}

interface StoredProjectVersion {
  metadata: ProjectVersionSummary
  project: PersistedProjectEnvelope
}

interface StoredProject {
  manifest: StoredProjectManifest
  surfaces: Map<string, StoredEntity<ProjectSurface>>
  datasets: Map<string, StoredEntity<ProjectDataset>>
  resources: Map<string, StoredEntity<ProjectResource>>
  embedded: Map<string, StoredEmbeddedResource>
  receipts: Map<string, CommitReceipt>
  versions: Map<number, StoredProjectVersion>
}

function checksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function resourceByteKey(resourceId: string, contentHash: string): string {
  return `${resourceId}\0${contentHash}`
}

function manifestContent(input: Omit<StoredProjectManifest, 'checksum' | 'revision'>) {
  return {
    version: input.version,
    id: input.id,
    name: input.name,
    homeSurfaceId: input.homeSurfaceId,
    surfaceOrder: input.surfaceOrder,
    datasetOrder: input.datasetOrder,
    theme: input.theme,
    registryLock: input.registryLock,
    settings: input.settings,
  }
}

function storeEntities<T extends { id: string }>(
  values: Record<string, T>,
  repositoryRevision: number,
  current?: Map<string, StoredEntity<T>>,
): Map<string, StoredEntity<T>> {
  const stored = new Map<string, StoredEntity<T>>()
  Object.keys(values).sort((left, right) => left.localeCompare(right)).forEach((id) => {
    const value = values[id]!
    const valueChecksum = checksum(value)
    const previous = current?.get(id)
    stored.set(id, previous?.checksum === valueChecksum
      ? previous
      : {
          checksum: valueChecksum,
          revision: repositoryRevision,
          value: structuredClone(value),
        })
  })
  return stored
}

function splitProject(
  project: Pick<PersistedProjectEnvelope, 'document' | 'repositoryRevision' | 'createdAt' | 'updatedAt'>,
  current?: StoredProject,
  embedded = current?.embedded ?? new Map<string, StoredEmbeddedResource>(),
): StoredProject {
  const parsed = assertProjectDocument(project.document)
  const manifestBase: Omit<StoredProjectManifest, 'checksum' | 'revision'> = {
    version: parsed.version,
    id: parsed.id,
    name: parsed.name,
    repositoryRevision: project.repositoryRevision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    homeSurfaceId: parsed.homeSurfaceId,
    surfaceOrder: [...parsed.surfaceOrder],
    datasetOrder: [...parsed.datasetOrder],
    theme: structuredClone(parsed.theme),
    registryLock: structuredClone(parsed.registryLock),
    settings: structuredClone(parsed.settings),
  }
  const manifestChecksum = checksum(manifestContent(manifestBase))
  const revision = current?.manifest.checksum === manifestChecksum
    ? current.manifest.revision
    : project.repositoryRevision

  return {
    manifest: { ...manifestBase, checksum: manifestChecksum, revision },
    surfaces: storeEntities(parsed.surfacesById, project.repositoryRevision, current?.surfaces),
    datasets: storeEntities(parsed.datasetsById, project.repositoryRevision, current?.datasets),
    resources: storeEntities(parsed.resources, project.repositoryRevision, current?.resources),
    embedded: new Map(embedded),
    receipts: new Map(current?.receipts),
    versions: new Map(current?.versions),
  }
}

function assembleEntityMap<T extends { id: string }>(
  entities: Map<string, StoredEntity<T>>,
  kind: string,
): { values: Record<string, T>, revisions: Record<string, number> } {
  const values: Record<string, T> = Object.create(null)
  const revisions: Record<string, number> = Object.create(null)
  entities.forEach((entity, id) => {
    if (entity.value.id !== id || entity.checksum !== checksum(entity.value))
      corrupt(`${kind} entity checksum or identity mismatch: ${id}`)
    values[id] = structuredClone(entity.value)
    revisions[id] = entity.revision
  })
  return { values, revisions }
}

async function assembleProject(stored: StoredProject): Promise<PersistedProjectEnvelope> {
  if (stored.manifest.checksum !== checksum(manifestContent(stored.manifest)))
    corrupt('Project manifest checksum mismatch.')
  const surfaces = assembleEntityMap(stored.surfaces, 'Surface')
  const datasets = assembleEntityMap(stored.datasets, 'Dataset')
  const resources = assembleEntityMap(stored.resources, 'Resource')
  let document: ProjectDocument
  try {
    document = assertProjectDocument({
      version: stored.manifest.version,
      id: stored.manifest.id,
      name: stored.manifest.name,
      homeSurfaceId: stored.manifest.homeSurfaceId,
      surfaceOrder: stored.manifest.surfaceOrder,
      surfacesById: surfaces.values,
      datasetOrder: stored.manifest.datasetOrder,
      datasetsById: datasets.values,
      resources: resources.values,
      theme: stored.manifest.theme,
      registryLock: stored.manifest.registryLock,
      settings: stored.manifest.settings,
    })
  }
  catch (error) {
    corrupt(error instanceof Error ? error.message : String(error))
  }
  await validatePublishedBytes(stored, document)
  return {
    document,
    repositoryRevision: stored.manifest.repositoryRevision,
    entityRevisions: {
      manifest: stored.manifest.revision,
      surfaces: surfaces.revisions,
      datasets: datasets.revisions,
      resources: resources.revisions,
    },
    createdAt: stored.manifest.createdAt,
    updatedAt: stored.manifest.updatedAt,
  }
}

function invalidCommit(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_INVALID_COMMIT', message)
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

async function sha256ContentHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    invalidCommit('SHA-256 is unavailable in this runtime.')
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function embeddedResourcesFromRecord(resources: Record<string, ProjectResource>): ProjectEmbeddedResource[] {
  return Object.values(resources)
    .filter((resource): resource is ProjectEmbeddedResource => resource.kind === 'embedded')
    .sort((left, right) => left.id.localeCompare(right.id))
}

function embeddedResources(document: ProjectDocument): ProjectEmbeddedResource[] {
  return embeddedResourcesFromRecord(document.resources)
}

function snapshotEmbeddedWrites(
  writes: readonly ProjectEmbeddedResourceWrite[],
): ProjectEmbeddedResourceWrite[] {
  if (!Array.isArray(writes))
    invalidCommit('Embedded Resource writes must be an array.')
  return writes.map((write) => {
    if (!write || typeof write.resourceId !== 'string' || typeof write.contentHash !== 'string')
      invalidCommit('Embedded Resource write identity is invalid.')
    if (!(write.bytes instanceof Uint8Array))
      invalidCommit(`Embedded Resource bytes do not match metadata: ${write.resourceId}`)
    return {
      resourceId: write.resourceId,
      contentHash: write.contentHash,
      bytes: new Uint8Array(write.bytes),
    }
  })
}

async function validateIncomingWrites(
  document: ProjectDocument,
  writes: readonly ProjectEmbeddedResourceWrite[],
  requireCompleteSnapshot: boolean,
): Promise<Map<string, StoredEmbeddedResource>> {
  if (!Array.isArray(writes))
    invalidCommit('Embedded Resource writes must be an array.')
  const resources = new Map(embeddedResources(document).map(resource => [resource.id, resource]))
  const seen = new Set<string>()
  const result = new Map<string, StoredEmbeddedResource>()
  for (const write of writes) {
    if (!write || typeof write.resourceId !== 'string' || typeof write.contentHash !== 'string')
      invalidCommit('Embedded Resource write identity is invalid.')
    if (seen.has(write.resourceId))
      invalidCommit(`Embedded Resource write is duplicated: ${write.resourceId}`)
    seen.add(write.resourceId)
    const resource = resources.get(write.resourceId)
    if (!resource)
      invalidCommit(`Embedded Resource write is not declared by the document: ${write.resourceId}`)
    if (!(write.bytes instanceof Uint8Array))
      invalidCommit(`Embedded Resource bytes do not match metadata: ${write.resourceId}`)
    const bytes = new Uint8Array(write.bytes)
    if (!CONTENT_HASH_PATTERN.test(write.contentHash)
      || write.contentHash !== resource.contentHash
      || bytes.byteLength !== resource.byteLength
      || await sha256ContentHash(bytes) !== resource.contentHash) {
      invalidCommit(`Embedded Resource bytes do not match metadata: ${write.resourceId}`)
    }
    const stored = {
      resourceId: write.resourceId,
      contentHash: write.contentHash,
      byteLength: bytes.byteLength,
      bytes,
    }
    result.set(resourceByteKey(write.resourceId, write.contentHash), stored)
  }
  if (requireCompleteSnapshot) {
    const missing = [...resources.keys()].find(resourceId => !seen.has(resourceId))
    if (missing)
      invalidCommit(`Embedded Resource bytes are missing: ${missing}`)
  }
  return result
}

async function validateStoredBytes(
  key: string,
  record: StoredEmbeddedResource,
  resource?: ProjectEmbeddedResource,
): Promise<void> {
  if (!record
    || resourceByteKey(record.resourceId, record.contentHash) !== key
    || !(record.bytes instanceof Uint8Array)
    || !Number.isInteger(record.byteLength)
    || record.byteLength < 0
    || record.bytes.byteLength !== record.byteLength
    || !CONTENT_HASH_PATTERN.test(record.contentHash)
    || await sha256ContentHash(record.bytes) !== record.contentHash
    || (resource !== undefined
      && (resource.id !== record.resourceId
        || resource.contentHash !== record.contentHash
        || resource.byteLength !== record.byteLength))) {
    corrupt(`Stored Resource bytes are invalid: ${record?.resourceId ?? key}`)
  }
}

async function validatePublishedBytes(stored: StoredProject, document: ProjectDocument): Promise<void> {
  for (const resource of embeddedResources(document)) {
    const key = resourceByteKey(resource.id, resource.contentHash)
    const record = stored.embedded.get(key)
    if (!record)
      corrupt(`Stored Resource bytes are missing: ${resource.id}`)
    await validateStoredBytes(key, record, resource)
  }
}

async function validateCommitByteAvailability(
  document: ProjectDocument,
  stored: StoredProject,
  staged: Map<string, StoredEmbeddedResource>,
): Promise<Map<string, StoredEmbeddedResource>> {
  const embedded = new Map(stored.embedded)
  for (const resource of embeddedResources(document)) {
    const key = resourceByteKey(resource.id, resource.contentHash)
    const existing = embedded.get(key)
    if (existing) {
      await validateStoredBytes(key, existing)
      if (existing.resourceId !== resource.id
        || existing.contentHash !== resource.contentHash
        || existing.byteLength !== resource.byteLength) {
        invalidCommit(`Stored Resource bytes do not match incoming metadata: ${resource.id}`)
      }
    }
    const replacement = staged.get(key)
    if (replacement)
      embedded.set(key, replacement)
    else if (!existing)
      invalidCommit(`Embedded Resource bytes are missing: ${resource.id}`)
  }
  staged.forEach((record, key) => embedded.set(key, record))
  return embedded
}

export function assertProjectRepositorySeed(seed: ProjectRepositorySeed): ProjectRepositorySeed {
  if (!Number.isInteger(seed.repositoryRevision) || seed.repositoryRevision < 0)
    invalidCommit('Initial repository revision must be a non-negative integer.')
  if (!Number.isFinite(Date.parse(seed.createdAt)) || !Number.isFinite(Date.parse(seed.updatedAt)))
    invalidCommit('Repository timestamps must be valid ISO date strings.')
  return structuredClone(seed)
}

function clonePersistedProject(project: PersistedProjectEnvelope): PersistedProjectEnvelope {
  return {
    document: assertProjectDocument(project.document),
    repositoryRevision: project.repositoryRevision,
    entityRevisions: structuredClone(project.entityRevisions),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function assertVersionLabel(label: string | undefined): string | undefined {
  if (label === undefined)
    return undefined
  const normalized = label.trim()
  const containsControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1F || code === 0x7F
  })
  if (!normalized || normalized.length > 80 || containsControlCharacter)
    invalidCommit('Version labels must contain 1 to 80 characters and cannot contain control characters.')
  return normalized
}

export function assertProjectCommitMetadata(metadata: ProjectCommitMetadata): ProjectCommitMetadata {
  if (!metadata || !['autosave', 'create', 'manual', 'restore'].includes(metadata.source))
    invalidCommit('Repository commits require a valid commit source.')
  const label = assertVersionLabel(metadata.label)
  const restoredFromRevision = metadata.restoredFromRevision
  if (restoredFromRevision !== undefined
    && (!Number.isInteger(restoredFromRevision) || restoredFromRevision < 0)) {
    invalidCommit('Restored revision must be a non-negative integer.')
  }
  if (metadata.source === 'restore' && restoredFromRevision === undefined)
    invalidCommit('Restore commits require the source revision.')
  if (metadata.source !== 'restore' && restoredFromRevision !== undefined)
    invalidCommit('Only restore commits may reference a restored revision.')
  return {
    source: metadata.source,
    ...(label ? { label } : {}),
    ...(restoredFromRevision !== undefined ? { restoredFromRevision } : {}),
  }
}

function createVersionSummary(
  project: PersistedProjectEnvelope,
  metadata: ProjectCommitMetadata,
): ProjectVersionSummary {
  return {
    projectId: project.document.id,
    repositoryRevision: project.repositoryRevision,
    source: metadata.source,
    ...(metadata.label ? { label: metadata.label } : {}),
    contentHash: checksum(project.document),
    createdAt: project.updatedAt,
    ...(metadata.restoredFromRevision !== undefined
      ? { restoredFromRevision: metadata.restoredFromRevision }
      : {}),
  }
}

function cloneVersionSummary(version: ProjectVersionSummary): ProjectVersionSummary {
  return structuredClone(version)
}

export function getProjectRepositoryCommitChecksum(input: ProjectRepositoryCommitInput): string {
  const embeddedWrites = [...(input.embeddedWrites ?? [])]
    .map(write => ({
      resourceId: write.resourceId,
      contentHash: write.contentHash,
      bytes: write.bytes instanceof Uint8Array ? [...write.bytes] : write.bytes,
    }))
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId))
  return checksum({
    document: input.document,
    embeddedWrites,
    expectedRepositoryRevision: input.expectedRepositoryRevision,
    id: input.id,
    metadata: assertProjectCommitMetadata(input.metadata),
  })
}

export function summarizePersistedProject(
  project: Pick<PersistedProjectEnvelope, 'document' | 'repositoryRevision' | 'updatedAt'>,
): ProjectSummary {
  return {
    id: project.document.id,
    name: project.document.name,
    repositoryRevision: project.repositoryRevision,
    homeSurfaceId: project.document.homeSurfaceId,
    surfaceCount: project.document.surfaceOrder.length,
    datasetCount: project.document.datasetOrder.length,
    resourceCount: Object.keys(project.document.resources).length,
    registryLock: structuredClone(project.document.registryLock),
    updatedAt: project.updatedAt,
  }
}

function publishedResources(stored: StoredProject, resourceId: string): ProjectResource[] {
  const resources: ProjectResource[] = []
  const current = stored.resources.get(resourceId)?.value
  if (current)
    resources.push(current)
  stored.versions.forEach((version) => {
    const resource = version.project.document.resources[resourceId]
    if (resource)
      resources.push(resource)
  })
  stored.receipts.forEach((receipt) => {
    const resource = receipt.project.document.resources[resourceId]
    if (resource)
      resources.push(resource)
  })
  return resources
}

function reachableByteKeys(stored: StoredProject): Set<string> {
  const keys = new Set<string>()
  const addResources = (resources: Record<string, ProjectResource>) => {
    embeddedResourcesFromRecord(resources)
      .forEach(resource => keys.add(resourceByteKey(resource.id, resource.contentHash)))
  }
  const currentResources: Record<string, ProjectResource> = Object.create(null)
  stored.resources.forEach((entity, id) => {
    currentResources[id] = entity.value
  })
  addResources(currentResources)
  stored.versions.forEach(version => addResources(version.project.document.resources))
  stored.receipts.forEach(receipt => addResources(receipt.project.document.resources))
  return keys
}

export class MemoryProjectRepository implements ProjectRepository {
  readonly persistence = 'volatile' as const
  private readonly projects = new Map<string, StoredProject>()
  private readonly projectQueues = new Map<string, Promise<void>>()
  private readonly receiptLimit: number
  private readonly now: () => string

  constructor(options: MemoryProjectRepositoryOptions = {}) {
    this.receiptLimit = options.receiptLimit ?? 256
    this.now = options.now ?? (() => new Date().toISOString())
    if (!Number.isInteger(this.receiptLimit) || this.receiptLimit < 1)
      throw new RangeError('Project repository receipt limit must be a positive integer.')
  }

  async get(id: string): Promise<PersistedProjectEnvelope | undefined> {
    const stored = this.projects.get(id)
    return stored ? await assembleProject(stored) : undefined
  }

  async list(): Promise<ProjectSummary[]> {
    const projects = await Promise.all([...this.projects.values()].map(stored => assembleProject(stored)))
    return projects
      .map(summarizePersistedProject)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: ProjectRepositoryCreateInput): Promise<PersistedProjectEnvelope> {
    const document = assertProjectDocument(input.document)
    const embeddedContents = snapshotEmbeddedWrites(input.embeddedContents)
    const timestamp = this.now()
    const seed = assertProjectRepositorySeed(input.seed ?? {
      repositoryRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    return this.runProjectMutation(document.id, async () => {
      if (this.projects.has(document.id)) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_EXISTS',
          `Project already exists: ${document.id}`,
        )
      }
      const embedded = await validateIncomingWrites(document, embeddedContents, true)
      const stored = splitProject({
        document,
        repositoryRevision: seed.repositoryRevision,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
      }, undefined, embedded)
      const project = await assembleProject(stored)
      stored.versions.set(project.repositoryRevision, {
        metadata: createVersionSummary(project, { source: 'create' }),
        project: clonePersistedProject(project),
      })
      this.projects.set(document.id, stored)
      return project
    })
  }

  async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
    const commandId = input.commandId
    if (typeof commandId !== 'string' || !commandId || commandId !== commandId.trim())
      invalidCommit('Repository commits require a non-empty command id.')
    const document = assertProjectDocument(input.document)
    const metadata = assertProjectCommitMetadata(input.metadata)
    const embeddedWrites = snapshotEmbeddedWrites(input.embeddedWrites ?? [])
    const snapshot: ProjectRepositoryCommitInput = {
      commandId,
      document,
      embeddedWrites,
      expectedRepositoryRevision: input.expectedRepositoryRevision,
      id: input.id,
      metadata,
    }
    const payloadChecksum = getProjectRepositoryCommitChecksum(snapshot)
    return this.runProjectMutation(snapshot.id, async () => {
      const current = this.projects.get(snapshot.id)
      if (!current) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project does not exist: ${snapshot.id}`,
        )
      }
      const stagedWrites = await validateIncomingWrites(document, embeddedWrites, false)
      const receipt = current.receipts.get(commandId)
      if (receipt) {
        if (receipt.payloadChecksum !== payloadChecksum) {
          throw new ProjectRepositoryError(
            'PROJECT_REPOSITORY_COMMAND_REUSED',
            `Commit command id was reused with a different payload: ${commandId}`,
          )
        }
        await validatePublishedBytes(current, receipt.project.document)
        return { project: clonePersistedProject(receipt.project), replayed: true }
      }

      const currentProject = await assembleProject(current)
      if (currentProject.repositoryRevision !== snapshot.expectedRepositoryRevision) {
        throw new ProjectRepositoryError(
          'PROJECT_REVISION_CONFLICT',
          `Expected repository revision ${snapshot.expectedRepositoryRevision}, but repository has ${currentProject.repositoryRevision}.`,
        )
      }
      if (document.id !== snapshot.id || document.id !== currentProject.document.id)
        invalidCommit('Repository commits cannot change project identity.')

      const embedded = await validateCommitByteAvailability(document, current, stagedWrites)
      const updatedAt = this.now()
      if (!Number.isFinite(Date.parse(updatedAt)))
        invalidCommit('Repository timestamps must be valid ISO date strings.')
      const staged = splitProject({
        document,
        repositoryRevision: currentProject.repositoryRevision + 1,
        createdAt: currentProject.createdAt,
        updatedAt,
      }, current, embedded)
      const committedProject = await assembleProject(staged)
      staged.versions.set(committedProject.repositoryRevision, {
        metadata: createVersionSummary(committedProject, metadata),
        project: clonePersistedProject(committedProject),
      })
      staged.receipts.set(commandId, {
        commandId,
        project: clonePersistedProject(committedProject),
        expectedRepositoryRevision: snapshot.expectedRepositoryRevision,
        payloadChecksum,
      })
      while (staged.receipts.size > this.receiptLimit)
        staged.receipts.delete(staged.receipts.keys().next().value!)
      this.projects.set(snapshot.id, staged)
      return { project: committedProject, replayed: false }
    })
  }

  async readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined> {
    const stored = this.projects.get(input.projectId)
    if (!stored)
      return undefined
    const key = resourceByteKey(input.resourceId, input.contentHash)
    const declarations = publishedResources(stored, input.resourceId)
      .filter((resource): resource is ProjectEmbeddedResource => (
        resource.kind === 'embedded' && resource.contentHash === input.contentHash
      ))
    const record = stored.embedded.get(key)
    if (!record) {
      if (declarations.length > 0)
        corrupt(`Stored Resource bytes are missing: ${input.resourceId}`)
      return undefined
    }
    await validateStoredBytes(key, record)
    if (declarations.some(resource => resource.byteLength !== record.byteLength))
      corrupt(`Stored Resource byte length does not match metadata: ${input.resourceId}`)
    return new Uint8Array(record.bytes)
  }

  async delete(id: string): Promise<void> {
    await this.runProjectMutation(id, async () => {
      this.projects.delete(id)
    })
  }

  async getVersion(projectId: string, revision: number): Promise<PersistedProjectEnvelope | undefined> {
    const stored = this.projects.get(projectId)
    const version = stored?.versions.get(revision)
    if (!stored || !version)
      return undefined
    await validatePublishedBytes(stored, version.project.document)
    return clonePersistedProject(version.project)
  }

  async listVersions(projectId: string): Promise<ProjectVersionSummary[]> {
    const project = this.projects.get(projectId)
    if (!project)
      return []
    return [...project.versions.values()]
      .map(version => cloneVersionSummary(version.metadata))
      .sort((left, right) => right.repositoryRevision - left.repositoryRevision)
  }

  async setVersionLabel(input: ProjectVersionLabelInput): Promise<void> {
    await this.runProjectMutation(input.projectId, async () => {
      const project = this.projects.get(input.projectId)
      if (!project) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project does not exist: ${input.projectId}`,
        )
      }
      if (project.manifest.repositoryRevision !== input.expectedRepositoryRevision) {
        throw new ProjectRepositoryError(
          'PROJECT_REVISION_CONFLICT',
          `Expected repository revision ${input.expectedRepositoryRevision}, but repository has ${project.manifest.repositoryRevision}.`,
        )
      }
      const version = project.versions.get(input.revision)
      if (!version) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project version does not exist: ${input.projectId}@${input.revision}`,
        )
      }
      const label = assertVersionLabel(input.label)
      version.metadata = { ...version.metadata, ...(label ? { label } : {}) }
      if (!label)
        delete version.metadata.label
    })
  }

  async pruneVersions(
    projectId: string,
    policy: ProjectVersionRetentionPolicy = {},
  ): Promise<void> {
    await this.runProjectMutation(projectId, async () => {
      const project = this.projects.get(projectId)
      if (!project)
        return
      const keepLatest = policy.keepLatestAutosaves ?? 50
      const keepDailyForDays = policy.keepDailyForDays ?? 30
      if (!Number.isInteger(keepLatest) || keepLatest < 0
        || !Number.isInteger(keepDailyForDays) || keepDailyForDays < 0) {
        throw new RangeError('Project version retention limits must be non-negative integers.')
      }
      const now = Date.parse(policy.now ?? this.now())
      if (!Number.isFinite(now))
        throw new RangeError('Project version retention time must be a valid ISO date string.')

      const keep = new Set<number>([project.manifest.repositoryRevision])
      project.receipts.forEach(receipt => keep.add(receipt.project.repositoryRevision))
      project.versions.forEach((version) => {
        if (version.metadata.label)
          keep.add(version.metadata.repositoryRevision)
        if (version.metadata.restoredFromRevision !== undefined)
          keep.add(version.metadata.restoredFromRevision)
      })
      const ordinary = [...project.versions.values()]
        .filter(version => !version.metadata.label)
        .sort((left, right) => right.metadata.repositoryRevision - left.metadata.repositoryRevision)
      ordinary.slice(0, keepLatest).forEach(version => keep.add(version.metadata.repositoryRevision))
      const daily = new Set<string>()
      ordinary.forEach((version) => {
        const timestamp = Date.parse(version.metadata.createdAt)
        if (!Number.isFinite(timestamp) || now - timestamp > keepDailyForDays * 86_400_000)
          return
        const day = version.metadata.createdAt.slice(0, 10)
        if (!daily.has(day)) {
          daily.add(day)
          keep.add(version.metadata.repositoryRevision)
        }
      })
      project.versions.forEach((_version, revision) => {
        if (!keep.has(revision))
          project.versions.delete(revision)
      })
      const reachable = reachableByteKeys(project)
      project.embedded.forEach((_record, key) => {
        if (!reachable.has(key))
          project.embedded.delete(key)
      })
    })
  }

  private async runProjectMutation<T>(projectId: string, mutate: () => Promise<T>): Promise<T> {
    const previous = this.projectQueues.get(projectId) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    this.projectQueues.set(projectId, tail)
    await previous
    try {
      return await mutate()
    }
    finally {
      release()
      if (this.projectQueues.get(projectId) === tail)
        this.projectQueues.delete(projectId)
    }
  }

  close(): void {}
}

export function createMemoryProjectRepository(
  options?: MemoryProjectRepositoryOptions,
): MemoryProjectRepository {
  return new MemoryProjectRepository(options)
}
