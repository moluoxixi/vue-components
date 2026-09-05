import type { VNode } from 'vue'
import type { ConfigFormProps, FormErrors } from './src/types'
import ConfigFormComponent from './src/index.vue'

export { FormLayout } from './src/components'
export { useForm } from './src/composables'
export type { UseFormOptions } from './src/composables'
export { ConfigFormError } from './src/errors'
export const ConfigForm = ConfigFormComponent as unknown as {
  <T extends object = Record<string, unknown>>(
    props: ConfigFormProps<T> & {
      onError?: (errors: FormErrors) => unknown
      onSubmit?: (values: T) => unknown
    },
  ): VNode
}
export * from './src/renderer'
export type {
  ComponentRegistry,
  ConfigFormComponentRegistration,
  FormRuntimeOptions,
  ReadonlyAdapter,
  ReadonlyAdapterRegistry,
  ReadonlyRenderContext,
} from './src/runtime'
export type {
  ConfigFormEmits,
  ConfigFormExpose,
  ConfigFormProps,
  FieldCondition,
  FieldConfig,
  FieldKey,
  FieldSchema,
  FieldValidator,
  FieldValidatorResult,
  FormErrors,
  FormNodeConfig,
  FormValues,
  NormalizedFieldConfig,
  RenderContext,
  RenderFunction,
  RenderSlotInvoker,
  ResolvedBoundNode,
  ResolvedComponentField,
  ResolvedComponentNode,
  ResolvedField,
  ResolvedFormNode,
  ResolvedSlotContent,
  RuntimeText,
  SlotContent,
  ValidateTrigger,
} from './src/types'
export type { AdaptedVueFunctionalComponent } from './src/types'
export { asVueFunctionalComponent, defineField, defineFields } from './src/utils'
