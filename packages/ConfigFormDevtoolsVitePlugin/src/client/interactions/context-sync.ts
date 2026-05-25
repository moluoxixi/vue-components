import type { RenderDevtools } from '../types'
import { CONTEXT_SYNC_ATTRIBUTES } from '../constants'

/**
 * 创建异步渲染调度器。
 *
 * 同一帧内多次触发只执行一次 render；缺少 requestAnimationFrame 时使用宏任务调度。
 */
function createAsyncRenderScheduler(render: RenderDevtools): RenderDevtools {
  let pending = false

  return () => {
    if (pending)
      return

    pending = true
    /** 刷新一次待处理渲染任务。 */
    const flush = () => {
      pending = false
      render()
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(flush)
      return
    }

    setTimeout(flush, 0)
  }
}

/**
 * 安装外部页面上下文变更同步。
 *
 * 页面点击、键盘、滚动、尺寸和可见性属性变化会重新计算当前活跃表单。
 */
export function installExternalContextSync(root: HTMLElement, render: RenderDevtools, resetManualSelection: () => void) {
  const scheduleRender = createAsyncRenderScheduler(render)
  let internalScrollInputUntil = 0
  /**
   * 重置用户手动选择并调度一次自动渲染。
   *
   * 仅用于外部页面上下文变化，面板内部操作不调用该路径。
   */
  const scheduleAutoRender = () => {
    resetManualSelection()
    scheduleRender()
  }
  /** 标记面板内部滚动输入的短暂隔离窗口。 */
  const markInternalScrollInput = () => {
    internalScrollInputUntil = Date.now() + 250
  }
  /**
   * 处理页面滚动触发的自动渲染。
   *
   * 面板内部滚动和短窗口内的 wheel 连带 scroll 不会重置用户选择。
   */
  const scheduleAutoRenderForScroll = (event: Event) => {
    const target = event.target
    if (target instanceof Node && root.contains(target))
      return
    // 仅隔离调试器内部 wheel 对自动选中逻辑的影响；滚动条仍由 CSS overflow 与浏览器原生滚动产生。
    if (Date.now() <= internalScrollInputUntil)
      return

    scheduleAutoRender()
  }

  root.addEventListener('wheel', markInternalScrollInput, { capture: true, passive: true })

  document.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Node && root.contains(target))
      return

    scheduleAutoRender()
  }, { capture: true })

  document.addEventListener('keyup', (event) => {
    const target = event.target
    if (target instanceof Node && root.contains(target))
      return

    scheduleAutoRender()
  }, { capture: true })

  window.addEventListener('scroll', scheduleAutoRenderForScroll, { capture: true, passive: true })
  window.addEventListener('resize', scheduleAutoRender, { passive: true })

  if (typeof MutationObserver === 'undefined')
    return

  const observer = new MutationObserver((mutations) => {
    const hasExternalContextChange = mutations.some((mutation) => {
      const target = mutation.target
      return target instanceof Node && !root.contains(target)
    })
    if (hasExternalContextChange)
      scheduleAutoRender()
  })

  observer.observe(document.body, {
    attributeFilter: CONTEXT_SYNC_ATTRIBUTES,
    attributes: true,
    subtree: true,
  })
}
