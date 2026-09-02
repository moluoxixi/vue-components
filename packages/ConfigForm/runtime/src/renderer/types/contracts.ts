import type {
  ConfigFormField,
  ConfigFormNode,
  ConfigFormValues,
  ConfigFormComponentRegistration as HeadlessComponentRegistration,
  ConfigFormComponentRegistry as HeadlessComponentRegistry,
} from '@moluoxixi/config-form-headless'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type ConfigFormRendererFormAttrs = FormHTMLAttributes
export type ConfigFormRendererLayoutAttrs = HTMLAttributes
export type ConfigFormRendererCellAttrs = HTMLAttributes
export type ConfigFormRendererFieldAttrs = HTMLAttributes
export type ConfigFormComponentRegistration = HeadlessComponentRegistration<Component>
export type ConfigFormComponentRegistry = HeadlessComponentRegistry<Component>

/**
 * The renderer mode controls whether form controls are allowed to update the
 * local model. Preview mode is interactive;
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
    id: string
  }

export type ConfigFormRendererField<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormField<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  > & {
    /** Stable model id supplied by a designer/LowCode page model. */
    id: string
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
  /** Stable model id from the current node contract. */
  nodeId: string
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
  /** Optional state reader for overlays; renderer never mutates this state. */
  readState?: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => unknown
  /**
   * Design-only DOM attributes. Canonical node identity attributes always win,
   * so an editor can add focus/selection behavior without changing layout.
   */
  getNodeAttrs?: (metadata: ConfigFormRuntimeNodeMetadata<TValues>) => HTMLAttributes
}
