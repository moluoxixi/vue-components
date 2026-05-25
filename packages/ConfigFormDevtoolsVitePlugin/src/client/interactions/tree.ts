import type {
  DevtoolsRenderState,
  DevtoolsStore,
  HighlightElement,
  RenderDevtools,
  SetDevtoolsMessage,
} from '../types'
import { resolveEventNode } from '../render'
import { activateSourceNode } from './activate'

/**
 * 安装调试面板树、导航和源码搜索交互。
 *
 * 事件代理只处理 eventHost 内部元素，页面选择逻辑由 installPagePicker 负责。
 */
export function installTreeInteractions(
  eventHost: HTMLElement,
  getBody: () => HTMLElement,
  getNodeLookupRoot: () => HTMLElement,
  store: DevtoolsStore,
  state: DevtoolsRenderState,
  render: RenderDevtools,
  highlight: HighlightElement,
  setMessage: SetDevtoolsMessage,
) {
  eventHost.addEventListener('mouseover', (event) => {
    const body = getBody()
    const node = resolveEventNode(store, body, event.target)
    if (node)
      highlight(node.element)
  })

  eventHost.addEventListener('mouseout', (event) => {
    const body = getBody()
    const target = event.target
    if (!(target instanceof Element))
      return

    const row = target.closest('[data-cf-devtools-node-id]')
    if (!row || !body.contains(row))
      return

    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && row.contains(relatedTarget))
      return

    highlight(null)
  })

  eventHost.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Element) {
      const sourceResult = target.closest<HTMLButtonElement>('[data-cf-devtools-source-result-id]')
      if (sourceResult && eventHost.contains(sourceResult)) {
        const node = store.nodes.get(sourceResult.dataset.cfDevtoolsSourceResultId ?? '')
        if (node)
          activateSourceNode(node, getNodeLookupRoot, state, render, highlight, setMessage)
        return
      }

      const navItem = target.closest<HTMLButtonElement>('[data-cf-devtools-nav-form-id]')
      if (navItem && !navItem.disabled) {
        state.activeFormId = navItem.dataset.cfDevtoolsNavFormId
        state.activeFormSelectedByUser = true
        state.selectedNodeId = undefined
        render()
        return
      }
    }

    const body = getBody()
    const node = resolveEventNode(store, body, event.target)
    if (node)
      activateSourceNode(node, getNodeLookupRoot, state, render, highlight, setMessage)
  })

  eventHost.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || !target.dataset.cfDevtoolsSourceSearch)
      return

    state.sourceSearchQuery = target.value
    render()

    const nextSearch = getBody().querySelector<HTMLInputElement>('[data-cf-devtools-source-search]')
    if (!nextSearch)
      return

    nextSearch.focus()
    const cursor = nextSearch.value.length
    nextSearch.setSelectionRange(cursor, cursor)
  })

  eventHost.addEventListener('keydown', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || !target.dataset.cfDevtoolsSourceSearch || event.key !== 'Enter')
      return

    const firstResult = getBody().querySelector<HTMLButtonElement>('[data-cf-devtools-source-result-id]')
    const node = firstResult ? store.nodes.get(firstResult.dataset.cfDevtoolsSourceResultId ?? '') : undefined
    if (!node)
      return

    event.preventDefault()
    target.blur()
    if (state.sourceSearchQuery !== target.value)
      state.sourceSearchQuery = target.value

    activateSourceNode(node, getNodeLookupRoot, state, render, highlight, setMessage)
  })
}
