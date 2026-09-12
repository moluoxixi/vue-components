import type {
  ConfigFormFlowStep,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'

export interface FlowFieldOption {
  /** Stable PageGraph identity used by ConfigFormValueInput field references. */
  nodeId: string
  /** Runtime form value key retained by the existing reaction contract. */
  field: string
  label: string
}

export interface FlowValueOption {
  value: string
  label: string
  path?: readonly string[]
}

export interface FlowOutputOption {
  key: string
  label: string
  value: ConfigFormValueInput
}

export interface FlowStepTarget {
  parentId?: string
  branch?: 'then' | 'else'
  index?: number
}

export interface FlowStepEntry {
  entryType: 'step'
  step: ConfigFormFlowStep
  depth: number
  index: number
  target: FlowStepTarget
}

export interface FlowBranchEntry {
  entryType: 'branch'
  conditionId: string
  branch: 'then' | 'else'
  depth: number
  index: number
  empty: boolean
}

export type FlowTreeEntry = FlowStepEntry | FlowBranchEntry

export interface FlowWorkspaceDiagnostic {
  code: string
  message: string
  path?: readonly (string | number)[] | string
  stepId?: string
}
