import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormScopedFieldDefinition,
  ConfigFormScopePath,
  ConfigFormValueScopeDefinition,
  ConfigFormValueScopeRowIdFactory,
} from '@moluoxixi/config-form-core'
import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'

export type ModelJsonObject = ConfigFormJsonObject
export type ModelJsonValue = ConfigFormJsonValue
export type ProjectId = string
export type SurfaceId = string
export type SurfaceInstanceId = string
export type NodeId = string
export type InteractionRuleId = string

export type MaterialSemanticTrigger = 'activate' | 'submit' | 'rowActivate' | 'itemActivate'
export type SurfaceKind = 'page' | 'dialog' | 'drawer'

export interface ControlledLength {
  value: number
  unit: 'px' | '%' | 'rem' | 'vw' | 'vh'
}

export interface ResponsiveLength {
  desktop: ControlledLength
  tablet?: ControlledLength
  mobile?: ControlledLength
}

export interface DialogPresentationV1 {
  kind: 'dialog'
  title: string
  width: ResponsiveLength
  mask: boolean
  close: { escape: boolean, mask: boolean, button: boolean }
}

export interface DrawerPresentationV1 {
  kind: 'drawer'
  title: string
  placement: 'left' | 'right' | 'top' | 'bottom'
  size: ResponsiveLength
  mask: boolean
  close: { escape: boolean, mask: boolean, button: boolean }
}

export interface SurfaceParameterDefinition {
  name: string
  required: boolean
  defaultValue?: ModelJsonValue
}

export interface SurfaceOutputDefinition {
  name: string
}

export type SafeExpressionReferenceScope = 'values' | 'parameters' | 'result' | 'item'
export type SafeExpressionFunction
  = | 'coalesce'
    | 'length'
    | 'trim'
    | 'lower'
    | 'upper'
    | 'includes'
    | 'startsWith'
    | 'endsWith'

export type SafeExpressionNode
  = | { kind: 'literal', value: ModelJsonValue }
    | {
      kind: 'reference'
      scope: 'values'
      selector?: 'current' | 'parent' | 'root'
      path: readonly string[]
    }
    | {
      kind: 'reference'
      scope: Exclude<SafeExpressionReferenceScope, 'values'>
      path: readonly string[]
    }
    | { kind: 'array', items: readonly SafeExpressionNode[] }
    | { kind: 'unary', operator: '!' | '-' | '+', operand: SafeExpressionNode }
    | {
      kind: 'binary'
      operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '>=' | '<' | '<=' | '&&' | '||'
      left: SafeExpressionNode
      right: SafeExpressionNode
    }
    | {
      kind: 'conditional'
      test: SafeExpressionNode
      consequent: SafeExpressionNode
      alternate: SafeExpressionNode
    }
    | { kind: 'call', callee: SafeExpressionFunction, args: readonly SafeExpressionNode[] }

export interface SafeExpressionV1 {
  version: 1
  ast: SafeExpressionNode
}

export type StateProjectionTarget
  = | { kind: 'state', nodeId: NodeId, key: 'visible' | 'disabled' | 'readonly' | 'required' }
    | { kind: 'property', nodeId: NodeId, path: readonly string[] }

export interface StateProjectionRule {
  kind: 'stateProjection'
  id: InteractionRuleId
  target: StateProjectionTarget
  value: SafeExpressionV1
}

export type ValueAction
  = | { kind: 'set', targetFieldId: NodeId, value: SafeExpressionV1 }
    | { kind: 'copy', sourceFieldId: NodeId, targetFieldId: NodeId }
    | { kind: 'clear', targetFieldId: NodeId }

export interface ValueChangeRule {
  kind: 'valueChange'
  id: InteractionRuleId
  dependencies: readonly NodeId[]
  when?: SafeExpressionV1
  action: ValueAction
}

export interface ValidationGate {
  scope: 'surface' | 'fields'
  fieldIds?: readonly NodeId[]
}

