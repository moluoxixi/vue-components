import type { ProjectDocument, ProjectPage, RegistryLock } from '@moluoxixi/config-form-model'

export type ProjectTemplateAdapter = 'antd-vue' | 'element-plus'

export interface ProjectTemplateInput {
  id: string
  name: string
}

export interface ProjectPageTemplateInput extends ProjectTemplateInput {
  route: string
}

export interface ProjectTemplate {
  adapter: ProjectTemplateAdapter
  createPage: (input: ProjectPageTemplateInput) => ProjectPage
  createProject: (input: ProjectTemplateInput, registryLock: RegistryLock) => ProjectDocument
  description: string
  id: string
  order: number
  title: string
  version: number
}
