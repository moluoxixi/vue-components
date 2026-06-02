// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import {
  BUBBLE_MARGIN,
  BUBBLE_SIZE,
  PANEL_MAX_HEIGHT,
  RIGHT_DOCK_SCROLLBAR_FALLBACK,
} from '../src/client/constants'
import {
  clamp,
  compareElementsByDocumentPosition,
  elementArea,
  elementHasEnabledBox,
  elementIsHiddenByState,
  elementViewportScore,
  panelViewportHeight,
  resolvePanelHeight,
  resolvePanelTop,
  rightDockScrollbarWidth,
  rightDockViewportEdge,
  selectEarlierElement,
  viewportHeight,
  viewportWidth,
} from '../src/client/geometry'

interface RectOptions {
  height: number
  left?: number
  top?: number
  width: number
}

function setViewport(width: number, height: number, clientWidth = width, clientHeight = height, scrollHeight = height) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: clientWidth })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: scrollHeight })
}

/** 覆盖元素盒模型，确保几何断言不依赖 happy-dom 默认布局。 */
function setRect(element: HTMLElement, options: RectOptions) {
  const left = options.left ?? 0
  const top = options.top ?? 0
  element.getBoundingClientRect = () => ({
    bottom: top + options.height,
    height: options.height,
    left,
    right: left + options.width,
    top,
    width: options.width,
    x: left,
    y: top,
    toJSON: () => ({}),
  })
}

describe('client geometry helpers', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    setViewport(1024, 768)
  })

  it('clamps viewport and right dock measurements from browser geometry', () => {
    setViewport(0, 0, 0, 0, 0)

    expect(clamp(12, 20, 40)).toBe(20)
    expect(clamp(48, 20, 40)).toBe(40)
    expect(clamp(32, 20, 40)).toBe(32)
    expect(viewportWidth()).toBe(BUBBLE_SIZE)
    expect(viewportHeight()).toBe(BUBBLE_SIZE)

    setViewport(1200, 800, 1183, 800, 800)
    expect(rightDockScrollbarWidth()).toBe(17)
    expect(rightDockViewportEdge()).toBe(1183)

    setViewport(1200, 800, 1200, 600, 900)
    expect(rightDockScrollbarWidth()).toBe(RIGHT_DOCK_SCROLLBAR_FALLBACK)

    setViewport(1200, 800, 1200, 800, 800)
    expect(rightDockScrollbarWidth()).toBe(0)
  })

  it('resolves panel height and top within the available viewport', () => {
    setViewport(800, 700)
    const panel = document.createElement('div')

    setRect(panel, { height: 240, width: 420 })
    expect(panelViewportHeight()).toBe(700 - BUBBLE_MARGIN * 2)
    expect(resolvePanelHeight(panel)).toBe(240)
    expect(resolvePanelTop(panel, { edge: 'right', left: 720, top: 520 })).toBe(264)
    expect(resolvePanelTop(panel, { edge: 'right', left: 720, top: 120 })).toBe(178)

    setRect(panel, { height: 0, width: 420 })
    expect(resolvePanelHeight(panel)).toBe(PANEL_MAX_HEIGHT)
    expect(resolvePanelTop(panel, { edge: 'right', left: 720, top: 40 })).toBe(98)
  })

  it('compares and selects elements by document order', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.append(first, second)

    expect(compareElementsByDocumentPosition(first, first)).toBe(0)
    expect(compareElementsByDocumentPosition(first, second)).toBe(-1)
    expect(compareElementsByDocumentPosition(second, first)).toBe(1)
    expect(selectEarlierElement(undefined, first)).toBe(first)
    expect(selectEarlierElement(first, null)).toBe(first)
    expect(selectEarlierElement(second, first)).toBe(first)
  })

  it('detects hidden states before using an element for picking or auto-selection', () => {
    const visible = document.createElement('div')
    const hidden = document.createElement('div')
    const inert = document.createElement('div')
    const ariaHidden = document.createElement('div')
    const inactive = document.createElement('div')
    const styleHidden = document.createElement('div')
    const childOfHidden = document.createElement('span')

    hidden.hidden = true
    inert.setAttribute('inert', '')
    ariaHidden.setAttribute('aria-hidden', 'true')
    inactive.dataset.cfDevtoolsActive = 'false'
    styleHidden.style.display = 'none'
    hidden.append(childOfHidden)
    document.body.append(visible, hidden, inert, ariaHidden, inactive, styleHidden)

    expect(elementIsHiddenByState(visible)).toBe(false)
    expect(elementIsHiddenByState(hidden)).toBe(true)
    expect(elementIsHiddenByState(inert)).toBe(true)
    expect(elementIsHiddenByState(ariaHidden)).toBe(true)
    expect(elementIsHiddenByState(inactive)).toBe(true)
    expect(elementIsHiddenByState(styleHidden)).toBe(true)
    expect(elementIsHiddenByState(childOfHidden)).toBe(true)
  })

  it('scores enabled boxes by visible viewport area', () => {
    setViewport(100, 100)
    const visible = document.createElement('div')
    const zero = document.createElement('div')
    const offscreen = document.createElement('div')
    const hidden = document.createElement('div')
    const negative = document.createElement('div')

    hidden.hidden = true
    setRect(visible, { height: 50, left: -10, top: 20, width: 50 })
    setRect(zero, { height: 20, width: 0 })
    setRect(offscreen, { height: 20, left: 120, width: 20 })
    setRect(hidden, { height: 20, width: 20 })
    setRect(negative, { height: -5, width: -10 })

    expect(elementHasEnabledBox(visible)).toBe(true)
    expect(elementHasEnabledBox(zero)).toBe(false)
    expect(elementHasEnabledBox(hidden)).toBe(false)
    expect(elementViewportScore(visible)).toBe(1999980)
    expect(elementViewportScore(zero)).toBe(0)
    expect(elementViewportScore(offscreen)).toBe(0)
    expect(elementViewportScore(hidden)).toBe(0)
    expect(elementArea(negative)).toBe(0)
  })
})
