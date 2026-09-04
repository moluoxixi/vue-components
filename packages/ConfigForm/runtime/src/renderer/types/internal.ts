import type {
  ConfigFormAttrs,
  ConfigFormController,
  ConfigFormErrors,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, ComputedRef, ShallowRef, VNodeChild } from 'vue'
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
  model: ShallowRef<TValues>
  resolveReactionProps: (field: string) => ConfigFormAttrs
  resolveReactionState: (
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
    slot?: string,
  ) => ConfigFormRuntimeNodeMetadata<TValues>
  nodeMetadataAttrs: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => Record<string, unknown>
  registerNodeElement: (metadata: ConfigFormRuntimeNodeMetadata<TValues>, element: unknown) => void
  shouldInterceptEditorEvent: (
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    event: string,
    args: unknown[],
  ) => boolean
}

export interface RendererBindingService<TValues extends ConfigFormValues> {
  resolveBinding: (
    field: ConfigFormRendererField<TValues>,
    registration?: ConfigFormComponentRegistration,
  ) => ConfigFormControlBinding
  resolveComponent: <TComponent extends Component | string>(component: TComponent) => TComponent
  resolveRegistration: (component: Component | string) => ConfigFormComponentRegistration | undefined
}

export interface RuntimeFlowEventService<TValues extends ConfigFormValues> {
  addListener: (
    target: Record<string, unknown>,
    event: string,
    listener: (...args: unknown[]) => void,
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvent?: string,
  ) => void
  addRuntimeFlowEventListeners: (
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    runtimeEvents: ReadonlyMap<string, string>,
    managedListenerKeys: Set<string>,
  ) => void
  runtimeFlowEventMap: (node: ConfigFormRendererNode<TValues>) => ReadonlyMap<string, string>
  wrapComponentListeners: (
    target: Record<string, unknown>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    skipKeys?: ReadonlySet<string>,
    runtimeEvents?: ReadonlyMap<string, string>,
  ) => void
}

export interface RendererPipelineContext<TValues extends ConfigFormValues> {
  activePresentationLayout: ComputedRef<ConfigFormResolvedLayout | undefined>
  bem: (element: string, modifier?: string) => string
  binding: RendererBindingService<TValues>
  controller: RendererControllerState<TValues>
  designGuard: DesignInteractionGuard
  editorBridge: RuntimeEditorBridgeState<TValues>
  flowEvents: RuntimeFlowEventService<TValues>
  formId: string
  props: Readonly<ConfigFormRendererProps<TValues>>
  responsiveLabelWidths: ComputedRef<Record<ConfigFormBreakpoint, string>>
  responsiveLayouts: ComputedRef<Record<ConfigFormBreakpoint, ConfigFormResolvedLayout>>
}

export type RenderNode<TValues extends ConfigFormValues> = (
  node: ConfigFormRendererNode<TValues>,
  wrapCell: boolean,
  path: string,
  ancestors: ReadonlySet<object>,
  slot?: string,
) => VNodeChild

export type RendererSlots = Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined
