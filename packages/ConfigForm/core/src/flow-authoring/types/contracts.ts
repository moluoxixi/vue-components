import type {
  ConfigFormFlow,
  ConfigFormFlowActionNodeConfig,
  ConfigFormFlowNode,
  ConfigFormFlowReactionNodeConfig,
} from '../../flow'
import type { ConfigFormReactionCondition } from '../../reaction'

export type ConfigFormFlowStepPolicy = NonNullable<ConfigFormFlowNode['policy']>
export type ConfigFormFlowTerminateOutcome = 'end' | 'success' | 'failure' | 'blocked'
export type ConfigFormFlowStepBranch = 'then' | 'else'

export interface ConfigFormFlowStepBase {
  id: string
  title?: string
}

export interface ConfigFormFlowActionStep extends ConfigFormFlowStepBase {
  type: 'action'
  ref: string
  input?: ConfigFormFlowActionNodeConfig['input']
  output?: ConfigFormFlowActionNodeConfig['output']
  policy?: ConfigFormFlowStepPolicy
}

export interface ConfigFormFlowConditionStep extends ConfigFormFlowStepBase {
  type: 'condition'
  when: ConfigFormReactionCondition
  then: ConfigFormFlowStep[]
  else: ConfigFormFlowStep[]
}

export interface ConfigFormFlowReactionStep extends ConfigFormFlowStepBase {
  type: 'reaction'
  reactions: ConfigFormFlowReactionNodeConfig['reactions']
  policy?: ConfigFormFlowStepPolicy
}

export interface ConfigFormFlowTerminateStep extends ConfigFormFlowStepBase {
  type: 'terminate'
  outcome: ConfigFormFlowTerminateOutcome
}

export type ConfigFormFlowStep
  = | ConfigFormFlowActionStep
    | ConfigFormFlowConditionStep
    | ConfigFormFlowReactionStep
    | ConfigFormFlowTerminateStep

export type ConfigFormFlowMetadata = Omit<ConfigFormFlow, 'edges' | 'nodes'>

export interface ConfigFormFlowAuthoringDiagnostic {
  code: string
  message: string
  path?: string
  stepId?: string
  nodeId?: string
  edgeId?: string
}

export type ConfigFormFlowCreateResult
  = | {
    success: true
    flow: ConfigFormFlow
    diagnostics: ConfigFormFlowAuthoringDiagnostic[]
  }
  | {
    success: false
    diagnostics: ConfigFormFlowAuthoringDiagnostic[]
    flow?: never
  }

export interface ConfigFormFlowStepsResult {
  success: boolean
  steps: ConfigFormFlowStep[]
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
}

export interface ConfigFormFlowStepOutput {
  stepId: string
  title?: string
  ref: string
}

export interface ConfigFormFlowStepIdFactoryContext {
  path: string
  step: Readonly<ConfigFormFlowStep>
}

export type ConfigFormFlowStepIdFactory = (
  sourceId: string,
  context: ConfigFormFlowStepIdFactoryContext,
) => string

export interface ConfigFormFlowStepTarget {
  /** Omit for the root sequence. */
  parentId?: string
  /** Required when parentId names a condition. */
  branch?: ConfigFormFlowStepBranch
  /** Defaults to appending to the selected sequence. */
  index?: number
}

export interface ConfigFormFlowStepEditResult extends ConfigFormFlowStepsResult {
  /** The requested structural edit was applied. Semantic diagnostics may remain. */
  applied: boolean
}
