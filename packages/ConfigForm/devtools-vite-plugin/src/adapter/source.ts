import type { FieldSourceMeta, FormDevtoolsNode } from '../types'
import { isVNode } from 'vue'

export interface DevtoolsFieldConfig {
  component: unknown
  field: string
  label?: unknown
  __source?: FieldSourceMeta
}

export interface DevtoolsFormNodeConfig {
  component?: unknown
  field?: unknown
  id?: string
  label?: unknown
  props?: Record<string, unknown>
  slots?: Record<string, unknown>
  __source?: FieldSourceMeta
}

export interface DevtoolsRenderFunction {
  __source?: FieldSourceMeta
  name?: string
}

export interface DevtoolsCollectedFields {
  byReference: WeakSet<object>
}

/** 转义属性选择器中的源码 id，避免 querySelector 语法被用户路径破坏。 */
export function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 读取浏览器全局 devtools bridge。
 *
 * 服务端渲染或 client 尚未安装时返回 undefined，调用方据此跳过同步。
 */
export function getBridge() {
  if (typeof window === 'undefined')
    return undefined
  return window.__CONFIG_FORM_DEVTOOLS_BRIDGE__
}

/** 计算源码标记元素面积，用于在多个候选中选择可见度最高的元素。 */
export function resolveSourceElementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return rect.width * rect.height
}

/**
 * 从同一 source id 的 DOM 候选中选择最佳元素。
 *
 * 优先选择有面积的最大元素；全不可见时保留第一个候选便于后续显式定位。
 */
export function selectBestSourceElement(candidates: HTMLElement[]): HTMLElement | null {
  if (candidates.length === 0)
    return null

  const visibleCandidates = candidates
    .map(element => ({
      area: resolveSourceElementArea(element),
      element,
    }))
    .filter(candidate => candidate.area > 0)
    .sort((a, b) => b.area - a.area)

  return visibleCandidates[0]?.element ?? candidates[0]
}

/** 在指定根节点内查询带源码 id 的元素；字段根节点使用 id，容器节点使用 data 属性。 */
export function querySourceElements(root: ParentNode, sourceId: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    `[id="${escapeAttributeValue(sourceId)}"],[data-cf-devtools-source-id="${escapeAttributeValue(sourceId)}"]`,
  )]
}

/**
 * 根据源码元信息解析页面元素。
 *
 * 优先在当前表单宿主内查找，找不到时再全局查找，避免多表单同源节点互相抢占。
 */
export function resolveSourceElement(source: FieldSourceMeta | undefined, root: ParentNode | null): HTMLElement | null {
  if (typeof document === 'undefined' || !source)
    return null

  const scopedElement = root ? selectBestSourceElement(querySourceElements(root, source.id)) : null
  if (scopedElement)
    return scopedElement

  return selectBestSourceElement(querySourceElements(document, source.id))
}

/**
 * 解析 devtools 节点对应的可高亮 DOM 元素。
 *
 * 高亮定位只接受源码标记；字段节点必须把该标记绑定到实际字段 DOM 上。
 */
export function resolveElement(node: FormDevtoolsNode, root: ParentNode | null): HTMLElement | null {
  if (typeof document === 'undefined')
    return null

  return resolveSourceElement(node.source, root)
}

/**
 * 解析组件配置的可读名称。
 *
 * 支持字符串组件、函数组件和 Vue SFC 编译后的 name/__name 字段。
 */
export function resolveComponentName(component: unknown): string | undefined {
  if (typeof component === 'string')
    return component
  if (typeof component === 'function')
    return component.name || undefined
  if (!component || typeof component !== 'object')
    return undefined

  const record = component as Record<string, unknown>
  if (typeof record.name === 'string')
    return record.name
  if (typeof record.__name === 'string')
    return record.__name
  return undefined
}

/** 只接受字符串 label 进入 devtools 展示，动态 label 由 runtime 解析后再传入。 */
export function resolveLabel(label: unknown): string | undefined {
  return typeof label === 'string' ? label : undefined
}

