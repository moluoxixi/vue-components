import type { HighlightElement, SetDevtoolsMessage } from './types'
import { ROOT_ID } from './constants'

export interface DevtoolsShell {
  root: HTMLElement
  bubble: HTMLButtonElement
  panel: HTMLElement
  header: HTMLElement
  body: HTMLElement
  errorBox: HTMLElement
  highlightBox: HTMLElement
  pickButton: HTMLButtonElement
}

/**
 * 创建 devtools overlay 的静态 DOM 结构。
 *
 * 该函数只创建节点并返回引用，事件绑定和状态渲染由上层模块完成。
 */
export function createDevtoolsShell(): DevtoolsShell {
  const root = document.createElement('div')
  root.id = ROOT_ID
  root.className = 'cf-devtools-root'

  const bubble = document.createElement('button')
  bubble.className = 'cf-devtools-bubble'
  bubble.dataset.cfDevtools = 'bubble'
  bubble.type = 'button'
  bubble.textContent = 'CF'

  const panel = document.createElement('div')
  panel.className = 'cf-devtools-panel'
  panel.dataset.cfDevtools = 'panel'

  const header = document.createElement('div')
  header.className = 'cf-devtools-header'

  const title = document.createElement('span')
  title.className = 'cf-devtools-title'
  title.textContent = 'ConfigForm'

  const pickButton = document.createElement('button')
  pickButton.className = 'cf-devtools-pick'
  pickButton.dataset.cfDevtoolsPick = 'true'
  pickButton.type = 'button'
  pickButton.textContent = '⌖'
  pickButton.title = 'Select field/component from page'
  pickButton.setAttribute('aria-label', 'Select field/component from page')
  pickButton.setAttribute('aria-pressed', 'false')
  header.append(title, pickButton)

  const body = document.createElement('div')
  body.className = 'cf-devtools-body'

  const errorBox = document.createElement('div')
  errorBox.className = 'cf-devtools-error'

  const highlightBox = document.createElement('div')
  highlightBox.className = 'cf-devtools-highlight'
  highlightBox.dataset.cfDevtools = 'highlight'

  panel.append(header, body, errorBox)
  root.append(bubble, panel, highlightBox)

  return {
    body,
    bubble,
    errorBox,
    header,
    highlightBox,
    panel,
    pickButton,
    root,
  }
}

/**
 * 创建页面元素高亮器。
 *
 * 传入 null 会隐藏高亮框；传入元素时按当前视口 rect 定位。
 */
export function createHighlighter(highlightBox: HTMLElement): HighlightElement {
  return (element) => {
    if (!element) {
      highlightBox.style.display = 'none'
      return
    }

    const rect = element.getBoundingClientRect()
    highlightBox.style.display = 'block'
    highlightBox.style.left = `${rect.left}px`
    highlightBox.style.top = `${rect.top}px`
    highlightBox.style.width = `${rect.width}px`
    highlightBox.style.height = `${rect.height}px`
  }
}

/**
 * 创建面板消息写入函数。
 *
 * 只写入 textContent，避免 source-open 错误文本被当作 HTML 渲染。
 */
export function createMessageSetter(errorBox: HTMLElement): SetDevtoolsMessage {
  return (message) => {
    errorBox.textContent = message
  }
}
