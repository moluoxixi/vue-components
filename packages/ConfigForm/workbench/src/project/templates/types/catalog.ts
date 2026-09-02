import type { ProjectTemplateAdapter, ProjectTemplateCategory } from './contracts'

export interface TemplateCatalogFilter {
  category?: ProjectTemplateCategory | 'all'
  providerId?: string | 'all'
  query?: string
}

export interface BuiltInSeedDefinition {
  adapter: ProjectTemplateAdapter
  category: ProjectTemplateCategory
  description: string
  displayName: string
  id: string
  order: number
  tags: string[]
}
