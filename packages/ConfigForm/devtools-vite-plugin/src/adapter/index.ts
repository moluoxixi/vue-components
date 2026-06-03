import type { Component } from 'vue'
import type { FormDevtoolsNode } from '../types'
import type { DevtoolsCollectedFields, DevtoolsFieldConfig, DevtoolsFormNodeConfig } from './source'
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, onUpdated, ref, useAttrs } from 'vue'
import { ConfigFormDevtoolsPluginError } from '../types'
import {
  cloneFormNodeConfig,
  createCollectedFieldIndex,
  getBridge,
  isCollectedFieldNode,
  isFieldNodeConfig,
  isFormNodeConfig,
  isRenderFunction,
  resolveComponentName,
  resolveElement,
  resolveFormLabel,
  resolveLabel,
  resolveRenderFunctionSource,
  resolveSlotContent,
} from './source'
import {
  createRenderTimingPropsFactory,
  now,
  withDevtoolsFieldId,
  withDevtoolsNodeProps,
} from './timing'

type ExposedConfigForm = Record<string, unknown>

declare global {
  interface Window {
    __CONFIG_FORM_DEVTOOLS_BRIDGE__?: import('../types').FormDevtoolsBridge
  }
}

const READY_EVENT = 'config-form-devtools:ready'
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

/** 创建不依赖模块级递增计数器的表单实例 id，适配长时间热更新场景。 */
function createFormId(): string {
  return `cf-form-${crypto.randomUUID()}`
}

/**
 * 包裹 ConfigForm 并注册 devtools，同时保留核心组件暴露的 ref API。
 *
 * adapter 会收集声明式节点树、映射真实 DOM、代理内部 ConfigForm 方法，
 * 并在 mount/update/unmount 阶段同步浏览器 bridge。
 */
export function createDevtoolsConfigFormAdapter(options: {
  ConfigForm: Component
  collectFieldConfigs: (nodes: readonly unknown[]) => DevtoolsFieldConfig[]
}): Component {
  return defineComponent({
    inheritAttrs: false,
    name: 'ConfigFormDevtoolsAdapter',
    props: {
      fields: { type: Array, required: true },
      namespace: { type: String, default: 'cf' },
    },
    setup(props, { expose, slots }) {
      const attrs = useAttrs()
      const formId = createFormId()
      const coreRef = ref<ExposedConfigForm | null>(null)
      const hostRef = ref<HTMLElement | null>(null)
      const registeredIds = new Set<string>()
      let syncQueued = false
      const withRenderTimingProps = createRenderTimingPropsFactory((metric) => {
        getBridge()?.recordRender(metric)
      })

      /** 给节点 props 注入源码定位属性。 */
      function withNodeProps(id: string, node: DevtoolsFormNodeConfig): Record<string, unknown> {
        return withDevtoolsNodeProps(id, node, withRenderTimingProps)
      }

      /** 将当前节点快照同步到浏览器 bridge。 */
      function syncBridge() {
        const bridge = getBridge()
        if (!bridge)
          return

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

      /** 合并同一事件轮内的 bridge 同步请求。 */
      function queueSyncBridge() {
        if (syncQueued)
          return

        syncQueued = true
        void nextTick().then(() => {
          syncQueued = false
          syncBridge()
        })
      }

      /** 注销当前 adapter 注册过的所有节点。 */
      function unregisterNodes() {
        const bridge = getBridge()
        if (!bridge)
          return

        for (const id of registeredIds)
          bridge.unregisterField(id)
        registeredIds.clear()
      }

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
        collectedFields: DevtoolsCollectedFields,
        slotName?: string,
      ): FormDevtoolsNode[] {
        return nodes.flatMap((node, index) => {
          const nodePath = `${path}.${index}`
          if (isRenderFunction(node)) {
            return [{
              component: resolveComponentName(node),
              formId,
              formLabel,
              id: `${formId}:${nodePath}`,
              kind: 'render',
              order: index + 1,
              parentId,
              slotName,
              source: resolveRenderFunctionSource(node),
            }]
          }

          if (!isFormNodeConfig(node))
            return []

          const isField = isCollectedFieldNode(node, collectedFields)
          const renderSource = resolveRenderFunctionSource(node.component)
          const id = isField ? `${formId}:${node.field}` : `${formId}:${nodePath}`
          const current: FormDevtoolsNode = {
            component: resolveComponentName(node.component),
            field: isField ? node.field : undefined,
            formId,
            formLabel,
            id,
            kind: !isField && isRenderFunction(node.component) ? 'render' : isField ? 'field' : 'component',
            label: resolveLabel(node.label),
            order: index + 1,
            parentId,
            slotName,
            source: renderSource ?? node.__source,
          }

          const children = Object.entries(node.slots ?? {}).flatMap(([childSlotName, slot]) => {
            const content = resolveSlotContent(slot)
            const childNodes = Array.isArray(content) ? content : [content]
            return collectNodeTree(childNodes, formLabel, id, `${nodePath}.slots.${childSlotName}`, collectedFields, childSlotName)
          })

          return [current, ...children]
        })
      }

      /** 给声明式节点树注入 devtools props，返回克隆后的节点数组。 */
      function instrumentNodeTree(nodes: readonly unknown[], path: string): unknown[] {
        return nodes.map((node, index) => instrumentNode(node, path, index))
      }

      /** 给单个节点注入 devtools props。 */
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
        next.props = withNodeProps(id, node)
        const fieldId = withDevtoolsFieldId(node)
        if (fieldId !== undefined)
          next.id = fieldId

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

      /** 给一组 slot 内容注入 devtools 采集属性。 */
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
        const collectedFields = createCollectedFieldIndex(options.collectFieldConfigs(props.fields))
        return collectNodeTree(props.fields, resolveFormLabel(hostRef.value), undefined, 'fields', collectedFields)
      }

      const instrumentedFields = computed(() => instrumentNodeTree(props.fields, 'fields'))

      expose(Object.fromEntries(EXPOSED_METHODS.map(methodName => [
        methodName,
        (...args: unknown[]) => callExposed(methodName, args),
      ])))

      /** 调用核心 ConfigForm 暴露的方法。 */
      function callExposed(methodName: string, args: unknown[]) {
        const method = coreRef.value?.[methodName]
        if (typeof method !== 'function') {
          throw new ConfigFormDevtoolsPluginError(
            `ConfigForm method "${methodName}" is not available before the wrapped form is mounted`,
            { methodName },
          )
        }
        return method(...args)
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
