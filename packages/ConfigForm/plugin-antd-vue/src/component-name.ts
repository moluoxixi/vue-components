import type { FieldConfig } from '@moluoxixi/config-form/plugins'

/**
 * 读取组件的名称。
 *
 * 字符串组件直接返回；对象/函数组件统一读 `.name`，用于插件内部查绑定表。
 */
export function resolveComponentName(component: FieldConfig['component']): string | undefined {
  if (typeof component === 'string')
    return component

  if (!component)
    return undefined

  const name = (component as { name?: unknown }).name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

/**
 * 判断组件名是否像 Ant Design Vue 组件名。
 *
 * 该判断仅用于 strict 诊断，不参与默认适配，避免误伤自定义组件。
 */
export function isAntdVueLikeComponentName(name: string): boolean {
  return /^A[A-Z]/.test(name)
}
