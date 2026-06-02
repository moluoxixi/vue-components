import type { FormDevtoolsNode } from '../types'
import type {
  ChildNodesByParentId,
  DevtoolsRenderState,
  DevtoolsStore,
  RootGroup,
  StoredNode,
} from './types'
import {
  compareElementsByDocumentPosition,
  elementArea,
  elementHasEnabledBox,
  elementViewportScore,
  selectEarlierElement,
} from './geometry'

/** 解析树节点类型图标，C 表示容器组件，F 表示真实字段，R 表示 render 函数。 */
export function resolveNodeKindIcon(node: FormDevtoolsNode): 'C' | 'F' | 'R' {
  if (node.kind === 'component')
    return 'C'
  if (node.kind === 'render')
    return 'R'
  return 'F'
}

/**
 * 解析树节点主显示名。
 *
 * 字段节点优先展示 field，容器节点优先展示组件名，缺失时退回节点类型。
 */
export function resolveNodeDisplayName(node: FormDevtoolsNode): string {
  if (node.kind === 'component')
    return node.component ?? node.kind
  if (node.kind === 'render')
    return node.component ?? node.kind

  return node.field ?? node.component ?? node.kind
}

/**
 * 比较两个 ConfigForm 实例导航分组。
 *
 * 优先按页面 DOM 顺序排序，缺少元素时退回注册顺序。
 */
function compareRootGroups(first: RootGroup, second: RootGroup): number {
  if (first.element && second.element) {
    const elementOrder = compareElementsByDocumentPosition(first.element, second.element)
    if (elementOrder !== 0)
      return elementOrder
  }

  return first.registrationOrder - second.registrationOrder
}

/** 判断节点是否有可参与自动选中的可见元素。 */
function nodeHasEnabledElement(node: StoredNode): boolean {
  if (!node.element)
    return false

  return elementHasEnabledBox(node.element)
}

/** 计算节点元素在视口中的可见强度，缺少元素时为 0。 */
function nodeViewportScore(node: StoredNode): number {
  if (!node.element)
    return 0

  return elementViewportScore(node.element)
}

/** 按 ConfigForm 实例聚合扁平节点，并计算导航所需元数据。 */
export function collectRootGroups(store: DevtoolsStore): RootGroup[] {
  const groups = new Map<string, RootGroup>()

  for (const node of store.nodes.values()) {
    const group = groups.get(node.formId)
    if (group) {
      group.formLabel ??= node.formLabel
      group.element = selectEarlierElement(group.element, node.element)
      group.hasInspectableElement = group.hasInspectableElement || Boolean(node.element)
      group.hasEnabledElement = group.hasEnabledElement || nodeHasEnabledElement(node)
      group.viewportScore = Math.max(group.viewportScore, nodeViewportScore(node))
      if (!node.parentId)
        group.nodes.push(node)
      continue
    }

    groups.set(node.formId, {
      element: node.element ?? undefined,
      formId: node.formId,
      formLabel: node.formLabel,
      hasEnabledElement: nodeHasEnabledElement(node),
      hasInspectableElement: Boolean(node.element),
      nodes: node.parentId ? [] : [node],
      registrationOrder: node.registrationOrder,
      viewportScore: nodeViewportScore(node),
    })
  }

  return [...groups.values()]
    .sort(compareRootGroups)
    .map(group => ({
      ...group,
      nodes: group.nodes.sort((a, b) => a.order - b.order),
    }))
}

/**
 * 计算节点在当前树中的深度。
 *
 * 父节点缺失时停止向上追踪，避免注销过程中的临时不完整树抛错。
 */
export function nodeTreeDepth(store: DevtoolsStore, node: StoredNode): number {
  let depth = 0
  let parentId = node.parentId

  while (parentId) {
    const parent = store.nodes.get(parentId)
    if (!parent)
      break

    depth += 1
    parentId = parent.parentId
  }

  return depth
}

/**
 * 比较页面拾取命中的候选节点。
 *
 * 更小、更深、更靠前的节点优先，用于在嵌套字段和容器间选择最具体目标。
 */
