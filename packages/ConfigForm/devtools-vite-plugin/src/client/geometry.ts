import type { BubblePosition } from './types'
import {
  BUBBLE_MARGIN,
  BUBBLE_SIZE,
  PANEL_MAX_HEIGHT,
  RIGHT_DOCK_SCROLLBAR_FALLBACK,
} from './constants'

/** 将数值限制在闭区间内，供拖拽定位和面板布局共享。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 读取当前视口宽度。
 *
 * 返回值至少为浮层按钮尺寸，避免无效浏览器环境下计算出负布局空间。
 */
export function viewportWidth(): number {
  return Math.max(BUBBLE_SIZE, window.innerWidth || document.documentElement.clientWidth || BUBBLE_SIZE)
}

/**
 * 读取当前视口高度。
 *
 * 返回值至少为浮层按钮尺寸，供拖拽和面板定位逻辑使用。
 */
export function viewportHeight(): number {
  return Math.max(BUBBLE_SIZE, window.innerHeight || document.documentElement.clientHeight || BUBBLE_SIZE)
}

/**
 * 估算右侧停靠时需要避让的滚动条宽度。
 *
 * 浏览器未暴露有效差值时用固定兜底宽度，只影响 UI 位置，不伪造测量成功。
 */
export function rightDockScrollbarWidth(): number {
  const width = window.innerWidth || 0
  const clientWidth = document.documentElement.clientWidth || 0

  if (width > 0 && clientWidth > 0 && width > clientWidth)
    return width - clientWidth

  const clientHeight = document.documentElement.clientHeight || window.innerHeight || 0
  if (document.documentElement.scrollHeight > clientHeight)
    return RIGHT_DOCK_SCROLLBAR_FALLBACK

  return 0
}

/** 计算右侧停靠边界，已扣除可能存在的页面滚动条。 */
export function rightDockViewportEdge(): number {
  return viewportWidth() - rightDockScrollbarWidth()
}

/** 计算面板可使用的最大视口高度，保留浮层外边距。 */
export function panelViewportHeight(): number {
  return Math.max(BUBBLE_SIZE, viewportHeight() - BUBBLE_MARGIN * 2)
}

/**
 * 解析面板当前高度。
 *
 * 已渲染面板使用真实尺寸；隐藏面板使用最大高度约束，避免展开时越界。
 */
export function resolvePanelHeight(panel: HTMLElement): number {
  const height = panel.getBoundingClientRect().height
  if (height > 0)
    return Math.min(height, panelViewportHeight())

  return Math.min(PANEL_MAX_HEIGHT, panelViewportHeight())
}

/**
 * 根据浮层按钮位置计算面板顶部坐标。
 *
 * 优先在按钮上方或下方展开，空间不足时仍限制在当前视口可见范围内。
 */
export function resolvePanelTop(panel: HTMLElement, position: BubblePosition): number {
  const panelHeight = resolvePanelHeight(panel)
  const minTop = BUBBLE_MARGIN
  const maxTop = Math.max(minTop, viewportHeight() - BUBBLE_MARGIN - panelHeight)
  const aboveTop = position.top - panelHeight - BUBBLE_MARGIN
  const belowTop = position.top + BUBBLE_SIZE + BUBBLE_MARGIN
  const bottomLimit = viewportHeight() - BUBBLE_MARGIN

  if (position.top + BUBBLE_SIZE / 2 > viewportHeight() / 2 && aboveTop >= minTop)
    return clamp(aboveTop, minTop, maxTop)

  if (belowTop + panelHeight <= bottomLimit)
    return clamp(belowTop, minTop, maxTop)

  if (aboveTop >= minTop)
    return clamp(aboveTop, minTop, maxTop)

  return clamp(position.top - 300, minTop, maxTop)
}

/**
 * 按 DOM 文档顺序比较两个元素。
 *
 * 返回值仅用于排序，不处理跨文档或 Shadow DOM 的特殊排序语义。
 */
export function compareElementsByDocumentPosition(first: HTMLElement, second: HTMLElement): number {
  if (first === second)
    return 0

  const position = first.compareDocumentPosition(second)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING)
    return -1
  if (position & Node.DOCUMENT_POSITION_PRECEDING)
    return 1
  return 0
}

/**
 * 在两个候选元素中保留文档顺序更靠前的元素。
 *
 * 空候选不会覆盖已有元素，用于多节点表单定位根元素。
 */
export function selectEarlierElement(current: HTMLElement | undefined, next: HTMLElement | null): HTMLElement | undefined {
  if (!next)
    return current
  if (!current)
    return next
  return compareElementsByDocumentPosition(next, current) < 0 ? next : current
}

/**
 * 判断元素或祖先节点是否被显式隐藏，不应参与自动巡检。
 *
 * display:none/v-show 表单仍会留在导航中显示为禁用项，但不会自动成为当前表单。
 */
export function elementIsHiddenByState(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (
      current.hidden
      || current.hasAttribute('inert')
      || current.getAttribute('aria-hidden') === 'true'
      || current.dataset.cfDevtoolsActive === 'false'
    ) {
      return true
    }

    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')
      return true
  }

  return false
}

/**
 * 判断元素是否拥有可检查的可见盒模型。
 *
 * 隐藏态或零面积元素不会参与自动选中和页面拾取。
 */
export function elementHasEnabledBox(element: HTMLElement): boolean {
  if (elementIsHiddenByState(element))
    return false

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * 计算元素在当前视口中的可见强度。
 *
 * 可见面积是主信号；距离视口顶部的距离只作为并列时的排序因素，
 * 让堆叠表单优先选中用户正在阅读的那一个。
 */
export function elementViewportScore(element: HTMLElement): number {
  if (elementIsHiddenByState(element))
    return 0

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0)
    return 0

  const intersectionLeft = Math.max(0, rect.left)
  const intersectionTop = Math.max(0, rect.top)
  const intersectionRight = Math.min(viewportWidth(), rect.right)
  const intersectionBottom = Math.min(viewportHeight(), rect.bottom)
  const intersectionWidth = intersectionRight - intersectionLeft
  const intersectionHeight = intersectionBottom - intersectionTop
  if (intersectionWidth <= 0 || intersectionHeight <= 0)
    return 0

  const visibleArea = intersectionWidth * intersectionHeight
  const distanceFromViewportTop = Math.abs(Math.max(rect.top, 0))
  return visibleArea * 1000 - distanceFromViewportTop
}

/** 计算元素盒模型面积，负尺寸按 0 处理。 */
export function elementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}
