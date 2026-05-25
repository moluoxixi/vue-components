import type { BubblePosition } from '../types'
import {
  BUBBLE_MARGIN,
  BUBBLE_SIZE,
  DRAG_THRESHOLD,
} from '../constants'
import {
  clamp,
  resolvePanelTop,
  rightDockScrollbarWidth,
  rightDockViewportEdge,
  viewportHeight,
  viewportWidth,
} from '../geometry'

/**
 * 同步浮层按钮和面板位置。
 *
 * 按左右停靠边界写入样式，不保存持久化位置。
 */
export function updateBubblePosition(bubble: HTMLElement, panel: HTMLElement, position: BubblePosition) {
  bubble.style.left = `${position.left}px`
  bubble.style.top = `${position.top}px`
  bubble.classList.toggle('is-left-edge', position.edge === 'left')
  bubble.classList.toggle('is-right-edge', position.edge === 'right')

  panel.style.bottom = 'auto'
  panel.style.top = `${resolvePanelTop(panel, position)}px`

  if (position.edge === 'left') {
    panel.style.left = `${BUBBLE_MARGIN}px`
    panel.style.right = 'auto'
    return
  }

  panel.style.left = 'auto'
  panel.style.right = `${BUBBLE_MARGIN + rightDockScrollbarWidth()}px`
}

/**
 * 安装浮层按钮拖拽交互。
 *
 * 拖拽结束后按钮吸附到左右边缘；内部状态只保存在当前页面会话。
 */
export function installBubbleDrag(bubble: HTMLElement, panel: HTMLElement) {
  /** 计算按钮在当前视口内允许的最大 left。 */
  const maxLeft = () => Math.max(0, rightDockViewportEdge() - BUBBLE_SIZE)
  /** 计算按钮在当前视口内允许的最大 top。 */
  const maxTop = () => viewportHeight() - BUBBLE_SIZE
  const position: BubblePosition = {
    edge: 'right',
    left: clamp(rightDockViewportEdge() - BUBBLE_SIZE - BUBBLE_MARGIN, 0, maxLeft()),
    top: clamp(viewportHeight() - BUBBLE_SIZE - BUBBLE_MARGIN, 0, maxTop()),
  }
  let dragStartX = 0
  let dragStartY = 0
  let startLeft = 0
  let startTop = 0
  let dragging = false
  let moved = false
  let suppressNextClick = false

  /**
   * 将拖拽后的按钮吸附到最近水平边缘。
   *
   * 吸附后同步面板位置，避免面板和按钮分离。
   */
  function snapToEdge() {
    position.edge = position.left + BUBBLE_SIZE / 2 < viewportWidth() / 2 ? 'left' : 'right'
    position.left = position.edge === 'left' ? 0 : maxLeft()
    position.top = clamp(position.top, 0, maxTop())
    updateBubblePosition(bubble, panel, position)
  }

  bubble.addEventListener('mousedown', (event) => {
    if (event.button !== 0)
      return

    dragging = true
    moved = false
    dragStartX = event.clientX
    dragStartY = event.clientY
    startLeft = position.left
    startTop = position.top
    bubble.classList.add('is-dragging')
    event.preventDefault()
  })

  document.addEventListener('mousemove', (event) => {
    if (!dragging)
      return

    const dx = event.clientX - dragStartX
    const dy = event.clientY - dragStartY
    moved = moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD
    position.left = clamp(startLeft + dx, 0, maxLeft())
    position.top = clamp(startTop + dy, 0, maxTop())
    updateBubblePosition(bubble, panel, position)
  })

  document.addEventListener('mouseup', () => {
    if (!dragging)
      return

    dragging = false
    bubble.classList.remove('is-dragging')

    if (moved) {
      suppressNextClick = true
      snapToEdge()
    }
  })

  bubble.addEventListener('click', (event) => {
    if (!suppressNextClick)
      return

    suppressNextClick = false
    event.stopImmediatePropagation()
    event.preventDefault()
  }, { capture: true })

  window.addEventListener('resize', () => {
    position.top = clamp(position.top, 0, maxTop())
    position.left = position.edge === 'left' ? 0 : maxLeft()
    updateBubblePosition(bubble, panel, position)
  })

  updateBubblePosition(bubble, panel, position)
}
