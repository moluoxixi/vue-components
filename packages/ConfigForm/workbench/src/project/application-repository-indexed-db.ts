import type {
  StoredWorkspaceApplication,
  WorkspaceApplication,
  WorkspaceApplicationDraft,
  WorkspaceApplicationSummary,
} from './application'
import type {
  WorkspaceApplicationRepository,
  WorkspaceApplicationRepositoryOptions,
} from './application-repository'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'
import {
  cloneWorkspaceApplication,
  commitWorkspaceApplication,
  migrateWorkspaceProjectDraft,
  migrateWorkspaceProjectToApplication,
  parseWorkspaceApplication,
  parseWorkspaceApplicationDraft,
  summarizeWorkspaceApplication,
  WORKSPACE_APPLICATION_STORAGE_VERSION,
} from './application'
import {
  createMemoryWorkspaceApplicationRepository,
  systemWorkspaceApplicationClock,
} from './application-repository'
import { WorkspaceProjectError } from './errors'
import { migrateStoredWorkspaceProject } from './storage-migration'

const APPLICATION_PREFIX = 'application:'
const LEGACY_PROJECT_PREFIX = 'project:'

export interface IndexedDBWorkspaceApplicationRepositoryOptions extends WorkspaceApplicationRepositoryOptions {
  dbName?: string
  storeName?: string
}

function applicationKey(id: string): string {
  return `${APPLICATION_PREFIX}${id}`
}

function storedApplication(
  application: WorkspaceApplication,
  draft?: WorkspaceApplicationDraft,
): StoredWorkspaceApplication {
  return {
    application: cloneWorkspaceApplication(application),
    ...(draft ? { draft: structuredClone(draft) } : {}),
    storageSchemaVersion: WORKSPACE_APPLICATION_STORAGE_VERSION,
  }
}

function parseStoredApplication(input: unknown): StoredWorkspaceApplication {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new WorkspaceProjectError('PROJECT_INVALID', '[config-form-workbench] stored application envelope is invalid')
  const record = input as Record<string, unknown>
  if (record.storageSchemaVersion !== WORKSPACE_APPLICATION_STORAGE_VERSION) {
    throw new WorkspaceProjectError(
      'PROJECT_INVALID',
      '[config-form-workbench] stored application schema is unsupported',
    )
  }
  return {
    application: parseWorkspaceApplication(record.application),
    ...(record.draft === undefined ? {} : { draft: parseWorkspaceApplicationDraft(record.draft) }),
    storageSchemaVersion: WORKSPACE_APPLICATION_STORAGE_VERSION,
  }
}

export class IndexedDBWorkspaceApplicationRepository implements WorkspaceApplicationRepository {
  readonly persistence = 'durable' as const
  private readonly errors: string[] = []
  private readonly now: () => string
  private readonly storage: IndexDBStorage

  constructor(options: IndexedDBWorkspaceApplicationRepositoryOptions = {}) {
    this.now = options.now ?? systemWorkspaceApplicationClock
    this.storage = new IndexDBStorage({
      dbName: options.dbName ?? 'moluoxixi-config-form-workbench',
      storeName: options.storeName ?? 'workspace-projects',
    })
  }

  get migrationErrors(): readonly string[] {
    return [...this.errors]
  }

  async open(): Promise<void> {
    await this.storage.length()
    await this.migrateLegacyProjects()
  }

  private async migrateLegacyProjects(): Promise<void> {
    const keys = (await this.storage.keys()).filter(key => key.startsWith(LEGACY_PROJECT_PREFIX))
    for (const key of keys) {
      try {
        const legacyInput = await this.storage.getItem(key)
        if (legacyInput === null)
          continue
        const legacy = migrateStoredWorkspaceProject(legacyInput)
        const application = migrateWorkspaceProjectToApplication(legacy.project)
        const draft = legacy.draft
          ? migrateWorkspaceProjectDraft(legacy.project, legacy.draft)
          : undefined
        await this.storage.updateItem<StoredWorkspaceApplication>(applicationKey(application.id), (current) => {
          if (current !== null)
            return parseStoredApplication(current)
          return storedApplication(application, draft)
        })
        await this.storage.removeItem(key)
      }
      catch (error) {
        this.errors.push(error instanceof Error ? error.message : String(error))
      }
    }
  }

