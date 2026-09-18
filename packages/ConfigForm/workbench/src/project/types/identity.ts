import type { ProjectPage } from '@moluoxixi/config-form-model'

export type ProjectIdentityKind
  = | 'field'
    | 'node'
    | 'page'
    | 'project'
    | 'reaction'

export interface ProjectIdentityFactory {
  create: (kind: ProjectIdentityKind, source: string) => string
}

export interface ProjectPageIdentityMap {
  fields: ReadonlyMap<string, string>
  nodes: ReadonlyMap<string, string>
  reactions: ReadonlyMap<string, string>
}

export interface RemappedProjectPage {
  identityMap: ProjectPageIdentityMap
  page: ProjectPage
}
