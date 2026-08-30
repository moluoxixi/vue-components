import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowNode,
} from '@moluoxixi/config-form-core'
import type {
  FormSettings,
  LegacyLowCodeNodeV1,
  LegacyLowCodePageModelV1,
  ModelJsonObject,
  RegisteredBinding as ModelRegisteredBinding,
  RegisteredEventAction as ModelRegisteredEventAction,
} from '@moluoxixi/config-form-model'
import { LEGACY_LOW_CODE_PAGE_MODEL_VERSION } from '@moluoxixi/config-form-model'

export type { ConfigFormFlow } from '@moluoxixi/config-form-core'

export const LOW_CODE_PAGE_MODEL_VERSION = LEGACY_LOW_CODE_PAGE_MODEL_VERSION

export type RegisteredEventAction = ModelRegisteredEventAction
export type RegisteredBinding = ModelRegisteredBinding

/** @deprecated Use PageGraph from @moluoxixi/config-form-model for new code. */
export type LowCodeNode = LegacyLowCodeNodeV1
/** @deprecated Use ProjectDocument/PageGraph from @moluoxixi/config-form-model for new code. */
export type LowCodePageModel = LegacyLowCodePageModelV1

export interface ModelDiagnostic {
  code: string
  message: string
  nodeId?: string
}

export interface ModelNodeTarget {
  parentId: string | null
  index?: number
  slot?: string
}

export type ModelNodePatch = Partial<Pick<
  LowCodeNode,
  | 'conditions'
  | 'defaultValue'
  | 'extensions'
  | 'field'
  | 'label'
  | 'reactions'
  | 'validateOn'
  | 'validation'
>>

export type ConfigFormFlowSettings = Pick<
  ConfigFormFlow,
  'name' | 'trigger' | 'concurrency' | 'errorPolicy'
>

export type ModelOperation
  = | { type: 'insert', node: LowCodeNode, target: ModelNodeTarget }
    | { type: 'move', nodeId: string, target: ModelNodeTarget }
    | { type: 'updatePage', form: FormSettings, props: ModelJsonObject }
    | { type: 'addFlow', flow: ConfigFormFlow, index?: number }
    | { type: 'updateFlowSettings', flowId: string, settings: ConfigFormFlowSettings }
    | { type: 'updateFlowNode', flowId: string, nodeId: string, node: ConfigFormFlowNode }
    | { type: 'updateFlowEdges', flowId: string, edges: ConfigFormFlowEdge[] }
    | { type: 'updateFlowGraph', flowId: string, nodes: ConfigFormFlowNode[], edges: ConfigFormFlowEdge[] }
    /** Compatibility operation for restoring an exact legacy flow snapshot. */
    | { type: 'updateFlow', flowId: string, flow: ConfigFormFlow }
    | { type: 'removeFlow', flowId: string }
    /** Compatibility operation for restoring an exact legacy flows snapshot. */
    | { type: 'updateFlows', flows?: ConfigFormFlow[] }
    | { type: 'updateProps', nodeId: string, props: ModelJsonObject }
    | { type: 'updateEvents', nodeId: string, events: Record<string, RegisteredEventAction[]> }
    | { type: 'updateBindings', nodeId: string, bindings: Record<string, RegisteredBinding> }
    | { type: 'updateNode', nodeId: string, patch: ModelNodePatch }
    | { type: 'resize', nodeId: string, span: number | null }
    | { type: 'duplicate', nodeId: string, target: ModelNodeTarget, idMap: Record<string, string>, fieldMap?: Record<string, string> }
    | { type: 'remove', nodeId: string }
    | { type: 'batch', operations: ModelOperation[] }

export interface AppliedModelOperation {
  inverse: ModelOperation
  operation: ModelOperation
  revision: number
}

export interface ModelOperationSuccess {
  success: true
  model: LowCodePageModel
  inverse: ModelOperation
  diagnostics: ModelDiagnostic[]
}

export interface ModelOperationFailure {
  success: false
  model: LowCodePageModel
  diagnostics: ModelDiagnostic[]
}

export type ModelOperationResult = ModelOperationSuccess | ModelOperationFailure

export interface ConfigModelHistory {
  present: LowCodePageModel
  past: AppliedModelOperation[]
  future: AppliedModelOperation[]
  revision: number
  limit: number
}

export interface ConfigModelHistoryResult {
  changed: boolean
  history: ConfigModelHistory
  diagnostics: ModelDiagnostic[]
}
