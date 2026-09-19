import type {
  ConfigFormScopePath,
  ConfigFormValueScopeRowIdFactory,
  ConfigFormValueScopeRowIdFactoryContext,
} from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type {
  MaterialSemanticTrigger,
  ModelJsonObject,
  PrototypeDiagnostic,
  PrototypeInstanceProjectionV1,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
  PrototypeProjectContextV1,
  PrototypeReadResult,
  PrototypeSessionCommand,
  PrototypeSessionEffect,
  PrototypeSessionV1,
  PrototypeSurfaceContractV1,
  PrototypeTransition,
  SurfaceId,
  SurfaceInstanceId,
  SurfaceInstanceV1,
  ValidationGate,
} from '../../session/types'

export interface PrototypeVueSurfaceArtifact {
  readonly surfaceId: SurfaceId
  readonly component: Component
  readonly props?: Readonly<Record<string, unknown>>
}

export interface PrototypeVueValuesReplacement {
  readonly values: ModelJsonObject
  readonly changedAddresses: readonly PrototypeNodeAddressV1[]
}

export interface PrototypeVueInstanceController {
  replaceValues: (replacement: PrototypeVueValuesReplacement) => void
  replaceProjection: (projection: PrototypeInstanceProjectionV1) => void
  validateSurface: () => boolean | Promise<boolean>
  validateFields: (addresses: readonly PrototypeNodeAddressV1[]) => boolean | Promise<boolean>
  focus: (address: PrototypeNodeAddressV1) => void
  dispose: () => void
}

export interface PrototypeVueControllerRegistryEntry {
  readonly instanceId: SurfaceInstanceId
  readonly surfaceId: SurfaceId
  readonly values: ModelJsonObject
  readonly projection: PrototypeInstanceProjectionV1
  readonly controller?: PrototypeVueInstanceController
}

export interface PrototypeVueControllerRegistry {
  mount: (instance: SurfaceInstanceV1) => void
  register: (
    instanceId: SurfaceInstanceId,
    controller: PrototypeVueInstanceController,
  ) => () => void
  replaceValues: (
    instanceId: SurfaceInstanceId,
    replacement: PrototypeVueValuesReplacement,
  ) => void
  replaceProjection: (
    instanceId: SurfaceInstanceId,
    projection: PrototypeInstanceProjectionV1,
  ) => void
  focus: (instanceId: SurfaceInstanceId, address: PrototypeNodeAddressV1) => void
  dispose: (instanceId: SurfaceInstanceId) => void
  disposeAll: () => void
  get: (instanceId: SurfaceInstanceId) => PrototypeVueControllerRegistryEntry | undefined
  has: (instanceId: SurfaceInstanceId) => boolean
  ids: () => readonly SurfaceInstanceId[]
  subscribe: (listener: () => void) => () => void
}

export interface PrototypeVueEffectExecutor {
  execute: (transition: PrototypeTransition) => void
  reset: () => void
}

export interface PrototypeVueEffectExecutorOptions {
  registry: PrototypeVueControllerRegistry
  scheduleFocus?: (callback: () => void) => void
  onEffect?: (effect: PrototypeSessionEffect) => void
}

export interface PrototypeVueTransitionSnapshot {
  readonly session: PrototypeSessionV1
  readonly diagnostics: readonly PrototypeDiagnostic[]
}

export interface PrototypeVueInstanceIdFactoryInput {
  readonly parentInstanceId: SurfaceInstanceId
  readonly sourceAddress: PrototypeNodeAddressV1
  readonly surfaceId: SurfaceId
}

export type PrototypeVueInstanceIdFactory = (
  input: PrototypeVueInstanceIdFactoryInput,
) => SurfaceInstanceId

export type PrototypeVueRowIdFactory = (
  input: ConfigFormValueScopeRowIdFactoryContext & {
    readonly instanceId: SurfaceInstanceId
  },
) => string

export interface PrototypeVueRuntimeSnapshotFactoryInput {
  readonly instanceId: SurfaceInstanceId
  readonly surface: PrototypeSurfaceContractV1
  readonly values: ModelJsonObject
  readonly createRowId: ConfigFormValueScopeRowIdFactory
}

export type PrototypeVueRuntimeSnapshotFactory = (
  input: PrototypeVueRuntimeSnapshotFactoryInput,
) => PrototypeReadResult<PrototypeInstanceRuntimeSnapshotV1>

