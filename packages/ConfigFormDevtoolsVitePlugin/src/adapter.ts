import type { Component } from 'vue'
import type { FieldSourceMeta, FormDevtoolsBridge, FormDevtoolsNode, FormNodeRenderPhase } from './types'
import { computed, defineComponent, h, isVNode, nextTick, onMounted, onUnmounted, onUpdated, ref, useAttrs } from 'vue'

interface DevtoolsFieldConfig {
  component: unknown
  field: string
  label?: unknown
  __source?: FieldSourceMeta
}

interface DevtoolsFormNodeConfig {
  component?: unknown
  field?: unknown
  label?: unknown
  props?: Record<string, unknown>
  slots?: Record<string, unknown>
  __source?: FieldSourceMeta
}

export interface DevtoolsConfigFormAdapterOptions {
  /** 开发服务中要包裹的核心 ConfigForm 组件。 */
  ConfigForm: Component
  /** 核心字段收集器，用来保持真实字段与容器节点语义一致。 */
  collectFieldConfigs: (nodes: readonly unknown[]) => DevtoolsFieldConfig[]
}

type ExposedConfigForm = Record<string, unknown>
type VNodeLifecycleHook = (...args: unknown[]) => void

declare global {
  interface Window {
    __CONFIG_FORM_DEVTOOLS_BRIDGE__?: FormDevtoolsBridge
  }
}

const READY_EVENT = 'config-form-devtools:ready'
const SOURCE_ID_ATTRIBUTE = 'data-cf-devtools-source-id'
const EXPOSED_METHODS = [
  'submit',
  'validate',
  'validateField',
  'reset',
  'setValue',
  'setValues',
  'getValue',
  'getValues',
  'clearValidate',
] as const

let formSeed = 0

/** 读取高精度时间戳，非浏览器性能 API 环境下退回 Date.now。 */
function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

/** 转义属性选择器中的源码 id，避免 querySelector 语法被用户路径破坏。 */
function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 读取浏览器全局 devtools bridge。
 *
 * 服务端渲染或 client 尚未安装时返回 undefined，调用方据此跳过同步。
 */
function getBridge(): FormDevtoolsBridge | undefined {
  if (typeof window === 'undefined')
    return undefined
  return window.__CONFIG_FORM_DEVTOOLS_BRIDGE__
}

/** 计算源码标记元素面积，用于在多个候选中选择可见度最高的元素。 */
function resolveSourceElementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return rect.width * rect.height
}

/**
 * 从同一 source id 的 DOM 候选中选择最佳元素。
 *
 * 优先选择有面积的最大元素；全不可见时保留第一个候选便于后续显式定位。
 */
function selectBestSourceElement(candidates: HTMLElement[]): HTMLElement | null {
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

/** 在指定根节点内查询带源码 id 的元素。 */
function querySourceElements(root: ParentNode, sourceId: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    `[${SOURCE_ID_ATTRIBUTE}="${escapeAttributeValue(sourceId)}"]`,
  )]
}

/**
 * 根据源码元信息解析页面元素。
 *
 * 优先在当前表单宿主内查找，找不到时再全局查找，避免多表单同源节点互相抢占。
 */
