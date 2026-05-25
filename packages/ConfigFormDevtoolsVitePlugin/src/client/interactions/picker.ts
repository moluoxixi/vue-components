import type {
  DevtoolsRenderState,
  DevtoolsStore,
  HighlightElement,
  RenderDevtools,
  SetDevtoolsMessage,
} from '../types'
import { resolvePickedNode } from '../tree'
import { activateSourceNode } from './activate'

/**
 * 安装页面拾取模式。
 *
 * 用户点击页面元素后解析最匹配的 ConfigForm 节点，并打开对应源码位置。
 */
export function installPagePicker(
  root: HTMLElement,
  panel: HTMLElement,
  pickButton: HTMLElement,
  store: DevtoolsStore,
  state: DevtoolsRenderState,
  render: RenderDevtools,
  highlight: HighlightElement,
  setMessage: SetDevtoolsMessage,
) {
  let previousCursor = ''

  /**
   * 切换页面拾取状态。
   *
   * 激活时保存原始 cursor，关闭时必须恢复，避免污染页面全局样式。
   */
  function setPicking(active: boolean) {
    if (state.pickingNode === active)
      return

    state.pickingNode = active
    pickButton.classList.toggle('is-active', active)
    pickButton.setAttribute('aria-pressed', String(active))

    if (active) {
      previousCursor = document.documentElement.style.cursor
      document.documentElement.style.cursor = 'crosshair'
      return
    }

    document.documentElement.style.cursor = previousCursor
  }

  pickButton.addEventListener('mousedown', event => event.stopPropagation())
  pickButton.addEventListener('click', (event) => {
    event.stopPropagation()
    setPicking(!state.pickingNode)
    setMessage(state.pickingNode ? 'Click a ConfigForm field or component in the page' : '')
    if (!state.pickingNode)
      highlight(null)
  })

  document.addEventListener('mousemove', (event) => {
    if (!state.pickingNode)
      return

    const target = event.target
    if (!(target instanceof Node) || root.contains(target)) {
      highlight(null)
      return
    }

    const node = resolvePickedNode(store, target)
    highlight(node?.element ?? null)
  }, { capture: true })

  document.addEventListener('keydown', (event) => {
    if (!state.pickingNode || event.key !== 'Escape')
      return

    setPicking(false)
    setMessage('')
    highlight(null)
  }, { capture: true })

  document.addEventListener('click', (event) => {
    if (!state.pickingNode)
      return

    const target = event.target
    if (target instanceof Node && root.contains(target))
      return

    event.preventDefault()
    event.stopImmediatePropagation()

    if (!(target instanceof Node)) {
      setPicking(false)
      setMessage('No ConfigForm field/component found at this point')
      highlight(null)
      return
    }

    const node = resolvePickedNode(store, target)
    setPicking(false)

    if (!node) {
      setMessage('No ConfigForm field/component found at this point')
      highlight(null)
      return
    }

    panel.classList.add('is-open')
    setMessage('')
    activateSourceNode(node, () => panel, state, render, highlight, setMessage)
  }, { capture: true })

  return () => setPicking(false)
}
