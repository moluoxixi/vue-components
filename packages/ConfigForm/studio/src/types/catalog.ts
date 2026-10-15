import type { ComponentContract, NodeSubgraph, ProjectSurface } from '@moluoxixi/config-form-model'
import type { SourceComponentResolution } from '@moluoxixi/config-form-source/generator'

export type StudioPresetId = 'element-plus' | 'antd-vue'
export interface StudioMaterial {
  contract: ComponentContract
  title: string
  category: string
  properties: unknown[]
  defaultSubgraph: NodeSubgraph
  resolution: SourceComponentResolution
}
export interface StudioTemplate {
  id: string
  name: string
  description: string
  preset: StudioPresetId
  tags: string[]
  surface: ProjectSurface
}
export interface StudioCatalog {
  version: 1
  preset: StudioPresetId
  materials: StudioMaterial[]
  templates: StudioTemplate[]
}