export interface PrototypeVueHostOptions {
  readonly context: PrototypeProjectContextV1
  readonly homeInstanceId?: SurfaceInstanceId
  readonly initialSession?: PrototypeSessionV1
  readonly registry?: PrototypeVueControllerRegistry
  readonly createInstanceId?: PrototypeVueInstanceIdFactory
  readonly createRowId?: PrototypeVueRowIdFactory
  readonly createRuntimeSnapshot?: PrototypeVueRuntimeSnapshotFactory
  readonly scheduleFocus?: (callback: () => void) => void
  readonly onEffect?: (effect: PrototypeSessionEffect) => void
  readonly onSnapshot?: (snapshot: PrototypeVueTransitionSnapshot) => void
}

export interface PrototypeVueActivationInput {
  readonly sourceInstanceId: SurfaceInstanceId
  readonly sourceAddress: PrototypeNodeAddressV1
  readonly interactionId: string
  readonly item?: Readonly<ModelJsonObject>
}

export type PrototypeVueActivationStatus
  = | 'dispatched'
    | 'validation-failed'
    | 'controller-unavailable'
    | 'stale'
    | 'invalid'

export interface PrototypeVueActivationResult {
  readonly status: PrototypeVueActivationStatus
  readonly snapshot: PrototypeVueTransitionSnapshot
}

export interface PrototypeVueValuesChangedInput {
  readonly instanceId: SurfaceInstanceId
  readonly values: ModelJsonObject
  readonly runtime: PrototypeInstanceRuntimeSnapshotV1
  readonly originScope: ConfigFormScopePath
  readonly changedAddresses: readonly PrototypeNodeAddressV1[]
}

export interface PrototypeVueHostController {
  readonly registry: PrototypeVueControllerRegistry
  getSnapshot: () => PrototypeVueTransitionSnapshot
  getRevision: () => number
  replaceSession: (session: PrototypeSessionV1 | unknown) => PrototypeVueTransitionSnapshot
  dispatch: (command: PrototypeSessionCommand | unknown) => PrototypeVueTransitionSnapshot
  activate: (input: PrototypeVueActivationInput) => Promise<PrototypeVueActivationResult>
  valuesChanged: (input: PrototypeVueValuesChangedInput) => PrototypeVueTransitionSnapshot
  back: () => PrototypeVueTransitionSnapshot
  closeAll: () => PrototypeVueTransitionSnapshot
  dismiss: (
    instanceId: SurfaceInstanceId,
    reason: 'escape' | 'mask' | 'button',
  ) => PrototypeVueTransitionSnapshot
  createRowIdFactory: (instanceId: SurfaceInstanceId) => ConfigFormValueScopeRowIdFactory
  dispose: () => void
}

export interface PrototypeVueSurfaceActivationRequest {
  readonly sourceAddress: PrototypeNodeAddressV1
  readonly interactionId: string
  readonly item?: Readonly<ModelJsonObject>
}

export interface PrototypeVueSurfaceValuesChangeRequest {
  readonly values: ModelJsonObject
  readonly runtime: PrototypeInstanceRuntimeSnapshotV1
  readonly originScope: ConfigFormScopePath
  readonly changedAddresses: readonly PrototypeNodeAddressV1[]
}

export interface PrototypeVueSurfaceRendererBindings {
  readonly instance: SurfaceInstanceV1
  readonly surface: PrototypeSurfaceContractV1
  readonly values: ModelJsonObject
  readonly projection: PrototypeInstanceProjectionV1
  readonly createRowIdFactory: () => ConfigFormValueScopeRowIdFactory
  readonly registerController: (controller: PrototypeVueInstanceController) => () => void
  readonly activate: (
    input: PrototypeVueSurfaceActivationRequest,
  ) => Promise<PrototypeVueActivationResult>
  readonly valuesChanged: (
    input: PrototypeVueSurfaceValuesChangeRequest,
  ) => PrototypeVueTransitionSnapshot
}

export interface PrototypeVueValidationFailure {
  readonly instanceId: SurfaceInstanceId
  readonly interactionId: string
  readonly gate: ValidationGate
}

export interface PrototypeVueHostDiagnosticEvent {
  readonly diagnostics: readonly PrototypeDiagnostic[]
  readonly snapshot: PrototypeVueTransitionSnapshot
}

export interface PrototypeVueSemanticActivation {
  readonly instanceId: SurfaceInstanceId
  readonly address: PrototypeNodeAddressV1
  readonly interactionId: string
  readonly trigger: MaterialSemanticTrigger
}
