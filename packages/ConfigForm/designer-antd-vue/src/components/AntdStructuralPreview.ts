import type { DesignerContainerNode, DesignerNode } from '@moluoxixi/config-form-designer'
import type { PropType, Slots, VNode, VNodeChild } from 'vue'
import { Collapse, CollapsePanel, TabPane, Tabs } from 'ant-design-vue'
import { cloneVNode, defineComponent, h, isVNode, nextTick, ref, watch } from 'vue'

function nodeKey(node: DesignerNode): string {
  const configured = node.props?.key ?? node.props?.name
  return configured === undefined || configured === null ? node.id : String(configured)
}

function nodeLabel(node: DesignerNode, property: 'header' | 'tab', fallback: string): string {
  const value = node.props?.[property]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function findNodeList(children: VNodeChild[]): VNode | undefined {
  for (const child of children) {
    if (Array.isArray(child)) {
      const nested = findNodeList(child)
      if (nested)
        return nested
      continue
    }
    if (!isVNode(child))
      continue
    if (Array.isArray(child.props?.nodes))
      return child
    if (Array.isArray(child.children)) {
      const nested = findNodeList(child.children as VNodeChild[])
      if (nested)
        return nested
    }
  }
  return undefined
}

function nodeList(slots: Slots): VNode | undefined {
  return findNodeList(slots.default?.() ?? [])
}

function renderNode(list: VNode | undefined, node: DesignerNode): VNode | undefined {
  return list ? cloneVNode(list, { nodes: [node] }) : undefined
}

function selectNode(list: VNode | undefined, nodeId: string, scope?: ParentNode): void {
  const handler = list?.props?.onSelect
  if (Array.isArray(handler)) {
    handler.forEach(candidate => typeof candidate === 'function' && candidate(nodeId))
  }
  else if (typeof handler === 'function') {
    handler(nodeId)
  }
  void nextTick(() => {
    const owner = scope ?? document
    const node = [...owner.querySelectorAll<HTMLElement>('[data-node-id]')]
      .find(element => element.dataset.nodeId === nodeId)
    node?.querySelector<HTMLElement>(':scope > .mx-config-form-designer__node-preview-shell')?.focus({ preventScroll: true })
  })
}

function withoutControlledAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const {
    activeKey: _activeKey,
    defaultActiveKey: _defaultActiveKey,
    items: _items,
    onChange: _onChange,
    'onUpdate:activeKey': _onUpdateActiveKey,
    ...rest
  } = attrs
  return rest
}

function configuredActiveKeys(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map(String)
  return value === undefined || value === null ? [] : [String(value)]
}

const structuralPreviewProps = {
  designerNode: {
    type: Object as PropType<DesignerContainerNode>,
    required: true,
  },
} as const

export const AntdTabsPreview = defineComponent({
  name: 'AntdTabsPreview',
  inheritAttrs: false,
  props: structuralPreviewProps,
  setup(props, { attrs, slots }) {
    const activeKey = ref('')
    watch(
      () => props.designerNode.slots.default?.map(nodeKey).join('\u0000') ?? '',
      () => {
        const keys = props.designerNode.slots.default?.map(nodeKey) ?? []
        if (!keys.includes(activeKey.value)) {
          const configured = configuredActiveKeys(attrs.activeKey)[0]
          activeKey.value = configured && keys.includes(configured) ? configured : (keys[0] ?? '')
        }
      },
      { immediate: true },
    )

    return () => {
      const list = nodeList(slots)
      const nodes = props.designerNode.slots.default ?? []
      return h(Tabs, {
        ...withoutControlledAttrs(attrs),
        activeKey: activeKey.value,
        onChange: (key: string | number) => {
          activeKey.value = String(key)
        },
      }, {
        default: () => nodes.map((node, index) => h(TabPane, {
          key: nodeKey(node),
          tab: h('span', {
            class: 'mx-antd-designer-structural-label',
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              selectNode(
                list,
                node.id,
                (event.currentTarget as HTMLElement).closest('.mx-config-form-designer') ?? undefined,
              )
            },
          }, nodeLabel(node, 'tab', `Tab ${index + 1}`)),
          disabled: node.props?.disabled === true,
          forceRender: true,
        }, {
          default: () => renderNode(list, node),
        })),
      })
    }
  },
})

export const AntdCollapsePreview = defineComponent({
  name: 'AntdCollapsePreview',
  inheritAttrs: false,
  props: structuralPreviewProps,
  setup(props, { attrs, slots }) {
    const activeKeys = ref<string[]>(configuredActiveKeys(attrs.activeKey))
    watch(
      () => props.designerNode.slots.default?.map(nodeKey).join('\u0000') ?? '',
      () => {
        const keys = props.designerNode.slots.default?.map(nodeKey) ?? []
        activeKeys.value = activeKeys.value.filter(key => keys.includes(key))
        if (!activeKeys.value.length && keys.length)
          activeKeys.value = [keys[0]!]
      },
      { immediate: true },
    )

    return () => {
      const list = nodeList(slots)
      const nodes = props.designerNode.slots.default ?? []
      return h(Collapse, {
        ...withoutControlledAttrs(attrs),
        activeKey: activeKeys.value,
        onChange: (keys: string | number | Array<string | number>) => {
          activeKeys.value = Array.isArray(keys) ? keys.map(String) : [String(keys)]
        },
      }, {
        default: () => nodes.map((node, index) => h(CollapsePanel, {
          key: nodeKey(node),
          header: h('span', {
            class: 'mx-antd-designer-structural-label',
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              selectNode(
                list,
                node.id,
                (event.currentTarget as HTMLElement).closest('.mx-config-form-designer') ?? undefined,
              )
            },
          }, nodeLabel(node, 'header', `Item ${index + 1}`)),
          disabled: node.props?.disabled === true,
          forceRender: true,
        }, {
          default: () => renderNode(list, node),
        })),
      })
    }
  },
})

function createPassthroughPreview(name: string) {
  return defineComponent({
    name,
    setup(_props, { slots }) {
      return () => slots.default?.()
    },
  })
}

export const AntdTabPanePreview = createPassthroughPreview('AntdTabPanePreview')
export const AntdCollapseItemPreview = createPassthroughPreview('AntdCollapseItemPreview')
