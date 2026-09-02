import type { ConfigFormFlowExecutionPlan, ConfigFormReaction } from '@moluoxixi/config-form-core'
import type {
  ConditionExpression,
  ConditionTarget,
  FieldNode,
  FormSettings,
  ModelJsonObject,
  ModelJsonValue,
  RegisteredBinding,
  RegisteredEventAction,
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
  events: Record<string, RegisteredEventAction[]>
  flowEvents: string[]
  bindings: Record<string, RegisteredBinding>
  placement: ModelJsonObject
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

export interface StandaloneSourceFieldNode extends StandaloneSourceNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: NonNullable<FieldNode['validation']>
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface StandaloneSourceLayoutNode extends StandaloneSourceNodeBase {
  kind: 'layout'
  slots: Record<string, StandaloneSourceNode[]>
}

export type StandaloneSourceNode = StandaloneSourceFieldNode | StandaloneSourceLayoutNode

export interface StandaloneSourcePage {
  id: string
  name: string
  route: string
  form: FormSettings
  root: StandaloneSourceNode[]
  flowPlans: ConfigFormFlowExecutionPlan[]
}

export interface StandaloneSourceComponentDefinition {
  binding: CanonicalSourceComponentBinding
  events: ReadonlyArray<{ name: string }>
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