function resolveSourceElement(source: FieldSourceMeta | undefined, root: ParentNode | null): HTMLElement | null {
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
function resolveElement(node: FormDevtoolsNode, root: ParentNode | null): HTMLElement | null {
  if (typeof document === 'undefined')
    return null

  const sourceElement = resolveSourceElement(node.source, root)
  if (sourceElement)
    return sourceElement
  return null
}

/**
 * 解析组件配置的可读名称。
 *
 * 支持字符串组件、函数组件和 Vue SFC 编译后的 name/__name 字段。
 */
function resolveComponentName(component: unknown): string | undefined {
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
function resolveLabel(label: unknown): string | undefined {
  return typeof label === 'string' ? label : undefined
}

/** 从节点配置中读取有效源码 id，空字符串按缺失处理。 */
function resolveDevtoolsSourceId(node: DevtoolsFormNodeConfig): string | undefined {
  const id = node.__source?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/** 压缩 DOM 文本空白并过滤空结果，用于表单导航标签解析。 */
function normalizeTextContent(value: string | null | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text && text.length > 0 ? text : undefined
}

/**
 * 解析 aria-labelledby 指向的第一个有效文本。
 *
 * 缺少 document 或引用元素不存在时返回 undefined，不伪造导航标签。
 */
function resolveLabelledByText(labelledBy: string | null): string | undefined {
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
function resolveTabPanel(host: HTMLElement | null): HTMLElement | null {
  return host?.closest<HTMLElement>('[role="tabpanel"]') ?? null
}

/**
 * 为多表单导航解析可读表单标签。
 *
 * 显式 data-cf-devtools-form-label 优先；tabpanel 的 aria 元数据只作为布局容器的标签来源。
 */
function resolveFormLabel(host: HTMLElement | null): string | undefined {
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

/**
 * 判断未知值是否是 devtools 可采集的节点配置。
 *
 * VNode 和数组不会被当作字段/容器节点，避免 slot 渲染内容污染拓扑。
 */
function isFormNodeConfig(value: unknown): value is DevtoolsFormNodeConfig {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && !isVNode(value)
    && 'component' in value,
  )
}

/** 判断节点配置是否是绑定表单值的真实字段节点。 */
function isFieldNodeConfig(value: DevtoolsFormNodeConfig): value is DevtoolsFormNodeConfig & { field: string } {
  return typeof value.field === 'string'
}

/**
 * 静态解析 slot 内容用于 devtools 树采集。
 *
 * slot 与 ConfigForm 顶层 fields 采用同一声明协议；函数 slot 不再执行或推断。
 */
function resolveSlotContent(slot: unknown): unknown {
  return slot
}

/**
 * 克隆节点配置并保留原型和不可枚举属性，避免丢失 defineField/runtime brand。
 */
function cloneFormNodeConfig<TNode extends DevtoolsFormNodeConfig>(node: TNode): TNode {
  const clone = Object.create(Object.getPrototypeOf(node)) as TNode
  Object.defineProperties(clone, Object.getOwnPropertyDescriptors(node))
  return clone
}

/**
 * 调用 Vue VNode 生命周期 hook。
 *
 * 支持 Vue 合并后的 hook 数组；hook 抛错时保持原始异常向上传递。
 */
function callVNodeHook(hook: unknown, args: unknown[]) {
  if (Array.isArray(hook)) {
    for (const item of hook)
      callVNodeHook(item, args)
    return
  }

  if (typeof hook === 'function')
    (hook as VNodeLifecycleHook)(...args)
}

/**
 * 合并 adapter 注入的 vnode 生命周期 hook 与用户已有 hook。
 *
 * 采集开始点放在用户 hook 后，结束点放在用户 hook 前，避免把用户 hook 执行时间算进渲染耗时。
 */
function mergeVNodeHook(
  existing: unknown,
  injected: VNodeLifecycleHook,
  order: 'before-existing' | 'after-existing',
): VNodeLifecycleHook {
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
 * 包裹 ConfigForm 并注册 devtools，同时保留核心组件暴露的 ref API。
 *
 * adapter 会收集声明式节点树、映射真实 DOM、代理内部 ConfigForm 方法，
 * 并在 mount/update/unmount 阶段同步浏览器 bridge。
 */
export function createDevtoolsConfigFormAdapter(options: DevtoolsConfigFormAdapterOptions): Component {
  return defineComponent({
    inheritAttrs: false,
    name: 'ConfigFormDevtoolsAdapter',
    props: {
      fields: { type: Array, required: true },
      namespace: { type: String, default: 'cf' },
    },
    /**
     * 建立 adapter 与核心 ConfigForm 的桥接。
     *
     * setup 内只代理 props、ref API 和 devtools 采集，不改写核心表单控制器行为。
     */
    setup(props, { expose, slots }) {
      const attrs = useAttrs()
      const formId = `cf-form-${++formSeed}`
      const coreRef = ref<ExposedConfigForm | null>(null)
      const hostRef = ref<HTMLElement | null>(null)
      const registeredIds = new Set<string>()
      const renderStarts = new Map<string, number>()
      let syncQueued = false

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
        getBridge()?.recordRender({
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
      function withRenderTimingProps(id: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
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

      /**
       * 给节点 props 注入源码定位属性。
       *
       * 已存在冲突属性时直接抛错，避免页面 DOM 指向错误源码位置。
       */
      function withDevtoolsSourceProps(
        node: DevtoolsFormNodeConfig,
        props: Record<string, unknown>,
      ): Record<string, unknown> {
        const sourceId = resolveDevtoolsSourceId(node)
        if (!sourceId)
          return props

        const existing = props[SOURCE_ID_ATTRIBUTE]
        if (existing !== undefined && existing !== sourceId) {
          throw new Error(
            `Conflicting ${SOURCE_ID_ATTRIBUTE}: expected ${sourceId}, received ${String(existing)}`,
          )
        }

        return {
          ...props,
          [SOURCE_ID_ATTRIBUTE]: sourceId,
        }
      }

      /**
       * 合并节点计时属性和源码定位属性。
       *
       * 字段节点的源码属性由 FormField 根节点消费，避免落到内部输入组件上。
       */
      function withDevtoolsNodeProps(id: string, node: DevtoolsFormNodeConfig): Record<string, unknown> {
        const props = withRenderTimingProps(id, node.props)
        return isFieldNodeConfig(node) ? props : withDevtoolsSourceProps(node, props)
      }

      /**
       * 调用核心 ConfigForm 暴露的方法。
       *
       * 表单未挂载或方法不存在时抛错，避免 devtools adapter 返回伪成功。
       */
      function callExposed(methodName: string, args: unknown[]) {
        const method = coreRef.value?.[methodName]
        if (typeof method !== 'function')
          throw new Error(`ConfigForm method "${methodName}" is not available before the wrapped form is mounted`)
        return method(...args)
      }

      expose(Object.fromEntries(EXPOSED_METHODS.map(methodName => [
        methodName,
        (...args: unknown[]) => callExposed(methodName, args),
      ])))

      /**
       * 从声明式字段树收集 devtools 节点快照。
       *
       * 容器和字段都会进入树；slot 子节点沿用父节点 id 作为 parentId。
       */
      function collectNodeTree(
        nodes: readonly unknown[],
        formLabel: string | undefined,
        parentId: string | undefined,
        path: string,
        slotName?: string,
      ): FormDevtoolsNode[] {
        // devtools 树必须按用户声明顺序展示，不能依赖 slot 子节点可能变化的 Vue 挂载时序。
        return nodes.flatMap((node, index) => {
          if (!isFormNodeConfig(node))
            return []

          const nodePath = `${path}.${index}`
          const isField = isFieldNodeConfig(node)
          const id = isField ? `${formId}:${node.field}` : `${formId}:${nodePath}`
          const current: FormDevtoolsNode = {
            component: resolveComponentName(node.component),
            field: isField ? node.field : undefined,
            formId,
            formLabel,
            id,
            kind: isField ? 'field' : 'component',
            label: resolveLabel(node.label),
            order: index + 1,
            parentId,
            slotName,
            source: node.__source,
          }

          const children = Object.entries(node.slots ?? {}).flatMap(([childSlotName, slot]) => {
            const content = resolveSlotContent(slot)
            const childNodes = Array.isArray(content) ? content : [content]
            return collectNodeTree(childNodes, formLabel, id, `${nodePath}.slots.${childSlotName}`, childSlotName)
          })

          return [current, ...children]
        })
      }

      /**
       * 给声明式节点树注入 vnode 生命周期计时 props。
       *
       * 这里返回克隆节点，避免为了 devtools 采集修改用户传入的字段配置对象。
       */
      function instrumentNode(
        node: unknown,
        path: string,
        index: number,
      ): unknown {
        if (!isFormNodeConfig(node))
          return node

        const nodePath = `${path}.${index}`
        const id = isFieldNodeConfig(node) ? `${formId}:${node.field}` : `${formId}:${nodePath}`
        const next = cloneFormNodeConfig(node)
        next.props = withDevtoolsNodeProps(id, node)

        if (node.slots) {
          next.slots = Object.fromEntries(
            Object.entries(node.slots).map(([slotName, slot]) => [
              slotName,
              instrumentSlot(slot, `${nodePath}.slots.${slotName}`),
            ]),
          )
        }

        return next
      }

      /** 为一组声明式节点注入 devtools props，返回克隆后的节点数组。 */
      function instrumentNodeTree(nodes: readonly unknown[], path: string): unknown[] {
        return nodes.map((node, index) => instrumentNode(node, path, index))
      }

      /**
       * 给 slot 返回内容注入 devtools 采集属性。
       *
       * 数组内容逐项处理，非节点内容保持原值。
       */
      function instrumentSlotContent(content: unknown, path: string): unknown {
        if (Array.isArray(content))
          return content.map((node, index) => instrumentNode(node, path, index))

        return instrumentNode(content, path, 0)
      }

      /** 给 slot 配置注入源码与计时信息；非节点内容保持原值。 */
      function instrumentSlot(slot: unknown, path: string): unknown {
        return instrumentSlotContent(slot, path)
      }

      /** 基于当前 props.fields 和宿主 DOM 收集完整节点快照。 */
      function collectNodes(): FormDevtoolsNode[] {
        return collectNodeTree(props.fields, resolveFormLabel(hostRef.value), undefined, 'fields')
      }

      const instrumentedFields = computed(() => instrumentNodeTree(props.fields, 'fields'))

      /**
       * 将当前节点快照同步到浏览器 bridge。
       *
       * 每次同步都是完整快照，会注销已经不存在的节点 id。
       */
      function syncBridge() {
        const bridge = getBridge()
        if (!bridge)
          return

        // 每次同步都按完整快照注册/更新，便于 client 删除字段或 slot 树变化后的过期 id。
        const nodes = collectNodes()
        const nextIds = new Set(nodes.map(node => node.id))

        for (const id of registeredIds) {
          if (!nextIds.has(id)) {
            bridge.unregisterField(id)
            registeredIds.delete(id)
          }
        }

        for (const node of nodes) {
          const syncStart = now()
          const element = resolveElement(node, hostRef.value)
          const action = registeredIds.has(node.id) ? bridge.updateField : bridge.registerField
          action(node, element)
          registeredIds.add(node.id)
          bridge.recordSync({
            duration: Math.max(0, now() - syncStart),
            id: node.id,
            timestamp: now(),
          })
        }
      }

      /**
       * 合并同一事件轮内的 bridge 同步请求。
       *
       * mount、update 和 ready 连续触发时只同步最新字段快照。
       */
      function queueSyncBridge() {
        if (syncQueued)
          return

        // mount/update/ready 可能在同一轮事件里连续触发；bridge 只需要同步最新字段快照。
        syncQueued = true
        void nextTick().then(() => {
          syncQueued = false
          syncBridge()
        })
      }

      /**
       * 注销当前 adapter 注册过的所有节点。
       *
       * bridge 缺失时直接跳过，组件卸载流程不伪造同步成功。
       */
      function unregisterNodes() {
        const bridge = getBridge()
        if (!bridge)
          return

        for (const id of registeredIds)
          bridge.unregisterField(id)
        registeredIds.clear()
      }

      onMounted(() => {
        if (typeof window !== 'undefined')
          window.addEventListener(READY_EVENT, queueSyncBridge)
        queueSyncBridge()
      })

      onUpdated(queueSyncBridge)

      onUnmounted(() => {
        if (typeof window !== 'undefined')
          window.removeEventListener(READY_EVENT, queueSyncBridge)
        unregisterNodes()
      })

      return () => h('div', { ref: hostRef, style: { display: 'contents' } }, [
        h(options.ConfigForm, {
          ...attrs,
          fields: instrumentedFields.value,
          namespace: props.namespace,
          ref: coreRef,
        }, slots),
      ])
    },
  })
}
