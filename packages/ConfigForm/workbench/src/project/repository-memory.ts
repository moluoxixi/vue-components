import type { WorkspaceProjectRepository, WorkspaceProjectRepositoryOptions } from './repository'
import type { WorkspaceProject, WorkspaceProjectDraft, WorkspaceProjectSummary } from './types'
import { WorkspaceProjectError } from './errors'
import { systemWorkspaceClock } from './repository'
import { cloneWorkspaceProject, commitWorkspaceProject } from './revision'
import { parseWorkspaceProject, parseWorkspaceProjectDraft, summarizeWorkspaceProject } from './schema'

export class MemoryWorkspaceProjectRepository implements WorkspaceProjectRepository {
  readonly persistence = 'volatile' as const
  private readonly drafts = new Map<string, WorkspaceProjectDraft>()
  private readonly now: () => string
  private readonly projects = new Map<string, WorkspaceProject>()

  constructor(options: WorkspaceProjectRepositoryOptions = {}) {
    this.now = options.now ?? systemWorkspaceClock
  }

  async get(id: string): Promise<WorkspaceProject | undefined> {
    const project = this.projects.get(id)
    return project ? cloneWorkspaceProject(project) : undefined
  }

  async list(): Promise<WorkspaceProjectSummary[]> {
    return [...this.projects.values()]
      .map(project => summarizeWorkspaceProject(project))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: WorkspaceProject): Promise<void> {
    const project = parseWorkspaceProject(input)
    if (this.projects.has(project.id))
      throw new WorkspaceProjectError('PROJECT_EXISTS', `[config-form-workbench] project "${project.id}" already exists`)
    this.projects.set(project.id, cloneWorkspaceProject(project))
  }

  async commit(id: string, baseRevision: number, input: WorkspaceProject): Promise<WorkspaceProject> {
    const current = this.projects.get(id)
    if (!current)
      throw new WorkspaceProjectError('PROJECT_NOT_FOUND', `[config-form-workbench] project "${id}" does not exist`)
    const committed = commitWorkspaceProject(current, baseRevision, parseWorkspaceProject(input), this.now())
    this.projects.set(id, cloneWorkspaceProject(committed))
    return cloneWorkspaceProject(committed)
  }

  async getDraft(id: string): Promise<WorkspaceProjectDraft | undefined> {
    const draft = this.drafts.get(id)
    return draft ? structuredClone(draft) : undefined
  }

  async saveDraft(id: string, input?: WorkspaceProjectDraft): Promise<void> {
    if (!this.projects.has(id))
      throw new WorkspaceProjectError('PROJECT_NOT_FOUND', `[config-form-workbench] project "${id}" does not exist`)
    if (!input) {
      this.drafts.delete(id)
      return
    }
    this.drafts.set(id, structuredClone(parseWorkspaceProjectDraft(input)))
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id)
    this.drafts.delete(id)
  }

  close(): void {}
}

export function createMemoryWorkspaceProjectRepository(
  options?: WorkspaceProjectRepositoryOptions,
): MemoryWorkspaceProjectRepository {
  return new MemoryWorkspaceProjectRepository(options)
}
