import type { ProjectSurface } from '@moluoxixi/config-form-model'

export type ProjectIdentityKind
  = | 'field'
    | 'node'
    | 'surface'
    | 'dataset'
    | 'resource'
    | 'project'
    | 'interaction'

export interface ProjectIdentityFactory {
  create: (kind: ProjectIdentityKind, source: string) => string
}

export interface ProjectSurfaceIdentityMap {
  fields: ReadonlyMap<string, string>
  nodes: ReadonlyMap<string, string>
  interactions: ReadonlyMap<string, string>
}

export interface RemappedProjectSurface {
  identityMap: ProjectSurfaceIdentityMap
  surface: ProjectSurface
}

export interface ProjectSurfaceReferenceMaps {
  datasets: ReadonlyMap<string, string>
  resources: ReadonlyMap<string, string>
  surfaces: ReadonlyMap<string, string>
}