export function comparePickNodes(store: DevtoolsStore, first: StoredNode, second: StoredNode): number {
  if (first.element && second.element && first.element !== second.element) {
    if (first.element.contains(second.element))
      return 1
    if (second.element.contains(first.element))
      return -1

    const areaDiff = elementArea(first.element) - elementArea(second.element)
    if (areaDiff !== 0)
      return areaDiff
  }

  const depthDiff = nodeTreeDepth(store, second) - nodeTreeDepth(store, first)
  if (depthDiff !== 0)
    return depthDiff

  return first.order - second.order
}

/**
 * 根据页面点击目标解析最匹配的 ConfigForm 节点。
 *
 * 只考虑可见且包含目标的元素，避免隐藏表单抢占拾取结果。
 */
export function resolvePickedNode(store: DevtoolsStore, target: Node): StoredNode | undefined {
  return [...store.nodes.values()]
    .filter((node) => {
      const element = node.element
      return Boolean(element && element.contains(target) && elementHasEnabledBox(element))
    })
    .sort((first, second) => comparePickNodes(store, first, second))[0]
}

/** 判断表单分组是否存在可检查元素但当前全部不可见。 */
export function groupIsDisabled(group: RootGroup): boolean {
  return group.hasInspectableElement && !group.hasEnabledElement
}

/** 选出当前视口中可见强度最高的可用表单。 */
export function resolveViewportActiveGroup(groups: RootGroup[]): RootGroup | undefined {
  return groups.reduce<RootGroup | undefined>((best, group) => {
    if (groupIsDisabled(group) || group.viewportScore <= 0)
      return best
    if (!best || group.viewportScore > best.viewportScore)
      return group
    return best
  }, undefined)
}

/**
 * 解析当前应渲染的表单。
 *
 * 用户手动选择会保持到外部上下文变化；没有手动选择时由视口可见强度决定。
 */
export function resolveActiveGroup(groups: RootGroup[], state: DevtoolsRenderState): RootGroup | undefined {
  const enabledGroups = groups.filter(group => !groupIsDisabled(group))

  if (enabledGroups.length === 0) {
    state.activeFormId = undefined
    state.activeFormSelectedByUser = false
    state.selectedNodeId = undefined
    return undefined
  }

  const activeGroup = enabledGroups.find(group => group.formId === state.activeFormId)
  if (state.activeFormSelectedByUser && activeGroup)
    return activeGroup

  const viewportActiveGroup = resolveViewportActiveGroup(enabledGroups)
  state.activeFormSelectedByUser = false
  return viewportActiveGroup ?? activeGroup ?? enabledGroups[0]
}

/** 为当前快照建立父子索引，避免搜索和渲染递归时每层重复扫描全量节点。 */
export function createChildNodesByParentId(store: DevtoolsStore): ChildNodesByParentId {
  const childNodesByParentId: ChildNodesByParentId = new Map()
  for (const node of store.nodes.values()) {
    if (!node.parentId)
      continue

    const siblings = childNodesByParentId.get(node.parentId)
    if (siblings) {
      siblings.push(node)
      continue
    }

    childNodesByParentId.set(node.parentId, [node])
  }

  for (const siblings of childNodesByParentId.values())
    siblings.sort((a, b) => a.order - b.order)

  return childNodesByParentId
}

/**
 * 按树形展示顺序展开节点列表。
 *
 * roots 和 childNodesByParentId 必须来自同一快照，输出用于 source 搜索和渲染。
 */
export function collectOrderedTreeNodes(childNodesByParentId: ChildNodesByParentId, roots: StoredNode[]): StoredNode[] {
  const nodes: StoredNode[] = []

  /**
   * 深度优先收集当前节点及其子节点。
   *
   * 仅遍历已建立的父子索引，不重新读取 store。
   */
  function visit(node: StoredNode) {
    nodes.push(node)
    for (const child of childNodesByParentId.get(node.id) ?? [])
      visit(child)
  }

  for (const root of roots)
    visit(root)

  return nodes
}

/**
 * 收集当前树中拥有源码位置的节点。
 *
 * 输出顺序与面板展示顺序一致，便于搜索结果和树选中状态对齐。
 */
export function collectSourceNodes(childNodesByParentId: ChildNodesByParentId, roots: StoredNode[]): StoredNode[] {
  return collectOrderedTreeNodes(childNodesByParentId, roots).filter(node => node.source)
}
