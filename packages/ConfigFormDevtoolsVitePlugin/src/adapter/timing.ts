import type { FormNodeRenderPhase } from '../types'
import type { DevtoolsFormNodeConfig } from './source'
import { ConfigFormDevtoolsPluginError } from '../types'
import { resolveDevtoolsSourceId } from './source'

type ExposedHook = (...args: unknown[]) => void
interface RenderMetric {
  duration: number
  id: string
  phase: FormNodeRenderPhase
  timestamp: number
}

/** 读取高精度时间戳，非浏览器性能 API 环境下退回 Date.now。 */
export function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

/** 转义属性选择器中的源码 id，避免 querySelector 语法被用户路径破坏。 */
export function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** 调用 Vue VNode 生命周期 hook。 */
function callVNodeHook(hook: unknown, args: unknown[]) {
  if (Array.isArray(hook)) {
    for (const item of hook)
      callVNodeHook(item, args)
    return
  }

  if (typeof hook === 'function')
    (hook as ExposedHook)(...args)
}

/**
 * 合并 adapter 注入的 vnode 生命周期 hook 与用户已有 hook。
 *
 * 采集开始点放在用户 hook 后，结束点放在用户 hook 前，避免把用户 hook 执行时间算进渲染耗时。
 */
function mergeVNodeHook(
  existing: unknown,
  injected: ExposedHook,
  order: 'before-existing' | 'after-existing',
): ExposedHook {
  if (!existing)
    return injected

  return (...args: unknown[]) => {
    if (order === 'before-existing')
      injected(...args)

    callVNodeHook(existing, args)

    if (order === 'after-existing')
      injected(...args)
  }
}

/**
 * 创建节点渲染计时 props 工厂。
 *
 * 每个 adapter 实例持有独立的开始时间表，避免多个表单互相污染样本。
 */
export function createRenderTimingPropsFactory(recordRender: (metric: RenderMetric) => void) {
  const renderStarts = new Map<string, number>()

  /** 记录节点一次 Vue 渲染阶段的开始时间。 */
  function startRenderTiming(id: string) {
    renderStarts.set(id, now())
  }

  /**
   * 完成节点渲染耗时采样并写入 bridge。
   *
   * 缺少开始时间时说明 hook 顺序不完整，本次样本会被跳过。
   */
  function finishRenderTiming(id: string, phase: FormNodeRenderPhase) {
    const start = renderStarts.get(id)
    if (start === undefined)
      return

    renderStarts.delete(id)
    const end = now()
    recordRender({
      duration: Math.max(0, end - start),
      id,
      phase,
      timestamp: now(),
    })
  }

  /**
   * 给节点 props 注入 VNode 生命周期计时 hook。
   *
   * 会合并用户已有 hook，避免覆盖调用方自定义生命周期逻辑。
   */
  return function withRenderTimingProps(id: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
    const next = { ...(props ?? {}) }

    next.onVnodeBeforeMount = mergeVNodeHook(
      props?.onVnodeBeforeMount,
      () => startRenderTiming(id),
      'after-existing',
    )
    next.onVnodeMounted = mergeVNodeHook(
      props?.onVnodeMounted,
      () => finishRenderTiming(id, 'mount'),
      'before-existing',
    )
    next.onVnodeBeforeUpdate = mergeVNodeHook(
      props?.onVnodeBeforeUpdate,
      () => startRenderTiming(id),
      'after-existing',
    )
    next.onVnodeUpdated = mergeVNodeHook(
      props?.onVnodeUpdated,
      () => finishRenderTiming(id, 'update'),
      'before-existing',
    )

    return next
  }
}

/**
 * 给目标 props 注入源码定位属性。
 *
 * 已存在冲突属性时直接抛错，避免页面 DOM 指向错误源码位置。
 */
export function withDevtoolsSourceProps(
  node: DevtoolsFormNodeConfig,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const sourceId = resolveDevtoolsSourceId(node)
  if (!sourceId)
    return props

  const existing = props['data-cf-devtools-source-id']
  if (existing !== undefined && existing !== sourceId) {
    throw new ConfigFormDevtoolsPluginError(
      `Conflicting data-cf-devtools-source-id: expected ${sourceId}, received ${String(existing)}`,
      {
        existing,
        sourceId,
      },
    )
  }

  return {
    ...props,
    'data-cf-devtools-source-id': sourceId,
  }
}

/**
 * 合并节点计时属性和源码定位属性。
 *
 * 字段节点不注入源码属性，避免落到内部输入组件上。
 */
export function withDevtoolsNodeProps(
  id: string,
  node: DevtoolsFormNodeConfig,
  withRenderTimingProps: (id: string, props: Record<string, unknown> | undefined) => Record<string, unknown>,
): Record<string, unknown> {
  const props = withRenderTimingProps(id, node.props)
  return typeof node.field === 'string' ? props : withDevtoolsSourceProps(node, props)
}

/**
 * 给字段配置写入源码定位 id。
 *
 * 真实控件仍只接收 node.props；id 不改变核心字段/组件分类。
 * 当核心因 label 渲染 FormItem 时，该 id 才会落到字段外壳根节点。
 */
export function withDevtoolsFieldId(node: DevtoolsFormNodeConfig): string | undefined {
  if (typeof node.field !== 'string')
    return node.id

  const sourceId = resolveDevtoolsSourceId(node)
  if (!sourceId)
    return node.id

  if (node.id !== undefined && node.id !== sourceId) {
    throw new ConfigFormDevtoolsPluginError(
      `Conflicting field id: expected ${sourceId}, received ${node.id}`,
      {
        expectedId: sourceId,
        receivedId: node.id,
      },
    )
  }

  return sourceId
}
