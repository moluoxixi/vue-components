import type {
  ConfigFormDefaultSlotContext,
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { PublicProps, VNode } from 'vue'
import type {
  ConfigFormRendererEmits,
  ConfigFormRendererExpose,
  ConfigFormRendererProps,
  ConfigFormRuntimeEventPayload,
} from './renderer/types'
import ConfigFormRendererSource from './renderer/ConfigFormRenderer.vue'

export { createConfigFormRendererExpose } from './renderer/expose'
export { withConfigFormInstall } from './renderer/install'
export type { InstallableConfigFormComponent } from './renderer/install'
export { resolveConfigFormFieldLayout } from './renderer/layout'
export type * from './renderer/layout'
export { resolveConfigFormLayout, resolveConfigFormNodeSpan } from './renderer/responsive'
export type * from './renderer/responsive'
export type * from './renderer/types'

export type ConfigFormRendererComponentProps<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererProps<TValues> & {
    'modelValue': TValues
    'onChange'?: (values: TValues) => unknown
    'onError'?: (errors: ConfigFormErrors) => unknown
    'onFieldChange'?: (payload: ConfigFormFieldChangePayload<TValues>) => unknown
    'onMetaChange'?: (meta: ConfigFormMeta) => unknown
    'onRuntimeEvent'?: (context: ConfigFormRuntimeEventPayload<TValues>) => unknown
    'onSubmit'?: (values: TValues) => unknown
    'onUpdate:modelValue'?: (value: TValues) => unknown
  }

export type ConfigFormRendererComponentInstance<
  TValues extends ConfigFormValues = ConfigFormValues,
> = ConfigFormRendererExpose<TValues> & {
  $emit: ConfigFormRendererEmits<TValues> & ((event: 'update:modelValue', value: TValues) => void)
  $props: ConfigFormRendererComponentProps<TValues>
  $slots: {
    default?: (props: ConfigFormDefaultSlotContext<TValues>) => unknown
  }
}

interface ConfigFormRendererComponentSetup<TValues extends ConfigFormValues> {
  attrs: Record<string, unknown>
  emit: ConfigFormRendererComponentInstance<TValues>['$emit']
  expose: (exposed: ConfigFormRendererExpose<TValues>) => void
  props: ConfigFormRendererComponentProps<TValues> & PublicProps
  slots: ConfigFormRendererComponentInstance<TValues>['$slots']
}

export interface ConfigFormRendererComponent {
  <TValues extends ConfigFormValues = ConfigFormValues>(
    props: ConfigFormRendererComponentSetup<TValues>['props'],
    context?: Pick<ConfigFormRendererComponentSetup<TValues>, 'attrs' | 'emit' | 'slots'>,
    exposed?: ConfigFormRendererComponentSetup<TValues>['expose'],
    setup?: Promise<ConfigFormRendererComponentSetup<TValues>>,
  ): VNode & { __ctx?: ConfigFormRendererComponentSetup<TValues> }
}

export const ConfigFormRenderer = ConfigFormRendererSource as unknown as ConfigFormRendererComponent

/** Shared Design/Preview renderer with the same stable public signature. */
export const RuntimeSurface = ConfigFormRenderer
