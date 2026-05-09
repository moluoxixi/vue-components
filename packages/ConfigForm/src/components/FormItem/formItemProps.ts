import { readPlainRecord } from '@/utils/object'

const FORM_ITEM_PROP_CONFLICT_MESSAGES: Record<string, string> = {
  field: 'formItemProps.field conflicts with field config; declare field on the field config instead',
  label: 'formItemProps.label conflicts with field.label; declare label on the field config instead',
}

/** 校验 FormItem 根节点透传属性不能覆盖字段配置派生的核心语义。 */
export function assertFormItemPropsNoConflict(formItemProps: Record<string, unknown>): void {
  for (const [key, message] of Object.entries(FORM_ITEM_PROP_CONFLICT_MESSAGES)) {
    if (Object.hasOwn(formItemProps, key))
      throw new TypeError(message)
  }
}

/**
 * 读取字段外壳根节点透传属性。
 *
 * 缺省时返回空对象；非普通对象直接抛错，避免把错误配置静默传入渲染层。
 */
export function readFormItemProps(value: unknown, optionName = 'formItemProps'): Record<string, unknown> {
  if (value === undefined)
    return {}

  const formItemProps = readPlainRecord(value, optionName)
  assertFormItemPropsNoConflict(formItemProps)
  return formItemProps
}
