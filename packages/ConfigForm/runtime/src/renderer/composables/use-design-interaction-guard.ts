import type { ShallowRef } from 'vue'
import type { ConfigFormRenderMode } from '../types'
import type { DesignInteractionGuard } from '../types/internal'
import { onBeforeUnmount, onMounted, watch } from 'vue'

interface UseDesignInteractionGuardOptions {
  formRef: Readonly<ShallowRef<HTMLFormElement | null>>
  mode: () => ConfigFormRenderMode
}

const FOCUSABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="switch"]',
  '[tabindex]',
].join(',')

export function useDesignInteractionGuard(
  options: UseDesignInteractionGuardOptions,
): DesignInteractionGuard {
  let observer: MutationObserver | undefined
  const designTabIndex = new Map<HTMLElement, string | null>()

  function applyDesignInteractionGuard(target: Record<string, unknown>): void {
    if (options.mode() !== 'design')
      return

    target.tabindex = -1
    target['data-config-runtime-control'] = ''
  }

  function restoreDesignTabIndex(): void {
    for (const [element, tabIndex] of designTabIndex) {
      if (!element.isConnected)
        continue
      if (tabIndex === null)
        element.removeAttribute('tabindex')
      else
        element.setAttribute('tabindex', tabIndex)
    }
    designTabIndex.clear()
  }

  function syncDesignInteractionGuard(): void {
    const form = options.formRef.value
    if (options.mode() !== 'design' || !form?.hasAttribute('inert')) {
      restoreDesignTabIndex()
      return
    }

    for (const element of form.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
      if (!designTabIndex.has(element))
        designTabIndex.set(element, element.getAttribute('tabindex'))
      element.setAttribute('tabindex', '-1')
    }
  }

  function startDesignInteractionGuard(): void {
    if (options.mode() !== 'design' || typeof MutationObserver === 'undefined' || !options.formRef.value)
      return
    syncDesignInteractionGuard()
    observer?.disconnect()
    observer = new MutationObserver(syncDesignInteractionGuard)
    observer.observe(options.formRef.value, {
      attributes: true,
      attributeFilter: ['inert'],
      childList: true,
      subtree: true,
    })
  }

  function stopDesignInteractionGuard(): void {
    observer?.disconnect()
    observer = undefined
    restoreDesignTabIndex()
  }

  watch(options.mode, (mode) => {
    if (mode === 'design')
      startDesignInteractionGuard()
    else
      stopDesignInteractionGuard()
  }, { flush: 'post' })

  onMounted(startDesignInteractionGuard)
  onBeforeUnmount(stopDesignInteractionGuard)

  return { applyDesignInteractionGuard }
}
