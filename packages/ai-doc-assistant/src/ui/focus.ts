import { nextTick } from 'vue'

/** 浮层关闭后仅在焦点丢到文档根时归还触发器，不抢占用户选择的新控件。 */
export function restoreFocusIfLost(target: HTMLElement | null | undefined): void {
  void nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || active === document.documentElement)
      target?.focus()
  })
}
