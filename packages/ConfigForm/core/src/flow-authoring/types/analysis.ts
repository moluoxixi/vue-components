import type {
  ConfigFormFlowActionStep,
  ConfigFormFlowAuthoringDiagnostic,
} from './contracts'

export interface ConfigFormExpressionOutputReference {
  outputId: string
  path: string
}

export interface ConfigFormExpressionOutputAnalysis {
  references: ConfigFormExpressionOutputReference[]
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
}

export interface ConfigFormFlowStepTreeAnalysis {
  actions: ConfigFormFlowActionStep[]
  availableOutputs: Map<string, Set<string>>
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
  paths: Map<string, string>
}
