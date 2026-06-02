import type {
  ChildNodesByParentId,
  DevtoolsRenderState,
  DevtoolsStore,
  RootGroup,
  StoredNode,
} from './types'
import {
  SOURCE_SEARCH_RESULT_LIMIT,
} from './constants'
import {
  collectRootGroups,
  collectSourceNodes,
  createChildNodesByParentId,
  groupIsDisabled,
  resolveActiveGroup,
  resolveNodeDisplayName,
  resolveNodeKindIcon,
} from './tree'

/** 格式化性能指标数值，缺失样本使用占位符展示。 */
function formatTiming(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '--'
}

/**
 * 将当前选中的节点行滚动到调试面板可见区域。
 *
 * 只操作面板内部滚动位置，不改写页面滚动状态。
 */
export function scrollSelectedNodeIntoView(container: HTMLElement, selectedNodeId: string | undefined) {
  if (!selectedNodeId)
    return

  // 只把已选节点带入视口；滚动容器仍由 CSS overflow 和浏览器原生行为决定。
  const row = [...container.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
    .find(item => item.dataset.cfDevtoolsNodeId === selectedNodeId)
  row?.scrollIntoView({ block: 'nearest' })
}

/**
 * 从调试面板事件目标解析对应节点。
 *
 * 仅接受 container 内部的节点行，外部点击不会误选中页面元素。
 */
export function resolveEventNode(store: DevtoolsStore, container: HTMLElement, target: EventTarget | null): StoredNode | undefined {
  if (!(target instanceof Element))
    return undefined

  const row = target.closest<HTMLElement>('[data-cf-devtools-node-id]')
  if (!row || !container.contains(row))
    return undefined

  const id = row?.dataset.cfDevtoolsNodeId
  return id ? store.nodes.get(id) : undefined
}

/**
 * 生成表单导航项的辅助描述。
 *
 * 优先展示前两个根节点名称，没有可读节点时退回 formId。
 */
function resolveGroupMeta(group: RootGroup): string {
  return group.nodes
    .slice(0, 2)
    .map(resolveNodeDisplayName)
    .join(', ') || group.formId
}

/**
 * 创建多表单导航按钮。
 *
 * disabled 表示该表单当前不可检查，只影响导航交互和提示，不删除节点数据。
 */
function createFormNavItem(
  group: RootGroup,
  index: number,
  active: boolean,
  disabled: boolean,
): HTMLElement {
  const button = document.createElement('button')
  button.className = `cf-devtools-nav-item${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`
  button.dataset.cfDevtoolsNavFormId = group.formId
  button.disabled = disabled
  if (disabled)
    button.title = 'ConfigForm is hidden'
  button.type = 'button'

  const title = document.createElement('span')
  title.className = 'cf-devtools-nav-title'
  title.textContent = group.formLabel ?? `ConfigForm ${index + 1}`

  const meta = document.createElement('span')
  meta.className = 'cf-devtools-nav-meta'
  meta.textContent = disabled ? `${resolveGroupMeta(group)} · hidden` : resolveGroupMeta(group)

  button.append(title, meta)
  return button
}

/**
 * 生成 source 搜索结果的可读标签。
 *
 * 标签合并节点类型、字段/组件名、label 和 slot 信息，便于键盘搜索后确认目标。
 */
function resolveNodeSelectorLabel(node: StoredNode): string {
  const detail = [node.label, node.slotName ? `slot:${node.slotName}` : undefined].filter(Boolean).join(' · ')
  return `${resolveNodeKindIcon(node)} ${resolveNodeDisplayName(node)}${detail ? ` · ${detail}` : ''}`
}

/** 标准化搜索文本，限定为大小写不敏感的空白裁剪匹配。 */
function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * 汇总节点可搜索字段。
 *
 * 包含源码位置和表单元数据，但不读取 DOM 文本，避免搜索依赖页面当前渲染内容。
 */
function resolveNodeSearchText(node: StoredNode): string {
  return [
    node.kind,
    resolveNodeKindIcon(node),
    resolveNodeDisplayName(node),
    node.field,
    node.component,
    node.label,
    node.formId,
    node.formLabel,
    node.slotName,
    node.slotName ? `slot:${node.slotName}` : undefined,
    node.source?.file,
    node.source?.line,
    node.source?.column,
  ]
    .filter(value => value !== undefined && value !== null)
    .join(' ')
}

/**
 * 按用户输入过滤带源码位置的节点。
 *
 * 多个 token 必须全部命中同一节点搜索文本，空查询不返回结果列表。
 */
function filterSourceNodes(nodes: StoredNode[], query: string): StoredNode[] {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0)
    return []

  return nodes.filter((node) => {
    const text = normalizeSearchText(resolveNodeSearchText(node))
    return tokens.every(token => text.includes(token))
  })
}

