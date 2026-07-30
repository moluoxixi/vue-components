import type {
  ConfigFormFieldChangePayload,
  ConfigFormFieldChangeRequest,
  ConfigFormFieldKey,
  ConfigFormValues,
} from './types'

export interface ConfigFormModelAdapter<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 读取当前模型；controller 每次操作都会重新读取，兼容响应式状态与外部替换。 */
  read: () => TValues
  /** 整体写回下一份模型。 */
  write: (values: TValues) => void
}

export interface ConfigFormControllerOptions<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 对宿主模型的最小读写适配，不绑定 Vue ref 或具体状态库。 */
  model: ConfigFormModelAdapter<TValues>
  /** 单字段写入后的通知。 */
  onFieldChange?: (payload: ConfigFormFieldChangePayload<TValues>) => void
  /** 任意模型写入后的通知。 */
  onChange?: (values: TValues) => void
}

export type ConfigFormFieldValue<
  TValues extends ConfigFormValues,
  TField extends string,
> = TField extends ConfigFormFieldKey<TValues> ? TValues[TField] : unknown

export interface ConfigFormController<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 应用渲染器上报的字段变更请求。 */
  applyFieldChange: (request: ConfigFormFieldChangeRequest<TValues>) => void
  /** 获取当前模型的浅拷贝。 */
  getValues: () => TValues
  /** 获取指定字段值。 */
  getValue: <TField extends string>(field: TField) => ConfigFormFieldValue<TValues, TField>
  /** 写入指定字段，并依次触发 fieldChange 与 change。 */
  setValue: <TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ) => void
  /** 合并或整体替换模型，并触发 change。 */
  setValues: {
    (values: Partial<TValues>, replace?: false): void
    (values: TValues, replace: true): void
  }
}

/**
 * 创建与 UI 无关的 ConfigForm 模型控制器。
 *
 * controller 只约定不可变写回与事件顺序，不感知 Vue、校验器、布局或字段组件，
 * 因此可复用于任意 UI adapter，也便于独立测试模型行为。
 */
export function createConfigFormController<TValues extends ConfigFormValues = ConfigFormValues>(
  options: ConfigFormControllerOptions<TValues>,
): ConfigFormController<TValues> {
  function getValues(): TValues {
    return { ...options.model.read() }
  }

  function getValue(field: string): unknown {
    return options.model.read()[field]
  }

  function commitValues(values: TValues): void {
    options.model.write(values)
    options.onChange?.(values)
  }

  function setValue(field: string, value: unknown): void {
    const values = {
      ...options.model.read(),
      [field]: value,
    } as TValues

    options.model.write(values)
    options.onFieldChange?.({ field, value, values })
    options.onChange?.(values)
  }

  function setValues(values: Partial<TValues>, replace = false): void {
    commitValues((replace ? values : { ...options.model.read(), ...values }) as TValues)
  }

  return {
    applyFieldChange: request => setValue(request.field, request.value),
    getValue: getValue as ConfigFormController<TValues>['getValue'],
    getValues,
    setValue: setValue as ConfigFormController<TValues>['setValue'],
    setValues: setValues as ConfigFormController<TValues>['setValues'],
  }
}
