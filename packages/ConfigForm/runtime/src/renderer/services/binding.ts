import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type {
  ConfigFormComponentRegistration,
  ConfigFormControlBinding,
  ConfigFormRendererField,
  ConfigFormRendererProps,
} from '../types'
import type { RendererBindingService } from '../types/internal'
import { isConfigFormComponentRegistration } from '@moluoxixi/config-form-headless'
import { markRaw, toRaw } from 'vue'
import { isObjectValue } from './metadata'

export function createRendererBindingService<TValues extends ConfigFormValues>(
  props: Readonly<ConfigFormRendererProps<TValues>>,
): RendererBindingService<TValues> {
  function resolveBinding(
    field: ConfigFormRendererField<TValues>,
    registration?: ConfigFormComponentRegistration,
  ): ConfigFormControlBinding {
    const adapterBinding = props.resolveBinding?.(field)
    return {
      trigger: field.trigger ?? registration?.trigger ?? adapterBinding?.trigger ?? props.defaultTrigger ?? 'update:modelValue',
      valueProp: field.valueProp ?? registration?.valueProp ?? adapterBinding?.valueProp ?? props.defaultValueProp ?? 'modelValue',
    }
  }

  function resolveRegistration(component: Component | string): ConfigFormComponentRegistration | undefined {
    if (typeof component !== 'string')
      return undefined

    if (!props.components || !Object.hasOwn(props.components, component))
      return undefined

    const registered = props.components[component]
    if (registered === undefined)
      return undefined
    return isConfigFormComponentRegistration(registered)
      ? registered
      : { component: registered }
  }

  return {
    resolveBinding,
    resolveComponent,
    resolveRegistration,
  }
}

export function resolveComponent<TComponent extends Component | string>(component: TComponent): TComponent {
  if (isObjectValue(component))
    return markRaw(toRaw(component)) as TComponent
  return component
}
