import type {
  ConfigFormFieldValue,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ShallowRef } from 'vue'
import type { ConfigFormRendererExpose } from './types'

/** 创建稳定的公开方法代理，renderer 挂载后始终读取最新实例。 */
export function createConfigFormRendererExpose<TValues extends ConfigFormValues = ConfigFormValues>(
  rendererRef: Readonly<ShallowRef<ConfigFormRendererExpose<TValues> | null>>,
): ConfigFormRendererExpose<TValues> {
  function readRenderer(): ConfigFormRendererExpose<TValues> {
    const renderer = rendererRef.value
    if (!renderer)
      throw new Error('ConfigFormRenderer is not mounted.')
    return renderer
  }

  function getValue<TField extends string>(
    field: TField,
  ): ConfigFormFieldValue<TValues, TField> {
    return readRenderer().getValue(field)
  }

  function setValue<TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ): void {
    readRenderer().setValue(field, value)
  }

  function setValues(values: Partial<TValues>, replace?: false): void
  function setValues(values: TValues, replace: true): void
  function setValues(
    ...args: [values: Partial<TValues>, replace?: false] | [values: TValues, replace: true]
  ): void {
    if (args[1] === true)
      readRenderer().setValues(args[0], true)
    else
      readRenderer().setValues(args[0])
  }

  return {
    clearValidate: fields => readRenderer().clearValidate(fields),
    getErrors: () => readRenderer().getErrors(),
    getValidating: () => readRenderer().getValidating(),
    getValue,
    getValues: () => readRenderer().getValues(),
    resetFields: fields => readRenderer().resetFields(fields),
    scrollToField: field => readRenderer().scrollToField(field),
    setValue,
    setValues,
    submit: () => readRenderer().submit(),
    validate: () => readRenderer().validate(),
    validateField: (field, trigger) => readRenderer().validateField(field, trigger),
  }
}