export interface SurfaceParameterBinding {
  name: string
  value: SafeExpressionV1
}

export interface ResultAssignment {
  targetFieldId: NodeId
  value: SafeExpressionV1
}

export interface NamedResultBinding {
  resultName: string
  assignments: readonly ResultAssignment[]
}

export type PrimaryUiAction
  = | { kind: 'navigate', targetSurfaceId: SurfaceId, parameters: readonly SurfaceParameterBinding[] }
    | { kind: 'back' }
    | {
      kind: 'open'
      targetSurfaceId: SurfaceId
      parameters: readonly SurfaceParameterBinding[]
      onResults?: readonly NamedResultBinding[]
    }
    | { kind: 'closeCurrent', result?: { name: string, value: SafeExpressionV1 } }
    | { kind: 'closeAll' }

export interface PrimaryUiActionBinding {
  kind: 'primaryUiAction'
  id: InteractionRuleId
  nodeId: NodeId
  trigger: MaterialSemanticTrigger
  validate?: ValidationGate
  action: PrimaryUiAction
}

export type PrototypeInteraction = StateProjectionRule | ValueChangeRule | PrimaryUiActionBinding

export interface PrototypeNodeAddressV1 {
  nodeId: NodeId
  scope: ConfigFormScopePath
}

export interface PrototypeSurfaceTopologyV1 {
  nodeOrder: readonly NodeId[]
  ownerScopeIdByNodeId: Readonly<Record<NodeId, NodeId | null>>
  valueScopes: readonly ConfigFormValueScopeDefinition[]
  scopedFields: readonly ConfigFormScopedFieldDefinition[]
}

export interface PrototypeFieldInstanceAddressV1 {
  address: PrototypeNodeAddressV1
  valuePath: readonly (string | number)[]
}

export interface PrototypeInstanceRuntimeSnapshotV1 {
  nodeAddresses: readonly PrototypeNodeAddressV1[]
  fieldInstances: readonly PrototypeFieldInstanceAddressV1[]
}

export interface PrototypeSurfaceContractBaseV1 {
  id: SurfaceId
  initialValues: Readonly<ModelJsonObject>
  parameters: readonly SurfaceParameterDefinition[]
  outputs: readonly SurfaceOutputDefinition[]
  interactions: readonly PrototypeInteraction[]
  topology: PrototypeSurfaceTopologyV1
}

export type PrototypeSurfaceContractV1
  = | (PrototypeSurfaceContractBaseV1 & { kind: 'page', route: string })
    | (PrototypeSurfaceContractBaseV1 & { kind: 'dialog', presentation: DialogPresentationV1 })
    | (PrototypeSurfaceContractBaseV1 & { kind: 'drawer', presentation: DrawerPresentationV1 })

export interface PrototypeProjectContextV1 {
  version: 1
  projectId: ProjectId
  homeSurfaceId: SurfaceId
  surfacesById: Readonly<Record<SurfaceId, PrototypeSurfaceContractV1>>
}

export interface PrototypeNodeProjectionV1 {
  address: PrototypeNodeAddressV1
  states: Readonly<Partial<Record<'visible' | 'disabled' | 'readonly' | 'required', boolean>>>
  properties: readonly { path: readonly string[], value: ModelJsonValue }[]
}

export type PrototypeInstanceProjectionV1 = readonly PrototypeNodeProjectionV1[]

export interface SurfaceInstanceV1 {
  instanceId: SurfaceInstanceId
  surfaceId: SurfaceId
  parentInstanceId?: SurfaceInstanceId
  openerAddress?: PrototypeNodeAddressV1
  openerInteractionId?: InteractionRuleId
  parameters: Readonly<ModelJsonObject>
  values: ModelJsonObject
  runtime: PrototypeInstanceRuntimeSnapshotV1
  projection: PrototypeInstanceProjectionV1
}

