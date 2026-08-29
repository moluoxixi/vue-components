import type {
  WorkspaceApplication,
  WorkspaceApplicationDraft,
  WorkspaceApplicationSummary,
} from './application'
import {
  cloneWorkspaceApplication,
  commitWorkspaceApplication,
  parseWorkspaceApplication,
  parseWorkspaceApplicationDraft,
  summarizeWorkspaceApplication,
} from './application'
import { WorkspaceProjectError } from './errors'

export interface WorkspaceApplicationRepository {
  readonly migrationErrors: readonly string[]
  readonly persistence: 'durable' | 'volatile'
  close: () => void
  commit: (id: string, baseRevision: number, next: WorkspaceApplication) => Promise<WorkspaceApplication>
  create: (application: WorkspaceApplication) => Promise<void>
  delete: (id: string) => Promise<void>
  get: (id: string) => Promise<WorkspaceApplication | undefined>
  getDraft: (id: string) => Promise<WorkspaceApplicationDraft | undefined>
  list: () => Promise<WorkspaceApplicationSummary[]>
  saveDraft: (id: string, draft?: WorkspaceApplicationDraft) => Promise<void>
}

export interface WorkspaceApplicationRepositoryOptions {
  now?: () => string
}

export const systemWorkspaceApplicationClock = (): string => new Date().toISOString()

export class MemoryWorkspaceApplicationRepository implements WorkspaceApplicationRepository {
  readonly migrationErrors: readonly string[] = Object.freeze([])
  readonly persistence = 'volatile' as const
  private readonly applications = new Map<string, WorkspaceApplication>()
  private readonly drafts = new Map<string, WorkspaceApplicationDraft>()
  private readonly now: () => string

  constructor(options: WorkspaceApplicationRepositoryOptions = {}) {
    this.now = options.now ?? systemWorkspaceApplicationClock
  }

  async get(id: string): Promise<WorkspaceApplication | undefined> {
    const application = this.applications.get(id)
    return application ? cloneWorkspaceApplication(application) : undefined
  }

  async list(): Promise<WorkspaceApplicationSummary[]> {
    return [...this.applications.values()]
      .map(application => summarizeWorkspaceApplication(application))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: WorkspaceApplication): Promise<void> {
    const application = parseWorkspaceApplication(input)
    if (this.applications.has(application.id)) {
      throw new WorkspaceProjectError(
        'PROJECT_EXISTS',
        `[config-form-workbench] application "${application.id}" already exists`,
      )
    }
    this.applications.set(application.id, cloneWorkspaceApplication(application))
  }

  async commit(
    id: string,
    baseRevision: number,
    input: WorkspaceApplication,
  ): Promise<WorkspaceApplication> {
    const current = this.applications.get(id)
    if (!current) {
      throw new WorkspaceProjectError(
        'PROJECT_NOT_FOUND',
        `[config-form-workbench] application "${id}" does not exist`,
      )
    }
    const committed = commitWorkspaceApplication(
      current,
      baseRevision,
      parseWorkspaceApplication(input),
      this.now(),
    )
    this.applications.set(id, cloneWorkspaceApplication(committed))
    return cloneWorkspaceApplication(committed)
  }

  async getDraft(id: string): Promise<WorkspaceApplicationDraft | undefined> {
    const draft = this.drafts.get(id)
    return draft ? structuredClone(draft) : undefined
  }

  async saveDraft(id: string, input?: WorkspaceApplicationDraft): Promise<void> {
    if (!this.applications.has(id)) {
      throw new WorkspaceProjectError(
        'PROJECT_NOT_FOUND',
        `[config-form-workbench] application "${id}" does not exist`,
      )
    }
    if (!input) {
      this.drafts.delete(id)
      return
    }
    const draft = parseWorkspaceApplicationDraft(input)
    if (draft.application.id !== id)
      throw new WorkspaceProjectError('PROJECT_INVALID', '[config-form-workbench] draft application id does not match')
    this.drafts.set(id, structuredClone(draft))
  }

  async delete(id: string): Promise<void> {
    this.applications.delete(id)
    this.drafts.delete(id)
  }

  close(): void {}
}

export function createMemoryWorkspaceApplicationRepository(
  options?: WorkspaceApplicationRepositoryOptions,
): MemoryWorkspaceApplicationRepository {
  return new MemoryWorkspaceApplicationRepository(options)
}
