import type {
  MemoryProjectRepositoryOptions,
  PersistedProjectEnvelope,
  ProjectCommitMetadata,
  ProjectDocument,
  ProjectPage,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
  ProjectRepositoryCreateInput,
  ProjectRepositoryErrorCode,
  ProjectRepositorySeed,
  ProjectResourceReference,
  ProjectSummary,
  ProjectVersionLabelInput,
  ProjectVersionRetentionPolicy,
  ProjectVersionSummary,
  RegistryLock,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { assertProjectDocument } from '../schemas'

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
  version: ProjectDocument['version']
  id: string
  name: string
  repositoryRevision: number
  createdAt: string
  updatedAt: string
  homePageId: string
  pageOrder: string[]
  registryLock: RegistryLock
  settings: ProjectDocument['settings']
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
  pages: Map<string, StoredEntity<ProjectPage>>
  resources: Map<string, StoredEntity<ProjectResourceReference>>
  receipts: Map<string, CommitReceipt>
  versions: Map<number, StoredProjectVersion>
}

function checksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function splitProject(
  project: PersistedProjectEnvelope,
  receipts = new Map<string, CommitReceipt>(),
  current?: StoredProject,
  versions = current?.versions ?? new Map<number, StoredProjectVersion>(),
): StoredProject {
  const parsed = assertProjectDocument(project.document)
  const pages = new Map<string, StoredEntity<ProjectPage>>()
  const resources = new Map<string, StoredEntity<ProjectResourceReference>>()
  Object.entries(parsed.pagesById).forEach(([id, page]) => {
    const pageChecksum = checksum(page)
    const previous = current?.pages.get(id)
    pages.set(id, previous?.checksum === pageChecksum
      ? previous
      : { checksum: pageChecksum, revision: project.repositoryRevision, value: page })
  })
  Object.entries(parsed.resources).forEach(([id, resource]) => {
    const resourceChecksum = checksum(resource)
    const previous = current?.resources.get(id)
    resources.set(id, previous?.checksum === resourceChecksum
      ? previous
      : { checksum: resourceChecksum, revision: project.repositoryRevision, value: resource })
  })
  return {
    manifest: {
      version: parsed.version,
      id: parsed.id,
      name: parsed.name,
      repositoryRevision: project.repositoryRevision,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      homePageId: parsed.homePageId,
      pageOrder: parsed.pageOrder,
      registryLock: parsed.registryLock,
      settings: parsed.settings,
    },
    pages,
    resources,
    receipts,
    versions,
  }
}

function assembleProject(stored: StoredProject): PersistedProjectEnvelope {
  const pagesById: ProjectDocument['pagesById'] = Object.create(null)
  const resources: ProjectDocument['resources'] = Object.create(null)
  const pageRevisions: Record<string, number> = Object.create(null)
  const resourceRevisions: Record<string, number> = Object.create(null)
  stored.pages.forEach((entity, id) => {
    if (entity.checksum !== checksum(entity.value))
      corrupt(`Page entity checksum mismatch: ${id}`)
    pagesById[id] = entity.value
    pageRevisions[id] = entity.revision
  })
  stored.resources.forEach((entity, id) => {
    if (entity.checksum !== checksum(entity.value))
      corrupt(`Resource entity checksum mismatch: ${id}`)
    resources[id] = entity.value
    resourceRevisions[id] = entity.revision
  })
  try {
    return {
      document: assertProjectDocument({
        version: stored.manifest.version,
        id: stored.manifest.id,
        name: stored.manifest.name,
        homePageId: stored.manifest.homePageId,
        pageOrder: stored.manifest.pageOrder,
        registryLock: stored.manifest.registryLock,
        settings: stored.manifest.settings,
        pagesById,
        resources,
      }),
      repositoryRevision: stored.manifest.repositoryRevision,
      entityRevisions: {
        manifest: stored.manifest.repositoryRevision,
        pages: pageRevisions,
        resources: resourceRevisions,
      },
      createdAt: stored.manifest.createdAt,
      updatedAt: stored.manifest.updatedAt,
    }
  }
  catch (error) {
    corrupt(error instanceof Error ? error.message : String(error))
  }
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

export function assertProjectRepositorySeed(seed: ProjectRepositorySeed): ProjectRepositorySeed {
  if (!Number.isInteger(seed.repositoryRevision) || seed.repositoryRevision < 0) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Initial repository revision must be a non-negative integer.',
    )
  }
  if (!Number.isFinite(Date.parse(seed.createdAt)) || !Number.isFinite(Date.parse(seed.updatedAt))) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Repository timestamps must be valid ISO date strings.',
    )
  }
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
  if (!normalized || normalized.length > 80 || containsControlCharacter) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Version labels must contain 1 to 80 characters and cannot contain control characters.',
    )
  }
  return normalized
}