export interface PrototypeSessionV1 {
  version: 1
  projectId: ProjectId
  pageHistory: readonly SurfaceInstanceId[]
  overlayStack: readonly SurfaceInstanceId[]
  instancesById: Readonly<Record<SurfaceInstanceId, SurfaceInstanceV1>>
}

export interface PrototypeProjectSessionInitializationInput {
  compilation: ProjectCompilation
  homeInstanceId: string
  createRowId: ConfigFormValueScopeRowIdFactory
}

export type PrototypeSessionCommand
  = | {
    type: 'instance.valuesChanged'
    instanceId: SurfaceInstanceId
    values: ModelJsonObject
    runtime: PrototypeInstanceRuntimeSnapshotV1
    originScope: ConfigFormScopePath
    changedAddresses: readonly PrototypeNodeAddressV1[]
  }
  | {
    type: 'interaction.activate'
    sourceInstanceId: SurfaceInstanceId
    sourceAddress: PrototypeNodeAddressV1
    interactionId: InteractionRuleId
    nextInstance?: { instanceId: SurfaceInstanceId, runtime: PrototypeInstanceRuntimeSnapshotV1 }
    item?: Readonly<ModelJsonObject>
  }
  | { type: 'history.back' }
  | { type: 'overlay.dismiss', instanceId: SurfaceInstanceId, reason: 'escape' | 'mask' | 'button' }
  | { type: 'overlay.closeAll' }

export type PrototypeSessionEffect
  = | { type: 'instance.mount', instanceId: SurfaceInstanceId, surfaceId: SurfaceId }
    | { type: 'instance.dispose', instanceId: SurfaceInstanceId }
    | {
      type: 'instance.values.replace'
      instanceId: SurfaceInstanceId
      values: ModelJsonObject
      changedAddresses: readonly PrototypeNodeAddressV1[]
    }
    | {
      type: 'instance.projection.replace'
      instanceId: SurfaceInstanceId
      projection: PrototypeInstanceProjectionV1
    }
    | { type: 'focus.restore', instanceId: SurfaceInstanceId, address: PrototypeNodeAddressV1 }

export interface PrototypeDiagnostic {
  code: string
  message: string
  path?: readonly (string | number)[]
  context?: Readonly<Record<string, ModelJsonValue>>
}

export interface PrototypeExpressionInput {
  surface: PrototypeSurfaceContractV1
  values: ModelJsonObject
  parameters: Readonly<ModelJsonObject>
  runtime: PrototypeInstanceRuntimeSnapshotV1
  address: PrototypeNodeAddressV1
  expression: SafeExpressionV1
  result?: ModelJsonValue
  item?: Readonly<ModelJsonObject>
}

export interface PrototypeValueSettlement {
  values: ModelJsonObject
  changedAddresses: readonly PrototypeNodeAddressV1[]
}

export interface PrototypeTransition {
  session: PrototypeSessionV1
  diagnostics: readonly PrototypeDiagnostic[]
  effects: readonly PrototypeSessionEffect[]
}

export type PrototypeReadResult<T>
  = | { success: true, data: T, diagnostics: [] }
    | { success: false, diagnostics: readonly PrototypeDiagnostic[] }

export interface SafeExpressionScopeValues {
  current: ModelJsonObject
  parent: ModelJsonObject
  root: ModelJsonObject
}

export interface SafeExpressionEvaluationContext {
  values: ModelJsonObject
  parameters: Readonly<ModelJsonObject>
  scopeValues: SafeExpressionScopeValues
  result?: ModelJsonValue
  item?: Readonly<ModelJsonObject>
}

export type SafeExpressionEvaluationResult
  = | { success: true, value: ModelJsonValue }
    | { success: false, diagnostic: PrototypeDiagnostic }

export interface PrototypeCommandReadHints {
  trigger?: MaterialSemanticTrigger
  actionKind?: PrimaryUiAction['kind']
}
