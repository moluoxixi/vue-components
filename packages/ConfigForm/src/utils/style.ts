import type { CSSProperties, StyleValue } from 'vue'

/** 将 labelWidth 统一为 CSS 可消费的宽度字符串。 */
export function resolveLabelWidth(width?: string | number): string | undefined {
  if (!width)
    return undefined
  return typeof width === 'number' ? `${width}px` : width
}

/** 判断传入值是否是 Vue 可消费的 style 对象。 */
function isStyleObject(value: unknown): value is CSSProperties {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** 校验并读取用户透传的 Vue style 值，非法 style 直接抛错暴露配置问题。 */
export function readStyleValue(value: unknown, propertyName = 'props.style'): StyleValue | undefined {
  if (value == null || value === false)
    return undefined

  if (typeof value === 'string' || isStyleObject(value) || Array.isArray(value))
    return value

  throw new TypeError(`${propertyName} must be a Vue style value`)
}

/** 合并基础 style 和用户 style；字符串/数组 style 交给 Vue 的数组 style 语义处理。 */
export function mergeStyle(
  baseStyle: CSSProperties | undefined,
  existingStyle: StyleValue | undefined,
): StyleValue | undefined {
  if (!baseStyle)
    return existingStyle
  if (!existingStyle)
    return baseStyle
  if (isStyleObject(existingStyle))
    return { ...baseStyle, ...existingStyle }
  return [baseStyle, existingStyle]
}
