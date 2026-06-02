import type { DevtoolsRenderState, DevtoolsStore } from './client/types'
import type { FormDevtoolsBridge } from './types'
import { READY_EVENT } from './client/constants'
import {
  installBubbleDrag,
  installExternalContextSync,
  installOutsidePanelClose,
  installPagePicker,
  installPanelDrag,
  installTreeInteractions,
} from './client/interactions'
import { renderTree } from './client/render'
import { createDevtoolsShell, createHighlighter, createMessageSetter } from './client/shell'
import { createStore } from './client/store'
import { ensureStyle } from './client/styles'
import { ConfigFormDevtoolsPluginError } from './types'

declare global {
  interface Window {
    __CONFIG_FORM_DEVTOOLS_BRIDGE__?: FormDevtoolsBridge
    __CONFIG_FORM_DEVTOOLS_PENDING__?: boolean
  }
}

/** 安装浏览器 overlay，并返回全局 ConfigForm devtools bridge。 */
export function installConfigFormDevtools(): FormDevtoolsBridge {
  if (typeof document === 'undefined')
    throw new ConfigFormDevtoolsPluginError('ConfigForm devtools client requires a browser document')

  const existing = window.__CONFIG_FORM_DEVTOOLS_BRIDGE__
  if (existing)
    return existing

  ensureStyle()

  const shell = createDevtoolsShell()
  const highlight = createHighlighter(shell.highlightBox)
  const setMessage = createMessageSetter(shell.errorBox)
  const renderState: DevtoolsRenderState = {}
  /**
   * 取消页面拾取模式。
   *
   * 初始空函数只覆盖安装前的本地状态，installPagePicker 完成后会被真实取消函数替换。
   */
  let cancelPagePicker = () => {}
  let store!: DevtoolsStore

  /**
   * 渲染 devtools 面板主体。
   *
   * 只读取当前 store 和 renderState，不直接修改页面业务 DOM。
   */
  function render() {
    renderTree(shell.body, store, renderState)
  }

  /**
   * 关闭面板并清理交互态。
   *
   * 会取消页面拾取、高亮和消息，避免隐藏面板继续影响页面。
   */
  function closePanel() {
    shell.panel.classList.remove('is-open')
    cancelPagePicker()
    highlight(null)
    setMessage('')
  }

  store = createStore(render)
  const bridge: FormDevtoolsBridge = {
    recordRender: store.recordRender,
    recordSync: store.recordSync,
    registerField: store.registerField,
    unregisterField: store.unregisterField,
    updateField: store.updateField,
  }

  shell.bubble.addEventListener('click', () => {
    if (shell.panel.classList.contains('is-open')) {
      closePanel()
      return
    }

    shell.panel.classList.add('is-open')
    render()
  })

  document.body.append(shell.root)
  installBubbleDrag(shell.bubble, shell.panel)
  installPanelDrag(shell.panel, shell.header)
  installTreeInteractions(shell.body, () => shell.body, () => shell.panel, store, renderState, render, highlight, setMessage)
  cancelPagePicker = installPagePicker(shell.root, shell.panel, shell.pickButton, store, renderState, render, highlight, setMessage)
  installOutsidePanelClose(shell.bubble, shell.panel, closePanel)
  installExternalContextSync(
    shell.root,
    render,
    () => {
      renderState.activeFormSelectedByUser = false
      renderState.selectedNodeId = undefined
    },
  )
  window.__CONFIG_FORM_DEVTOOLS_PENDING__ = true
  window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
  window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: bridge }))
  render()

  return bridge
}
