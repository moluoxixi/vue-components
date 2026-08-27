import type { WorkspaceProject } from './types'
import { WorkspaceProjectError } from './errors'
import { parseWorkspaceProject } from './schema'

export function cloneWorkspaceProject(project: WorkspaceProject): WorkspaceProject {
  return structuredClone(project)
}

export function commitWorkspaceProject(
  current: WorkspaceProject,
  baseRevision: number,
  next: WorkspaceProject,
  updatedAt: string,
): WorkspaceProject {
  if (current.revision !== baseRevision) {
    throw new WorkspaceProjectError(
      'PROJECT_REVISION_CONFLICT',
      `[config-form-workbench] project "${current.id}" changed from revision ${baseRevision} to ${current.revision}`,
    )
  }
  if (next.id !== current.id)
    throw new WorkspaceProjectError('PROJECT_INVALID', '[config-form-workbench] a commit cannot change the project id')

  return parseWorkspaceProject({
    ...cloneWorkspaceProject(next),
    createdAt: current.createdAt,
    revision: current.revision + 1,
    updatedAt,
  })
}
