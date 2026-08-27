import type { WorkspaceProjectRepository, WorkspaceProjectRepositoryOptions } from './repository'
import type {
  StoredWorkspaceProject,
  WorkspaceProject,
  WorkspaceProjectDraft,
  WorkspaceProjectSummary,
} from './types'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'
import { WorkspaceProjectError } from './errors'
import { systemWorkspaceClock } from './repository'
import { createMemoryWorkspaceProjectRepository } from './repository-memory'
import { cloneWorkspaceProject, commitWorkspaceProject } from './revision'
import { parseWorkspaceProject, parseWorkspaceProjectDraft, summarizeWorkspaceProject } from './schema'
import { migrateStoredWorkspaceProject } from './storage-migration'
import { WORKSPACE_STORAGE_SCHEMA_VERSION } from './types'

const PROJECT_PREFIX = 'project:'

export interface IndexedDBWorkspaceProjectRepositoryOptions extends WorkspaceProjectRepositoryOptions {
  dbName?: string
  storeName?: string
}

function projectKey(id: string): string {
  return `${PROJECT_PREFIX}${id}`
}

function storedProject(project: WorkspaceProject, draft?: WorkspaceProjectDraft): StoredWorkspaceProject {
  return {
    ...(draft ? { draft: structuredClone(draft) } : {}),
    project: cloneWorkspaceProject(project),
    storageSchemaVersion: WORKSPACE_STORAGE_SCHEMA_VERSION,
  }
}

export class IndexedDBWorkspaceProjectRepository implements WorkspaceProjectRepository {
  readonly persistence = 'durable' as const
  private readonly now: () => string
  private readonly storage: IndexDBStorage

  constructor(options: IndexedDBWorkspaceProjectRepositoryOptions = {}) {
    this.now = options.now ?? systemWorkspaceClock
    this.storage = new IndexDBStorage({
      dbName: options.dbName ?? 'moluoxixi-config-form-workbench',
      storeName: options.storeName ?? 'workspace-projects',
    })
  }

  async open(): Promise<void> {
    await this.storage.length()
  }

  async get(id: string): Promise<WorkspaceProject | undefined> {
    const envelope = await this.storage.getItem(projectKey(id))
    return envelope === null ? undefined : cloneWorkspaceProject(migrateStoredWorkspaceProject(envelope).project)
  }

  async list(): Promise<WorkspaceProjectSummary[]> {
    const keys = (await this.storage.keys()).filter(key => key.startsWith(PROJECT_PREFIX))
    const envelopes = await this.storage.getItems<StoredWorkspaceProject>(keys)
    return keys
      .flatMap((key) => {
        const envelope = envelopes[key]
        return envelope === null ? [] : [summarizeWorkspaceProject(migrateStoredWorkspaceProject(envelope).project)]
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: WorkspaceProject): Promise<void> {
    const project = parseWorkspaceProject(input)
    await this.storage.updateItem<StoredWorkspaceProject>(projectKey(project.id), (current) => {
      if (current !== null)
        throw new WorkspaceProjectError('PROJECT_EXISTS', `[config-form-workbench] project "${project.id}" already exists`)
      return storedProject(project)
    })
  }

  async commit(id: string, baseRevision: number, input: WorkspaceProject): Promise<WorkspaceProject> {
    const next = parseWorkspaceProject(input)
    let committed: WorkspaceProject | undefined
    await this.storage.updateItem<StoredWorkspaceProject>(projectKey(id), (current) => {
      if (current === null)
        throw new WorkspaceProjectError('PROJECT_NOT_FOUND', `[config-form-workbench] project "${id}" does not exist`)
      const envelope = migrateStoredWorkspaceProject(current)
      committed = commitWorkspaceProject(envelope.project, baseRevision, next, this.now())
      return storedProject(committed, envelope.draft)
    })
    return cloneWorkspaceProject(committed!)
  }

  async getDraft(id: string): Promise<WorkspaceProjectDraft | undefined> {
    const envelope = await this.storage.getItem(projectKey(id))
    return envelope === null
      ? undefined
      : structuredClone(migrateStoredWorkspaceProject(envelope).draft)
  }

  async saveDraft(id: string, input?: WorkspaceProjectDraft): Promise<void> {
    const draft = input ? parseWorkspaceProjectDraft(input) : undefined
    await this.storage.updateItem<StoredWorkspaceProject>(projectKey(id), (current) => {
      if (current === null)
        throw new WorkspaceProjectError('PROJECT_NOT_FOUND', `[config-form-workbench] project "${id}" does not exist`)
      const envelope = migrateStoredWorkspaceProject(current)
      return storedProject(envelope.project, draft)
    })
  }

  async delete(id: string): Promise<void> {
    await this.storage.removeItem(projectKey(id))
  }

  close(): void {
    this.storage.close()
  }
}

export function createIndexedDBWorkspaceProjectRepository(
  options?: IndexedDBWorkspaceProjectRepositoryOptions,
): IndexedDBWorkspaceProjectRepository {
  return new IndexedDBWorkspaceProjectRepository(options)
}

export async function openDefaultWorkspaceProjectRepository(
  options?: IndexedDBWorkspaceProjectRepositoryOptions,
): Promise<WorkspaceProjectRepository> {
  if (!IndexedDBManager.isSupported())
    return createMemoryWorkspaceProjectRepository(options)

  const repository = createIndexedDBWorkspaceProjectRepository(options)
  try {
    await repository.open()
    return repository
  }
  catch {
    repository.close()
    return createMemoryWorkspaceProjectRepository(options)
  }
}
