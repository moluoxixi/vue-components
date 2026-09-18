import type { ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type {
  ConfigFormAttrs,
  ConfigFormController,
  ConfigFormErrors,
  ConfigFormFieldAddress,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, ComputedRef, Ref, ShallowRef, VNodeChild } from 'vue'
import type { ConfigFormPageRuntimeOptionState } from '../../runtime'
import type {
  ConfigFormComponentRegistration,
  ConfigFormControlBinding,
  ConfigFormRendererField,
  ConfigFormRendererNode,
  ConfigFormRuntimeNodeMetadata,
} from './contracts'
import type { ConfigFormRendererProps } from './props'
import type {
  ConfigFormBreakpoint,
  ConfigFormResolvedLayout,
} from './responsive'

export interface DesignInteractionGuard {
  applyDesignInteractionGuard: (target: Record<string, unknown>) => void
}

export interface RendererControllerState<TValues extends ConfigFormValues>
  extends ConfigFormController<TValues> {
  errors: ShallowRef<ConfigFormErrors>
  meta: ShallowRef<ConfigFormMeta>
  model: Ref<TValues>
  resolveReactionProps: (field: string) => ConfigFormAttrs
  resolveReactionState: (
    field: string,
  ) => Partial<Record<'disabled' | 'readonly' | 'required' | 'visible', boolean>>
  resolveInstanceReactionProps: (
    address: Parameters<ConfigFormController<TValues>['getInstanceReactionProps']>[0],
    field: string,
  ) => ConfigFormAttrs
  resolveInstanceReactionState: (
    address: Parameters<ConfigFormController<TValues>['getInstanceReactionState']>[0],
    field: string,
  ) => Partial<Record<'disabled' | 'readonly' | 'required' | 'visible', boolean>>
}

export interface RendererLayoutState {
  activePresentationLayout: ComputedRef<ConfigFormResolvedLayout | undefined>
  responsiveLabelWidths: ComputedRef<Record<ConfigFormBreakpoint, string>>
  responsiveLayouts: ComputedRef<Record<ConfigFormBreakpoint, ConfigFormResolvedLayout>>
}

export interface RuntimeEditorBridgeState<TValues extends ConfigFormValues> {
  createNodeMetadata: (
    node: ConfigFormRendererNode<TValues>,
    path: string,
    scope: ConfigFormScopePath,
    slot?: string,
  ) => ConfigFormRuntimeNodeMetadata<TValues>
  nodeMetadataAttrs: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => Record<string, unknown>
  registerNodeElement: (metadata: ConfigFormRuntimeNodeMetadata<TValues>, element: unknown) => void
}

export interface RendererBindingService<TValues extends ConfigFormValues> {
  resolveBinding: (
    field: ConfigFormRendererField<TValues>,
    registration?: ConfigFormComponentRegistration,
  ) => ConfigFormControlBinding
  resolveComponent: <TComponent extends Component | string>(component: TComponent) => TComponent
  resolveRegistration: (component: Component | string) => ConfigFormComponentRegistration | undefined
}

export interface ComponentListenerService {
  addListener: (
    target: Record<string, unknown>,
    event: string,
    listener: (...args: unknown[]) => unknown,
  ) => void
  wrapComponentListeners: (
    target: Record<string, unknown>,
    skipKeys?: ReadonlySet<string>,
  ) => void
}

export interface RendererPipelineContext<TValues extends ConfigFormValues> {
  activePresentationLayout: ComputedRef<ConfigFormResolvedLayout | undefined>
  bem: (element: string, modifier?: string) => string
  cancelScope: (scope: ConfigFormScopePath) => void
  binding: RendererBindingService<TValues>
  componentListeners: ComponentListenerService
  controller: RendererControllerState<TValues>
  designGuard: DesignInteractionGuard
  editorBridge: RuntimeEditorBridgeState<TValues>
  formId: string
  getOptionState: (address: ConfigFormFieldAddress) => ConfigFormPageRuntimeOptionState | undefined
  props: Readonly<ConfigFormRendererProps<TValues>>
  responsiveLabelWidths: ComputedRef<Record<ConfigFormBreakpoint, string>>
  responsiveLayouts: ComputedRef<Record<ConfigFormBreakpoint, ConfigFormResolvedLayout>>
}

export type RenderNode<TValues extends ConfigFormValues> = (
  node: ConfigFormRendererNode<TValues>,
  wrapCell: boolean,
  path: string,
  ancestors: ReadonlySet<object>,
  scope: ConfigFormScopePath,
  slot?: string,
) => VNodeChild
export type RendererSlots = Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined
