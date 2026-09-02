import type { ZodTypeAny } from 'zod'
import type {
  DefinedFormNodeConfig,
  FieldConfig,
  FormValues,
  NormalizedFieldConfig,
  ValidateTrigger,
} from '../types'
import type {
  DefinedComponentNodeConfig,
  DefinedFieldConfig,
  DefineFieldComponentNodeConfig,
  DefineFieldDefaultValueConfig,
  DefineFieldFactory,
  DefineFieldSchemaConfig,
  DefineFieldsFactory,
  DefineFieldUnknownValueConfig,
  FormNodeInput,
} from '../types/field'
import { applyFieldDefaults, normalizeValidateOn } from '../plugins/defaults'

export { normalizeValidateOn }

/**
 * 将公开字段声明委托给内置默认应用函数，保持默认值来源唯一。
 *
 * 该 helper 仅保留给插件测试和低层工具使用；组件链路统一通过 transformField(field)。
 */
export function normalizeField(input: FieldConfig): NormalizedFieldConfig {
  return applyFieldDefaults(input) as NormalizedFieldConfig
}

/** 判断字段是否需要响应当前校验触发时机。 */
export function shouldValidateOn(field: Pick<NormalizedFieldConfig, 'validateOn'>, trigger: ValidateTrigger): boolean {
  return field.validateOn.includes(trigger)
}

/** 在提交阶段执行字段 transform；未声明时原样返回。 */
export function applyFieldTransform(
  field: Pick<NormalizedFieldConfig, 'transform'>,
  value: unknown,
  allValues: FormValues,
): unknown {
  return field.transform ? field.transform(value, allValues) : value
}

/**
 * 根据 schema/defaultValue 自动推导字段值类型，根据 component 自动推导 props 类型。
 *
 * 返回值保持为普通对象；不传 `field` 时创建容器节点，仅渲染结构，不绑定表单值。
 *
 * @example
 * ```ts
 * const nameField = defineField({
 *   field: 'name',
 *   component: Input,
 *   defaultValue: '',
 *   validator: value => value.length > 0 ? undefined : '必填',
 * })
 * ```
 */

/** 根据 schema 推导字段值类型；传入表单模型泛型时同时约束字段名和回调 values。 */
export function defineField<
  TValues extends object = FormValues,
  C = unknown,
  TSchema extends ZodTypeAny = ZodTypeAny,
  TField extends string = string,
>(
  config: DefineFieldSchemaConfig<NoInfer<TValues>, C, TSchema, TField>,
): DefinedFieldConfig<DefineFieldSchemaConfig<TValues, C, TSchema, TField>>

/** 根据 defaultValue 推导字段值类型；传入表单模型泛型时以模型字段值为准。 */
export function defineField<
  TValues extends object = FormValues,
  C = unknown,
  TValue = unknown,
  TField extends string = string,
>(
  config: DefineFieldDefaultValueConfig<NoInfer<TValues>, C, TValue, TField>,
): DefinedFieldConfig<DefineFieldDefaultValueConfig<TValues, C, TValue, TField>>

/** 没有 schema/defaultValue 时字段值保持 unknown，传入表单模型泛型时仍约束字段名。 */
export function defineField<
  TValues extends object = FormValues,
  C = unknown,
  TField extends string = string,
>(
  config: DefineFieldUnknownValueConfig<NoInfer<TValues>, C, TField>,
): DefinedFieldConfig<DefineFieldUnknownValueConfig<TValues, C, TField>>

/** 定义用于 slot 或顶层布局的容器节点。 */
export function defineField<
  TValues extends object = FormValues,
  C = unknown,
>(
  config: DefineFieldComponentNodeConfig<NoInfer<TValues>, C>,
): DefinedComponentNodeConfig<DefineFieldComponentNodeConfig<TValues, C>>

/** 所有 defineField 重载共用的运行时实现，只负责复制配置，不写入隐藏标记。 */
export function defineField(config: FormNodeInput): DefinedFormNodeConfig {
  return { ...config }
}

/**
 * 先绑定表单模型，再返回可解构的字段工厂。
 *
 * 工厂只提供类型上下文，不保存运行时状态；返回的 defineField 仍然只复制字段配置。
 */
export function defineFields<TValues extends object = FormValues>(): DefineFieldsFactory<TValues> {
  return {
    defineField: defineField as unknown as DefineFieldFactory<TValues>,
  }
}
