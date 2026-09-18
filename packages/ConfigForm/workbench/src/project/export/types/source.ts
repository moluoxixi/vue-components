import type { CanonicalFieldDescriptor } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormPageRuntimeConfiguration,
  ConfigFormReaction,
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  ConditionExpression,
  ConditionTarget,
  FieldNode,
  FormSettings,
  ModelJsonObject,
  RegisteredBinding,
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
  bindings: Record<string, RegisteredBinding>
  placement: ModelJsonObject
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

export interface StandaloneSourceFieldNode extends StandaloneSourceNodeBase, CanonicalFieldDescriptor {
  kind: 'field'
}

export interface StandaloneSourceLayoutNode extends StandaloneSourceNodeBase {
  kind: 'layout'
  slots: Record<string, StandaloneSourceNode[]>
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

export type StandaloneSourceNode = StandaloneSourceFieldNode | StandaloneSourceLayoutNode

export interface StandaloneSourcePage {
  id: string
  name: string
  route: string
  form: FormSettings
  root: StandaloneSourceNode[]
  runtime: ConfigFormPageRuntimeConfiguration
  scopedFields: ConfigFormScopedFieldDefinition[]
  valueScopes: ConfigFormValueScopeDefinition[]
  optionBindings: Array<{
    nodeId: string
    source: NonNullable<CanonicalFieldDescriptor['optionSource']>
  }>
}

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
  homePageId: string
  pages: StandaloneSourcePage[]
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
