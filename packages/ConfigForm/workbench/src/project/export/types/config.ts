import type { ProjectPage, RegistryContractComponentSnapshot } from '@moluoxixi/config-form-model'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type {
  CanonicalSourceBindingResolver,
} from './bindings'

export interface CanonicalConfigExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}

export interface ConfigGenerationContext {
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>
  page: ProjectPage
  resolver: CanonicalSourceBindingResolver
}
