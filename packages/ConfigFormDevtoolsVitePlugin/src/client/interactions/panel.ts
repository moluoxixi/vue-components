import { BUBBLE_MARGIN } from '../constants'
import {
  clamp,
  rightDockViewportEdge,
  viewportHeight,
} from '../geometry'

/**
 * 安装 devtools 面板拖拽交互。
 *
 * 只允许通过 header 拖拽，点击 header 内按钮时不会启动拖动。
 */
export function installPanelDrag(panel: HTMLElement, handle: HTMLElement) {
  let dragStartX = 0
  let dragStartY = 0
  let panelStartLeft = 0
  let panelStartTop = 0
  let panelWidth = 0
  let panelHeight = 0
  let dragging = false

  /** 计算面板在当前视口内允许的最大 left。 */
  function maxLeft() {
    return Math.max(BUBBLE_MARGIN, rightDockViewportEdge() - BUBBLE_MARGIN - panelWidth)
  }

  /** 计算面板在当前视口内允许的最大 top。 */
  function maxTop() {
    return Math.max(BUBBLE_MARGIN, viewportHeight() - BUBBLE_MARGIN - panelHeight)
  }

  /**
   * 移动面板到指定位置。
   *
   * 坐标会被限制在视口安全边界内，并切换为 left/top 定位。
   */
  function movePanel(left: number, top: number) {
    panel.style.bottom = 'auto'
    panel.style.left = `${clamp(left, BUBBLE_MARGIN, maxLeft())}px`
    panel.style.right = 'auto'
    panel.style.top = `${clamp(top, BUBBLE_MARGIN, maxTop())}px`
  }

  handle.addEventListener('mousedown', (event) => {
    if (event.button !== 0)
      return
    if (event.target instanceof Element && event.target.closest('button'))
      return

    const rect = panel.getBoundingClientRect()
    dragging = true
    dragStartX = event.clientX
    dragStartY = event.clientY
    panelStartLeft = rect.left
    panelStartTop = rect.top
    panelWidth = rect.width
    panelHeight = rect.height
    event.preventDefault()
  })

  document.addEventListener('mousemove', (event) => {
    if (!dragging)
      return

    movePanel(
      panelStartLeft + event.clientX - dragStartX,
      panelStartTop + event.clientY - dragStartY,
    )
  })

  document.addEventListener('mouseup', () => {
    dragging = false
  })
}

/**
 * 安装点击外部关闭面板的行为。
 *
 * 点击浮层按钮或面板内部不会触发关闭，避免和内部按钮交互冲突。
 */
export function installOutsidePanelClose(bubble: HTMLElement, panel: HTMLElement, closePanel: () => void) {
  document.addEventListener('click', (event) => {
    if (!panel.classList.contains('is-open'))
      return

    const target = event.target
    if (!(target instanceof Node))
      return

    if (panel.contains(target) || bubble.contains(target))
      return

    closePanel()
  }, { capture: true })
}
