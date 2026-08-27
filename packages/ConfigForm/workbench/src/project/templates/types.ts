import type { WorkspaceAdapter, WorkspaceProject } from '../types'

export interface WorkspaceTemplateInput {
  createdAt: string
  id: string
  name: string
}

export interface WorkspaceTemplate {
  adapter: WorkspaceAdapter
  create: (input: WorkspaceTemplateInput) => WorkspaceProject
  description: string
  id: string
  order: number
  title: string
  version: number
}
