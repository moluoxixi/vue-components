/** 判断自动生成的字段 id 是否可以安全下发到真实字段组件。 */
export function canBindGeneratedIdToComponent(component: unknown): boolean {
  if (typeof component === 'string')
    return true

  return !declaresComponentProp(component, 'id')
}

/** 判断组件是否显式声明某个 prop，避免自动 attrs 与 UI 组件同名 prop 冲突。 */
export function declaresComponentProp(component: unknown, propName: string): boolean {
  if (!isComponentOptionSource(component))
    return false
  if (!Object.hasOwn(component, 'props'))
    return false

  const propsOption = component.props
  if (Array.isArray(propsOption))
    return propsOption.includes(propName)
  if (isPlainRecord(propsOption))
    return Object.hasOwn(propsOption, propName)

  return false
}

/** 判断值是否可作为 Vue 组件选项来源读取静态属性。 */
function isComponentOptionSource(value: unknown): value is { props?: unknown } {
  return (typeof value === 'object' && value != null) || typeof value === 'function'
}

/** 判断值是否是可读取 key 的普通对象。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
