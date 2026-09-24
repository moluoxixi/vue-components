import type {
  ConfigFormFieldSelector,
  ConfigFormFieldValue,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ShallowRef } from 'vue'
import type { ConfigFormRendererExpose } from '../types'

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

  function setTouched(): void
  function setTouched(touched: boolean): void
  function setTouched(fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  function setTouched(
    fieldsOrTouched?: ConfigFormFieldSelector<TValues> | boolean,
    touched?: boolean,
  ): void {
    if (fieldsOrTouched === undefined)
      readRenderer().setTouched()
    else if (typeof fieldsOrTouched === 'boolean')
      readRenderer().setTouched(fieldsOrTouched)
    else
      readRenderer().setTouched(fieldsOrTouched, touched)
  }

  return {
    appendRow: (scopeId, value, parentScope) => readRenderer().appendRow(scopeId, value, parentScope),
    applyFieldInstanceChange: request => readRenderer().applyFieldInstanceChange(request),
    clearInstanceValidate: addresses => readRenderer().clearInstanceValidate(addresses),
    clearValidate: fields => readRenderer().clearValidate(fields),
    duplicateRow: (scopeId, rowId, parentScope) => readRenderer().duplicateRow(scopeId, rowId, parentScope),
    getDataSourceState: (sourceId, options) => readRenderer().getDataSourceState(sourceId, options),
    getErrors: () => readRenderer().getErrors(),
    getFieldMeta: field => readRenderer().getFieldMeta(field),
    getInstanceErrors: address => readRenderer().getInstanceErrors(address),
    getInstanceKey: address => readRenderer().getInstanceKey(address),
    getInstanceMeta: address => readRenderer().getInstanceMeta(address),
    getInstanceValue: address => readRenderer().getInstanceValue(address),
    getIssues: () => readRenderer().getIssues(),
    getMeta: () => readRenderer().getMeta(),
    getOptionState: address => readRenderer().getOptionState(address),
    getValidating: () => readRenderer().getValidating(),
    getValue,
    getValues: () => readRenderer().getValues(),
    getVariables: () => readRenderer().getVariables(),
    insertRow: (scopeId, index, value, parentScope) => readRenderer().insertRow(scopeId, index, value, parentScope),
    isInstanceValidating: address => readRenderer().isInstanceValidating(address),
    listFieldInstances: nodeId => readRenderer().listFieldInstances(nodeId),
    listRows: (scopeId, parentScope) => readRenderer().listRows(scopeId, parentScope),
    loadDataSource: (sourceId, options) => readRenderer().loadDataSource(sourceId, options),
    moveRow: (scopeId, rowId, toIndex, parentScope) => readRenderer().moveRow(scopeId, rowId, toIndex, parentScope),
    removeRow: (scopeId, rowId, parentScope) => readRenderer().removeRow(scopeId, rowId, parentScope),
    resetFields: fields => readRenderer().resetFields(fields),
    scrollToField: field => readRenderer().scrollToField(field),
    setErrors: errors => readRenderer().setErrors(errors),
    setInstanceTouched: (address, touched) => readRenderer().setInstanceTouched(address, touched),
    setInstanceValue: (address, value) => readRenderer().setInstanceValue(address, value),
    setTouched,
    setValue,
    setValues,
    submit: () => readRenderer().submit(),
    validate: () => readRenderer().validate(),
    validateField: (field, trigger) => readRenderer().validateField(field, trigger),
    validateInstance: (address, trigger) => readRenderer().validateInstance(address, trigger),
  }
}