/**
 * 创建源码搜索输入和结果列表。
 *
 * 该函数只生成面板 DOM；输入事件由 interactions 模块统一绑定处理。
 */
function createSourceSearch(
  nodes: StoredNode[],
  selectedNodeId: string | undefined,
  query: string | undefined,
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'cf-devtools-source-search-box'

  const input = document.createElement('input')
  input.className = 'cf-devtools-source-search'
  input.dataset.cfDevtoolsSourceSearch = 'true'
  input.type = 'search'
  input.placeholder = nodes.length > 0 ? 'Search field/component, label, slot, source' : 'No source locations'
  input.disabled = nodes.length === 0
  input.value = query ?? ''
  wrapper.append(input)

  const matches = filterSourceNodes(nodes, query ?? '').slice(0, SOURCE_SEARCH_RESULT_LIMIT)
  if (normalizeSearchText(query ?? '') && matches.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'cf-devtools-source-empty'
    empty.textContent = 'No matching source'
    wrapper.append(empty)
    return wrapper
  }

  if (matches.length > 0) {
    const results = document.createElement('div')
    results.className = 'cf-devtools-source-results'
    for (const node of matches) {
      const item = document.createElement('button')
      item.className = `cf-devtools-source-result${selectedNodeId === node.id ? ' is-selected' : ''}`
      item.dataset.cfDevtoolsSourceResultId = node.id
      item.type = 'button'
      item.textContent = resolveNodeSelectorLabel(node)
      item.title = resolveNodeSearchText(node)
      results.append(item)
    }
    wrapper.append(results)
  }

  return wrapper
}

/**
 * 创建单个性能指标展示行。
 *
 * title 中保留平均值、最大值和样本数，便于定位渲染或同步异常耗时。
 */
function createTimingRow(
  label: 'render' | 'sync',
  value: number | undefined,
  avg: number | undefined,
  max: number | undefined,
  samples: number,
): HTMLElement {
  const item = document.createElement('span')
  item.className = `cf-devtools-timing is-${label}`
  item.textContent = `${label} ${formatTiming(value)} ms`
  item.title = samples > 0
    ? `${label}: avg ${formatTiming(avg)} ms, max ${formatTiming(max)} ms, samples ${samples}`
    : `${label}: no samples`
  return item
}

/**
 * 创建树节点行及其子节点 DOM。
 *
 * childNodesByParentId 必须来自同一次 store 快照，避免渲染期间重复扫描全量节点。
 */
