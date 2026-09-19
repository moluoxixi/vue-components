import type { CanonicalFieldDescriptor } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  DatasetReference,
  FieldNode,
  FormSettings,
  ModelJsonObject,
  ProjectDialogSurface,
  ProjectDrawerSurface,
  StaticResourceReference,
  ValidateTrigger,
} from '@moluoxixi/config-form-model'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type {
  CanonicalSourceComponentBinding,
} from './bindings'

export interface PackageJson {
  [key: string]: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export interface StandaloneSourceNodeBase {
  id: string
  component: string
  props: ModelJsonObject
  extensions?: ModelJsonObject
  datasetBindings?: Record<string, DatasetReference>
  resourceBindings?: Record<string, StaticResourceReference>
  placement: ModelJsonObject
}

export interface StandaloneSourceFieldNode extends StandaloneSourceNodeBase, CanonicalFieldDescriptor {
  kind: 'field'
}

export interface StandaloneSourceLayoutNode extends StandaloneSourceNodeBase {
  kind: 'layout'
  slots: Record<string, StandaloneSourceNode[]>
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

export interface StandaloneSourceElementNode extends StandaloneSourceNodeBase {
  kind: 'element'
}

export type StandaloneSourceNode = StandaloneSourceFieldNode | StandaloneSourceLayoutNode | StandaloneSourceElementNode

interface StandaloneSourceSurfaceBase {
  id: string
  name: string
  kind: 'page' | 'dialog' | 'drawer'
  form: FormSettings
  root: StandaloneSourceNode[]
  scopedFields: ConfigFormScopedFieldDefinition[]
  valueScopes: ConfigFormValueScopeDefinition[]
}

export type StandaloneSourceSurface
  = | StandaloneSourceSurfaceBase & { kind: 'page', route: string }
    | StandaloneSourceSurfaceBase & { kind: 'dialog', presentation: ProjectDialogSurface['presentation'] }
    | StandaloneSourceSurfaceBase & { kind: 'drawer', presentation: ProjectDrawerSurface['presentation'] }

export interface StandaloneSourceComponentDefinition {
  binding: CanonicalSourceComponentBinding
  bindings: ReadonlyArray<{ name: string, valueProp: string, trigger: string }>
}

export interface StandaloneSourceRegistry {
  get: (component: string) => StandaloneSourceComponentDefinition | undefined
}

export interface StandaloneSourceProject {
  id: string
  name: string
  homeSurfaceId: string
  surfaces: StandaloneSourceSurface[]
}

export interface StandaloneSourceResolvedLayout {
  columns: number
  fieldSpan: number
  labelWidth?: number
}

export interface StandaloneSourceResolvedLayouts {
  desktop: StandaloneSourceResolvedLayout
  tablet: StandaloneSourceResolvedLayout
  mobile: StandaloneSourceResolvedLayout
}

export interface StandaloneSourceFieldValidation {
  validation?: NonNullable<FieldNode['validation']>
  validateOn: ValidateTrigger[]
}

export interface CanonicalProjectSourceExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}
