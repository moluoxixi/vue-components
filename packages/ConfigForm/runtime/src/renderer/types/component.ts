import type {
  ConfigFormDefaultSlotContext,
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { PublicProps, VNode } from 'vue'
import type { ConfigFormPageRuntimeDataSourceStateChange } from '../../runtime'
import type { ConfigFormRendererEmits } from './emits'
import type { ConfigFormRendererExpose } from './expose'
import type { ConfigFormRendererProps } from './props'

export type ConfigFormRendererComponentProps<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererProps<TValues> & {
    onChange?: (values: TValues) => unknown
    onError?: (errors: ConfigFormErrors) => unknown
    onErrorsChange?: (errors: ConfigFormErrors) => unknown
    onFieldChange?: (payload: ConfigFormFieldChangePayload<TValues>) => unknown
    onMetaChange?: (meta: ConfigFormMeta) => unknown
    onVariablesChange?: (variables: Readonly<Record<string, unknown>>) => unknown
    onDataSourceStateChange?: (change: ConfigFormPageRuntimeDataSourceStateChange) => unknown
    onSubmit?: (values: TValues) => unknown
  }

export type ConfigFormRendererComponentInstance<
  TValues extends ConfigFormValues = ConfigFormValues,
> = ConfigFormRendererExpose<TValues> & {
  $emit: ConfigFormRendererEmits<TValues>
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