/** 从节点配置中读取有效源码 id，空字符串按缺失处理。 */
export function resolveDevtoolsSourceId(node: DevtoolsFormNodeConfig): string | undefined {
  const id = node.__source?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/** 压缩 DOM 文本空白并过滤空结果，用于表单导航标签解析。 */
export function normalizeTextContent(value: string | null | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text && text.length > 0 ? text : undefined
}

/**
 * 解析 aria-labelledby 指向的第一个有效文本。
 *
 * 缺少 document 或引用元素不存在时返回 undefined，不伪造导航标签。
 */
export function resolveLabelledByText(labelledBy: string | null): string | undefined {
  if (typeof document === 'undefined' || !labelledBy)
    return undefined

  for (const id of labelledBy.split(/\s+/)) {
    const text = normalizeTextContent(document.getElementById(id)?.textContent)
    if (text)
      return text
  }

  return undefined
}

/** 查找表单宿主所在的 tabpanel 容器，用于多表单导航标签推导。 */
export function resolveTabPanel(host: HTMLElement | null): HTMLElement | null {
  return host?.closest<HTMLElement>('[role="tabpanel"]') ?? null
}

/**
 * 为多表单导航解析可读表单标签。
 *
 * 显式 data-cf-devtools-form-label 优先；tabpanel 的 aria 元数据只作为布局容器的标签来源。
 */
export function resolveFormLabel(host: HTMLElement | null): string | undefined {
  if (!host)
    return undefined

  const explicitLabelHost = host.closest<HTMLElement>('[data-cf-devtools-form-label]')
  const explicitLabel = normalizeTextContent(explicitLabelHost?.dataset.cfDevtoolsFormLabel)
  if (explicitLabel)
    return explicitLabel

  const tabPanel = resolveTabPanel(host)
  return normalizeTextContent(tabPanel?.getAttribute('aria-label'))
    ?? resolveLabelledByText(tabPanel?.getAttribute('aria-labelledby') ?? null)
}

/** 判断未知值是否是 devtools 可采集的节点配置。 */
export function isFormNodeConfig(value: unknown): value is DevtoolsFormNodeConfig {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && !isVNode(value)
    && 'component' in value,
  )
}

/** 判断节点配置是否是绑定表单值的真实字段节点。 */
export function isFieldNodeConfig(value: DevtoolsFormNodeConfig): value is DevtoolsFormNodeConfig & { field: string } {
  return typeof value.field === 'string'
}

/** 判断 slot 内容是否是 ConfigForm render 函数；函数不会被执行，只读取静态元数据。 */
export function isRenderFunction(value: unknown): value is DevtoolsRenderFunction {
  return typeof value === 'function'
}

/** render 函数的源码位置挂在函数对象本身，优先于外层 defineField 对象位置。 */
export function resolveRenderFunctionSource(value: unknown): FieldSourceMeta | undefined {
  return isRenderFunction(value) ? value.__source : undefined
}

/** 将核心字段拓扑收集结果转成快速索引，devtools 字段语义以核心收集器为准。 */
export function createCollectedFieldIndex(fields: readonly DevtoolsFieldConfig[]): DevtoolsCollectedFields {
  const byReference = new WeakSet<object>()

  for (const field of fields)
    byReference.add(field)

  return { byReference }
}

/** 判断节点是否是核心拓扑收集器确认过的真实字段。 */
export function isCollectedFieldNode(
  node: DevtoolsFormNodeConfig,
  fields: DevtoolsCollectedFields,
): node is DevtoolsFormNodeConfig & { field: string } {
  return isFieldNodeConfig(node)
    && fields.byReference.has(node)
}

/**
 * 静态解析 slot 内容用于 devtools 树采集。
 *
 * slot 与 ConfigForm 顶层 fields 采用同一声明协议；函数 slot 不再执行或推断。
 */
export function resolveSlotContent(slot: unknown): unknown {
  return slot
}

/**
 * 克隆节点配置并保留原型和不可枚举属性，避免丢失 defineField/runtime brand。
 */
export function cloneFormNodeConfig<TNode extends DevtoolsFormNodeConfig>(node: TNode): TNode {
  const clone = Object.create(Object.getPrototypeOf(node)) as TNode
  Object.defineProperties(clone, Object.getOwnPropertyDescriptors(node))
  return clone
}
