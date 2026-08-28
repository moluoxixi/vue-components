import type { WorkspaceProject } from '../types'
import type { WorkspaceTemplateInput } from './types'
import { WorkspaceProjectError } from '../errors'
import { commitWorkspaceProject } from '../revision'
import {
  antdProfileTemplate,
  createWorkspaceTemplateRegistry,
  elementProfileTemplate,
} from './create-template'

export { createWorkspaceTemplateRegistry, formatWorkspaceAppComponent } from './create-template'
export type { WorkspaceTemplate, WorkspaceTemplateInput } from './types'

export const BUILT_IN_WORKSPACE_TEMPLATES = createWorkspaceTemplateRegistry([
  elementProfileTemplate,
  antdProfileTemplate,
])

export function createBuiltInWorkspaceProject(templateId: string, input: WorkspaceTemplateInput) {
  const template = BUILT_IN_WORKSPACE_TEMPLATES.get(templateId)
  if (!template)
    throw new WorkspaceProjectError('TEMPLATE_NOT_FOUND', `[config-form-workbench] template "${templateId}" does not exist`)
  return template.create(input)
}

export function resetBuiltInWorkspaceProject(project: WorkspaceProject, updatedAt: string) {
  const template = BUILT_IN_WORKSPACE_TEMPLATES.get(project.template.id)
  if (!template)
    throw new WorkspaceProjectError('TEMPLATE_NOT_FOUND', `[config-form-workbench] template "${project.template.id}" does not exist`)
  if (template.version !== project.template.version)
    throw new WorkspaceProjectError('TEMPLATE_INVALID', '[config-form-workbench] project template version cannot be reset without migration')

  const initial = template.create({
    createdAt: project.createdAt,
    id: project.id,
    name: project.name,
  })
  return commitWorkspaceProject(project, project.revision, initial, updatedAt)
}