function createNodeRow(
  node: StoredNode,
  childNodesByParentId: ChildNodesByParentId,
  level: number,
  selectedNodeId: string | undefined,
): HTMLElement {
  const row = document.createElement('div')
  row.className = `cf-devtools-node${selectedNodeId === node.id ? ' is-selected' : ''}`
  row.dataset.cfDevtoolsNodeId = node.id
  row.style.paddingLeft = `${6 + level * 14}px`

  const main = document.createElement('div')
  main.className = 'cf-devtools-node-main'

  const kind = document.createElement('span')
  kind.className = `cf-devtools-node-kind is-${node.kind}`
  kind.textContent = resolveNodeKindIcon(node)

  const text = document.createElement('div')
  text.className = 'cf-devtools-node-text'

  const key = document.createElement('div')
  key.className = 'cf-devtools-node-key'
  key.textContent = resolveNodeDisplayName(node)

  const meta = document.createElement('div')
  meta.className = 'cf-devtools-node-meta'
  meta.textContent = [node.label, node.slotName ? `slot:${node.slotName}` : undefined].filter(Boolean).join(' · ')

  const timings = document.createElement('div')
  timings.className = 'cf-devtools-timings'
  timings.append(
    createTimingRow('render', node.lastRenderMs, node.avgRenderMs, node.maxRenderMs, node.renderSamples),
    createTimingRow('sync', node.lastSyncMs, node.avgSyncMs, node.maxSyncMs, node.syncSamples),
  )

  const open = document.createElement('button')
  open.className = 'cf-devtools-open'
  open.dataset.cfDevtoolsOpen = node.id
  open.type = 'button'
  open.textContent = '↗'
  open.title = 'Open source'
  open.disabled = true
  if (node.source)
    open.disabled = false

  text.append(key, meta)
  main.append(kind, text)
  row.append(main, timings, open)

  const wrapper = document.createElement('div')
  wrapper.append(row)
  for (const child of childNodesByParentId.get(node.id) ?? [])
    wrapper.append(createNodeRow(child, childNodesByParentId, level + 1, selectedNodeId))

  return wrapper
}

/**
 * 渲染 devtools 树面板。
 *
 * 该函数会重建容器内容并同步选中状态；缺失节点会清理过期 selectedNodeId。
 */
export function renderTree(
  container: HTMLElement,
  store: DevtoolsStore,
  state: DevtoolsRenderState,
) {
  container.textContent = ''

  const groups = collectRootGroups(store)
  const childNodesByParentId = createChildNodesByParentId(store)
  const roots = groups.flatMap(group => group.nodes)
  if (state.selectedNodeId && !store.nodes.has(state.selectedNodeId))
    state.selectedNodeId = undefined

  if (roots.length === 0) {
    state.activeFormId = undefined
    state.activeFormSelectedByUser = false
    state.selectedNodeId = undefined
    const empty = document.createElement('div')
    empty.className = 'cf-devtools-empty'
    empty.textContent = 'No fields'
    container.append(empty)
    return
  }

  if (groups.length === 1 && !groupIsDisabled(groups[0])) {
    state.activeFormId = groups[0]?.formId
    state.activeFormSelectedByUser = false
    container.append(createSourceSearch(collectSourceNodes(childNodesByParentId, roots), state.selectedNodeId, state.sourceSearchQuery))
    const layout = document.createElement('div')
    layout.className = 'cf-devtools-layout is-single'
    const tree = document.createElement('div')
    tree.className = 'cf-devtools-tree'
    for (const node of roots)
      tree.append(createNodeRow(node, childNodesByParentId, 0, state.selectedNodeId))
    layout.append(tree)
    container.append(layout)
    scrollSelectedNodeIntoView(tree, state.selectedNodeId)
    return
  }

  const activeGroup = resolveActiveGroup(groups, state)
  state.activeFormId = activeGroup?.formId

  const layout = document.createElement('div')
  layout.className = 'cf-devtools-layout'

  const nav = document.createElement('div')
  nav.className = 'cf-devtools-nav'

  const tree = document.createElement('div')
  tree.className = 'cf-devtools-tree'

  groups.forEach((group, index) => {
    const disabled = groupIsDisabled(group)
    nav.append(createFormNavItem(
      group,
      index,
      group.formId === activeGroup?.formId,
      disabled,
    ))
  })

  if (activeGroup) {
    container.append(createSourceSearch(
      collectSourceNodes(childNodesByParentId, activeGroup.nodes),
      state.selectedNodeId,
      state.sourceSearchQuery,
    ))
    for (const node of activeGroup.nodes)
      tree.append(createNodeRow(node, childNodesByParentId, 0, state.selectedNodeId))
  }
  else {
    const empty = document.createElement('div')
    empty.className = 'cf-devtools-empty'
    empty.textContent = 'No visible ConfigForm'
    tree.append(empty)
  }

  layout.append(nav, tree)
  container.append(layout)
  scrollSelectedNodeIntoView(tree, state.selectedNodeId)
}
