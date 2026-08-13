import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import { computed, onUnmounted, shallowRef, toValue } from 'vue'
import { copyText } from '../utils/clipboard'

export interface UseClipboardCopyOptions {
  text: MaybeRefOrGetter<string>
  disabled?: MaybeRefOrGetter<boolean | undefined>
  resetDelay?: MaybeRefOrGetter<number | undefined>
  onCopy?: (text: string) => void
  onError?: (error: Error) => void
}

export interface UseClipboardCopyReturn {
  copied: ShallowRef<boolean>
  copying: ShallowRef<boolean>
  disabled: ComputedRef<boolean>
  error: ShallowRef<Error | null>
  copy: (text?: string) => Promise<void>
  reset: () => void
}

/** Adds reactive copy state and reset lifecycle around the framework-neutral copyText helper. */
export function useClipboardCopy(options: UseClipboardCopyOptions): UseClipboardCopyReturn {
  const copied = shallowRef(false)
  const copying = shallowRef(false)
  const disabled = computed(() => toValue(options.disabled) ?? false)
  const error = shallowRef<Error | null>(null)
  let active = true
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  function clearResetTimer(): void {
    if (resetTimer === undefined)
      return
    clearTimeout(resetTimer)
    resetTimer = undefined
  }

  function reset(): void {
    clearResetTimer()
    copied.value = false
    error.value = null
  }

  async function copy(value = toValue(options.text)): Promise<void> {
    if (disabled.value || copying.value)
      return

    clearResetTimer()
    copying.value = true
    copied.value = false
    error.value = null

    try {
      await copyText(value)
      if (!active)
        return
      copied.value = true
      options.onCopy?.(value)
      const resetDelay = toValue(options.resetDelay) ?? 2000
      if (resetDelay > 0)
        resetTimer = setTimeout(reset, resetDelay)
    }
    catch (reason) {
      const copyError = reason instanceof Error ? reason : new Error(String(reason))
      if (active) {
        error.value = copyError
        options.onError?.(copyError)
      }
      throw copyError
    }
    finally {
      if (active)
        copying.value = false
    }
  }

  onUnmounted(() => {
    active = false
    clearResetTimer()
    copying.value = false
  })

  return { copied, copying, copy, disabled, error, reset }
}
