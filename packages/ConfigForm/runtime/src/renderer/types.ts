import type {
  ConfigFormCondition,
  ConfigFormController,
  ConfigFormErrors,
  ConfigFormField,
  ConfigFormFieldChangePayload,
  ConfigFormFieldKey,
  ConfigFormMeta,
  ConfigFormNode,
  ConfigFormReactionProjection,
  ConfigFormReadonlyRender,
  ConfigFormValues,
  ConfigFormComponentRegistration as HeadlessComponentRegistration,
  ConfigFormComponentRegistry as HeadlessComponentRegistry,
} from '@moluoxixi/config-form-headless'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'
import type { ConfigFormBreakpoint, ConfigFormResponsiveLayout } from './responsive'

export type ConfigFormRendererFormAttrs = FormHTMLAttributes
export type ConfigFormRendererLayoutAttrs = HTMLAttributes
export type ConfigFormRendererCellAttrs = HTMLAttributes
export type ConfigFormRendererFieldAttrs = HTMLAttributes
export type ConfigFormComponentRegistration = HeadlessComponentRegistration<Component>
export type ConfigFormComponentRegistry = HeadlessComponentRegistry<Component>

/**
 * The renderer mode controls whether form controls are allowed to update the
 * local model. Preview mode keeps the historical interactive behaviour;
 * design mode renders the same components while shielding their side effects.
 */
export type ConfigFormRenderMode = 'design' | 'preview'

export type ConfigFormRendererNode<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormNode<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  > & {
    /** Stable model id supplied by a designer/LowCode page model. */
    id?: string
  }

export type ConfigFormRendererField<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormField<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  > & {
    /** Stable model id supplied by a designer/LowCode page model. */
    id?: string
  }

export interface ConfigFormControlBinding {
  trigger: string
  valueProp: string
}

export type ConfigFormControlBindingResolver<TValues extends ConfigFormValues = ConfigFormValues>
  = (field: ConfigFormRendererField<TValues>) => Partial<ConfigFormControlBinding> | undefined

/** Metadata exposed for editor overlays and drop-target registration. */
export interface ConfigFormRuntimeNodeMetadata<
  TValues extends ConfigFormValues = ConfigFormValues,
> {
  /** Stable model id. Falls back to field key/path for legacy nodes. */
  nodeId: string
  /** Alias for consumers that use a generic node id field. */
  id: string
  /** Dot-delimited location in the rendered node tree. */
  path: string
  /** Named parent slot, when the node is rendered inside one. */
  slot?: string
  /** Whether this is a value-bound field or a plain component node. */
  kind: 'field' | 'component'
  component: Component | string
  node: ConfigFormRendererNode<TValues>
  mode: ConfigFormRenderMode
  /** Optional transient state supplied by an editor bridge. */
  state?: unknown
}

/** Context passed to editor event interception hooks. */
export interface ConfigFormRuntimeEventContext<
  TValues extends ConfigFormValues = ConfigFormValues,
> {
  metadata: ConfigFormRuntimeNodeMetadata<TValues>
  /** Flattened aliases make lightweight editor hooks ergonomic. */
  nodeId: string
  path: string
  slot?: string
  node: ConfigFormRendererNode<TValues>
  mode: ConfigFormRenderMode
  event: string
  args: unknown[]
}

/** Event emitted by the Preview Runtime for Flow component.event triggers. */
export type ConfigFormRuntimeEventPayload<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRuntimeEventContext<TValues>

/**
 * Optional bridge used by Design Canvas integrations. Registration is invoked
 * with the real node cell element when it mounts. Returning `false` from
 * `interceptEvent` explicitly allows the normal renderer listener to run;
 * any other return value keeps design mode side-effect free.
 */
export interface ConfigFormRuntimeEditorBridge<
  TValues extends ConfigFormValues = ConfigFormValues,
> {
  registerNode?: (
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    element: HTMLElement,
  ) => void | (() => void)
  unregisterNode?: (metadata: ConfigFormRuntimeNodeMetadata<TValues>, element?: HTMLElement) => void
  interceptEvent?: (context: ConfigFormRuntimeEventContext<TValues>) => boolean | void
  /** Alias retained for editor adapters that model hooks as event callbacks. */
  onEvent?: (context: ConfigFormRuntimeEventContext<TValues>) => boolean | void
  /** Optional state reader for overlays; renderer never mutates this state. */
  readState?: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => unknown
  /**
   * Design-only DOM attributes. Canonical node identity attributes always win,
   * so an editor can add focus/selection behavior without changing layout.
   */
  getNodeAttrs?: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => HTMLAttributes
  /** Custom id resolver for legacy nodes that do not have an `id` property. */
  getNodeId?: (
    node: ConfigFormRendererNode<TValues>,
    path: string,
  ) => string | undefined
}

/** Short aliases used by RuntimeSurface consumers. */
export type RuntimeEditorBridge<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRuntimeEditorBridge<TValues>
export type RuntimeNodeMetadata<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRuntimeNodeMetadata<TValues>
export type RuntimeEditorEventContext<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRuntimeEventContext<TValues>

export interface ConfigFormRendererProps<TValues extends ConfigFormValues = ConfigFormValues> {
  fields: ConfigFormRendererNode<TValues>[]
  /** 按字符串别名解析字段/容器组件；字段自身的绑定配置优先于注册默认值。 */
  components?: ConfigFormComponentRegistry
  defaultValues?: Partial<TValues>
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: ConfigFormReadonlyRender<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >
  formAttrs?: ConfigFormRendererFormAttrs
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  responsive?: ConfigFormResponsiveLayout
  /** 透传给原生 Grid/Flex 布局容器。 */
  layoutAttrs?: ConfigFormRendererLayoutAttrs
  /** 透传给原生 grid cell；inline 布局不消费。 */
  cellAttrs?: ConfigFormRendererCellAttrs
  namespace?: string
  defaultValueProp?: string
  defaultTrigger?: string
  resolveBinding?: ConfigFormControlBindingResolver<TValues>
  /** Shared RuntimeSurface mode. Defaults to the historical interactive preview. */
  mode?: ConfigFormRenderMode
  /**
   * Optional transient presentation breakpoint. When supplied, RuntimeSurface
   * resolves the active grid layout from this value instead of the host
   * viewport media query. It never changes the Config Model.
   */
  breakpoint?: ConfigFormBreakpoint
  /** Optional Design Canvas bridge for node metadata and event interception. */
  editor?: ConfigFormRuntimeEditorBridge<TValues>
  /** Transient Flow projection merged after field-declared reactions. */
  reactionProjection?: ConfigFormReactionProjection<TValues>
}

/** RuntimeSurface accepts the same node/layout contract as ConfigFormRenderer. */
export type RuntimeSurfaceProps<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererProps<TValues>

export interface ConfigFormRendererEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  (event: 'change', values: TValues): void
  (event: 'error', errors: ConfigFormErrors): void
  (event: 'errorsChange', errors: ConfigFormErrors): void
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  (event: 'metaChange', meta: ConfigFormMeta): void
  (event: 'runtimeEvent', context: ConfigFormRuntimeEventPayload<TValues>): void
  (event: 'submit', values: TValues): void
}

export interface ConfigFormRendererExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<
    ConfigFormController<TValues>,
    | 'clearValidate'
    | 'getErrors'
    | 'getFieldMeta'
    | 'getMeta'
    | 'getValidating'
    | 'getValue'
    | 'getValues'
    | 'resetFields'
    | 'setErrors'
    | 'setValue'
    | 'setValues'
    | 'setTouched'
    | 'submit'
    | 'validate'
    | 'validateField'
  > {
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
}