export function assertProjectCommitMetadata(metadata: ProjectCommitMetadata): ProjectCommitMetadata {
  if (!metadata || !['autosave', 'create', 'manual', 'restore'].includes(metadata.source)) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Repository commits require a valid commit source.',
    )
  }
  const label = assertVersionLabel(metadata.label)
  const restoredFromRevision = metadata.restoredFromRevision
  if (restoredFromRevision !== undefined
    && (!Number.isInteger(restoredFromRevision) || restoredFromRevision < 0)) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Restored revision must be a non-negative integer.',
    )
  }
  if (metadata.source === 'restore' && restoredFromRevision === undefined) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Restore commits require the source revision.',
    )
  }
  if (metadata.source !== 'restore' && restoredFromRevision !== undefined) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_INVALID_COMMIT',
      'Only restore commits may reference a restored revision.',
    )
  }
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
    ...('label' in metadata && metadata.label ? { label: metadata.label } : {}),
    contentHash: checksum(project.document),
    createdAt: project.updatedAt,
    ...('restoredFromRevision' in metadata && metadata.restoredFromRevision !== undefined
      ? { restoredFromRevision: metadata.restoredFromRevision }
      : {}),
  }
}

function cloneVersionSummary(version: ProjectVersionSummary): ProjectVersionSummary {
  return structuredClone(version)
}

export function getProjectRepositoryCommitChecksum(input: ProjectRepositoryCommitInput): string {
  return checksum({
    document: input.document,
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
    homePageId: project.document.homePageId,
    pageCount: project.document.pageOrder.length,
    registryLock: structuredClone(project.document.registryLock),
    updatedAt: project.updatedAt,
  }
}

export class MemoryProjectRepository implements ProjectRepository {
  readonly persistence = 'volatile' as const
  private readonly projects = new Map<string, StoredProject>()
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
    return stored ? assembleProject(stored) : undefined
  }

  async list(): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .map(stored => summarizePersistedProject(assembleProject(stored)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: ProjectRepositoryCreateInput): Promise<PersistedProjectEnvelope> {
    const document = assertProjectDocument(input.document)
    if (this.projects.has(document.id)) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_EXISTS',
        `Project already exists: ${document.id}`,
      )
    }
    const timestamp = this.now()
    const seed = assertProjectRepositorySeed(input.seed ?? {
      repositoryRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const stored = splitProject({
      document,
      repositoryRevision: seed.repositoryRevision,
      entityRevisions: { manifest: seed.repositoryRevision, pages: {}, resources: {} },
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    })
    const project = assembleProject(stored)
    stored.versions.set(project.repositoryRevision, {
      metadata: createVersionSummary(project, { source: 'create' }),
      project: clonePersistedProject(project),
    })
    this.projects.set(document.id, stored)
    return project
  }

  async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
    const commandId = input.commandId.trim()
    if (!commandId) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_INVALID_COMMIT',
        'Repository commits require a non-empty command id.',
      )
    }
    const current = this.projects.get(input.id)
    if (!current) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_NOT_FOUND',
        `Project does not exist: ${input.id}`,
      )
    }

    const payloadChecksum = getProjectRepositoryCommitChecksum(input)
    const receipt = current.receipts.get(commandId)
    if (receipt) {
      if (receipt.payloadChecksum !== payloadChecksum) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_COMMAND_REUSED',
          `Commit command id was reused with a different payload: ${commandId}`,
        )
      }
      return { project: clonePersistedProject(receipt.project), replayed: true }
    }

    const currentProject = assembleProject(current)
    if (currentProject.repositoryRevision !== input.expectedRepositoryRevision) {
      throw new ProjectRepositoryError(
        'PROJECT_REVISION_CONFLICT',
        `Expected repository revision ${input.expectedRepositoryRevision}, but repository has ${currentProject.repositoryRevision}.`,
      )
    }
    const document = assertProjectDocument(input.document)
    const metadata = assertProjectCommitMetadata(input.metadata)
    if (document.id !== input.id || document.id !== currentProject.document.id) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_INVALID_COMMIT',
        'Repository commits cannot change project identity.',
      )
    }

    const project: PersistedProjectEnvelope = {
      document,
      repositoryRevision: currentProject.repositoryRevision + 1,
      entityRevisions: currentProject.entityRevisions,
      createdAt: currentProject.createdAt,
      updatedAt: this.now(),
    }
    const receipts = new Map(current.receipts)
    receipts.set(commandId, {
      commandId,
      project: clonePersistedProject(project),
      expectedRepositoryRevision: input.expectedRepositoryRevision,
      payloadChecksum,
    })
    while (receipts.size > this.receiptLimit)
      receipts.delete(receipts.keys().next().value!)

    const versions = new Map(current.versions)
    versions.set(project.repositoryRevision, {
      metadata: createVersionSummary(project, metadata),
      project: clonePersistedProject(project),
    })
    const staged = splitProject(project, receipts, current, versions)
    const committedProject = assembleProject(staged)
    staged.receipts.set(commandId, {
      commandId,
      project: clonePersistedProject(committedProject),
      expectedRepositoryRevision: input.expectedRepositoryRevision,
      payloadChecksum,
    })
    this.projects.set(input.id, staged)
    return { project: committedProject, replayed: false }
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id)
  }

  async getVersion(projectId: string, revision: number): Promise<PersistedProjectEnvelope | undefined> {
    const version = this.projects.get(projectId)?.versions.get(revision)
    return version ? clonePersistedProject(version.project) : undefined
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
    version.metadata = {
      ...version.metadata,
      ...(label ? { label } : {}),
    }
    if (!label)
      delete version.metadata.label
  }

  async pruneVersions(
    projectId: string,
    policy: ProjectVersionRetentionPolicy = {},
  ): Promise<void> {
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
  }

  close(): void {}
}

export function createMemoryProjectRepository(
  options?: MemoryProjectRepositoryOptions,
): MemoryProjectRepository {
  return new MemoryProjectRepository(options)
}
