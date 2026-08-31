import type { RegistryLock } from '@moluoxixi/config-form-model'
import type { ProjectPageTemplateInput, ProjectTemplateInput } from './types'
import { WorkbenchProjectError } from '../errors'
import {
  antdProfileTemplate,
  createProjectTemplateRegistry,
  elementProfileTemplate,
} from './create-template'

export { createProjectTemplateRegistry } from './create-template'
export type {
  ProjectPageTemplateInput,
  ProjectTemplate,
  ProjectTemplateAdapter,
  ProjectTemplateInput,
} from './types'

export const BUILT_IN_PROJECT_TEMPLATES = createProjectTemplateRegistry([
  elementProfileTemplate,
  antdProfileTemplate,
])

function requireTemplate(templateId: string) {
  const template = BUILT_IN_PROJECT_TEMPLATES.get(templateId)
  if (!template)
    throw new WorkbenchProjectError('TEMPLATE_NOT_FOUND', `[config-form-workbench] template "${templateId}" does not exist`)
  return template
}

export function createBuiltInProject(
  templateId: string,
  input: ProjectTemplateInput,
  registryLock: RegistryLock,
) {
  return requireTemplate(templateId).createProject(input, registryLock)
}

export function createBuiltInProjectPage(templateId: string, input: ProjectPageTemplateInput) {
  return requireTemplate(templateId).createPage(input)
}