  async get(id: string): Promise<WorkspaceApplication | undefined> {
    const envelope = await this.storage.getItem(applicationKey(id))
    return envelope === null
      ? undefined
      : cloneWorkspaceApplication(parseStoredApplication(envelope).application)
  }

  async list(): Promise<WorkspaceApplicationSummary[]> {
    const keys = (await this.storage.keys()).filter(key => key.startsWith(APPLICATION_PREFIX))
    const envelopes = await this.storage.getItems<StoredWorkspaceApplication>(keys)
    return keys
      .flatMap((key) => {
        const envelope = envelopes[key]
        return envelope === null
          ? []
          : [summarizeWorkspaceApplication(parseStoredApplication(envelope).application)]
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: WorkspaceApplication): Promise<void> {
    const application = parseWorkspaceApplication(input)
    await this.storage.updateItem<StoredWorkspaceApplication>(applicationKey(application.id), (current) => {
      if (current !== null) {
        throw new WorkspaceProjectError(
          'PROJECT_EXISTS',
          `[config-form-workbench] application "${application.id}" already exists`,
        )
      }
      return storedApplication(application)
    })
  }

  async commit(
    id: string,
    baseRevision: number,
    input: WorkspaceApplication,
  ): Promise<WorkspaceApplication> {
    const next = parseWorkspaceApplication(input)
    let committed: WorkspaceApplication | undefined
    await this.storage.updateItem<StoredWorkspaceApplication>(applicationKey(id), (current) => {
      if (current === null) {
        throw new WorkspaceProjectError(
          'PROJECT_NOT_FOUND',
          `[config-form-workbench] application "${id}" does not exist`,
        )
      }
      const envelope = parseStoredApplication(current)
      committed = commitWorkspaceApplication(envelope.application, baseRevision, next, this.now())
      return storedApplication(committed, envelope.draft)
    })
    return cloneWorkspaceApplication(committed!)
  }

  async getDraft(id: string): Promise<WorkspaceApplicationDraft | undefined> {
    const envelope = await this.storage.getItem(applicationKey(id))
    return envelope === null
      ? undefined
      : structuredClone(parseStoredApplication(envelope).draft)
  }

  async saveDraft(id: string, input?: WorkspaceApplicationDraft): Promise<void> {
    const draft = input ? parseWorkspaceApplicationDraft(input) : undefined
    if (draft && draft.application.id !== id)
      throw new WorkspaceProjectError('PROJECT_INVALID', '[config-form-workbench] draft application id does not match')
    await this.storage.updateItem<StoredWorkspaceApplication>(applicationKey(id), (current) => {
      if (current === null) {
        throw new WorkspaceProjectError(
          'PROJECT_NOT_FOUND',
          `[config-form-workbench] application "${id}" does not exist`,
        )
      }
      const envelope = parseStoredApplication(current)
      return storedApplication(envelope.application, draft)
    })
  }

  async delete(id: string): Promise<void> {
    await this.storage.removeItem(applicationKey(id))
  }

  close(): void {
    this.storage.close()
  }
}

export function createIndexedDBWorkspaceApplicationRepository(
  options?: IndexedDBWorkspaceApplicationRepositoryOptions,
): IndexedDBWorkspaceApplicationRepository {
  return new IndexedDBWorkspaceApplicationRepository(options)
}

export async function openDefaultWorkspaceApplicationRepository(
  options?: IndexedDBWorkspaceApplicationRepositoryOptions,
): Promise<WorkspaceApplicationRepository> {
  if (!IndexedDBManager.isSupported())
    return createMemoryWorkspaceApplicationRepository(options)

  const repository = createIndexedDBWorkspaceApplicationRepository(options)
  try {
    await repository.open()
    return repository
  }
  catch {
    repository.close()
    return createMemoryWorkspaceApplicationRepository(options)
  }
}
