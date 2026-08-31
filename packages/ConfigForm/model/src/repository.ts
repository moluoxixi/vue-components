import type {
  ProjectDocument,
  ProjectPage,
  ProjectResourceReference,
  RegistryLock,
} from './types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { assertProjectDocument } from './schema'

export type ProjectRepositoryPersistence = 'durable' | 'volatile'

export type ProjectRepositoryErrorCode
  = | 'PROJECT_REPOSITORY_COMMAND_REUSED'
    | 'PROJECT_REPOSITORY_CORRUPT'
    | 'PROJECT_REPOSITORY_EXISTS'
    | 'PROJECT_REPOSITORY_INVALID_COMMIT'
    | 'PROJECT_REPOSITORY_NOT_FOUND'
    | 'PROJECT_REVISION_CONFLICT'

export class ProjectRepositoryError extends Error {
  readonly code: ProjectRepositoryErrorCode

  constructor(code: ProjectRepositoryErrorCode, message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ProjectRepositoryError'
    this.code = code
  }
}

export interface ProjectEntityRevisions {
  manifest: number
  pages: Record<string, number>
  resources: Record<string, number>
}

export interface PersistedProjectEnvelope {
  document: ProjectDocument
  repositoryRevision: number
  entityRevisions: ProjectEntityRevisions
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  repositoryRevision: number
  homePageId: string
  pageCount: number
  registryLock: RegistryLock
  updatedAt: string
}

export interface ProjectRepositorySeed {
  repositoryRevision: number
  createdAt: string
  updatedAt: string
}

export interface ProjectRepositoryCreateInput {
  document: ProjectDocument
  seed?: ProjectRepositorySeed
}

export interface ProjectRepositoryCommitInput {
  commandId: string
  document: ProjectDocument
  expectedRepositoryRevision: number
  id: string
}

export interface ProjectRepositoryCommitResult {
  project: PersistedProjectEnvelope
  replayed: boolean
}

export interface ProjectRepository {
  readonly persistence: ProjectRepositoryPersistence
  close: () => void
  commit: (input: ProjectRepositoryCommitInput) => Promise<ProjectRepositoryCommitResult>
  create: (input: ProjectRepositoryCreateInput) => Promise<PersistedProjectEnvelope>
  delete: (id: string) => Promise<void>
  get: (id: string) => Promise<PersistedProjectEnvelope | undefined>
  list: () => Promise<ProjectSummary[]>
}

interface StoredEntity<T> {
  checksum: string
  revision: number
  value: T
}

interface StoredProjectManifest {
  schemaVersion: ProjectDocument['schemaVersion']
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

interface StoredProject {
  manifest: StoredProjectManifest
  pages: Map<string, StoredEntity<ProjectPage>>
  resources: Map<string, StoredEntity<ProjectResourceReference>>
  receipts: Map<string, CommitReceipt>
}

export interface MemoryProjectRepositoryOptions {
  now?: () => string
  receiptLimit?: number
}

function checksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function splitProject(
  project: PersistedProjectEnvelope,
  receipts = new Map<string, CommitReceipt>(),
  current?: StoredProject,
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
      schemaVersion: parsed.schemaVersion,
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
        schemaVersion: stored.manifest.schemaVersion,
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

export function getProjectRepositoryCommitChecksum(input: ProjectRepositoryCommitInput): string {
  return checksum({
    document: input.document,
    expectedRepositoryRevision: input.expectedRepositoryRevision,
    id: input.id,
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
    this.projects.set(document.id, stored)
    return assembleProject(stored)
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

    const staged = splitProject(project, receipts, current)
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

  close(): void {}
}

export function createMemoryProjectRepository(
  options?: MemoryProjectRepositoryOptions,
): MemoryProjectRepository {
  return new MemoryProjectRepository(options)
}
