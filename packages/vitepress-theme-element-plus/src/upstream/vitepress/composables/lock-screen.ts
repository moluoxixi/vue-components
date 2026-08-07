import { isClient } from '@vueuse/core'
import { onUnmounted } from 'vue'

const addClass = (el: HTMLElement, name: string) => el.classList.add(name)
const removeClass = (el: HTMLElement, name: string) => el.classList.remove(name)
const hasClass = (el: HTMLElement, name: string) => el.classList.contains(name)
const getStyle = (el: HTMLElement, name: string) => getComputedStyle(el)[name as 'paddingRight' | 'overflowY']
const getScrollBarWidth = () => window.innerWidth - document.documentElement.clientWidth

export function useLockScreen() {
  let scrollBarWidth = 0
  let withoutHiddenClass = false
  let bodyPaddingRight = '0'
  let computedBodyPaddingRight = 0

  const cleanup = () => {
    if (!isClient)
      return
    removeClass(document.body, 'el-popup-parent--hidden')
    if (withoutHiddenClass) {
      document.body.style.paddingRight = bodyPaddingRight
    }
  }

  onUnmounted(() => {
    cleanup()
  })

  const lock = () => {
    if (!isClient)
      return
    withoutHiddenClass = !hasClass(document.body, 'el-popup-parent--hidden')
    if (withoutHiddenClass) {
      bodyPaddingRight = document.body.style.paddingRight
      computedBodyPaddingRight = Number.parseInt(
        getStyle(document.body, 'paddingRight'),
        10,
      )
    }
    scrollBarWidth = getScrollBarWidth()
    const bodyHasOverflow
      = document.documentElement.clientHeight < document.body.scrollHeight
    const bodyOverflowY = getStyle(document.body, 'overflowY')
    if (
      scrollBarWidth > 0
      && (bodyHasOverflow || bodyOverflowY === 'scroll')
      && withoutHiddenClass
    ) {
      document.body.style.paddingRight = `${
        computedBodyPaddingRight + scrollBarWidth
      }px`
    }
    addClass(document.body, 'el-popup-parent--hidden')
  }

  return {
    lock,
    cleanup,
  }
}
