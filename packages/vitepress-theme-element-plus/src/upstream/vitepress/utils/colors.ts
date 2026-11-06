import { useClipboard } from '@vueuse/core'
import { getCurrentInstance, ref, watch } from 'vue'
import { isDark } from '../composables/dark'

export function getCssVarName(namespace: string, type: string) {
  return type ? `--epd-${namespace}-${type}` : `--epd-${namespace}`
}

/**
 * get css var value by css var name
 * @param name
 * @returns Reactive CSS variable value.
 */
export function getCssVarValue(name: string) {
  const val = ref(
    getComputedStyle(document.querySelector('.ep-docs') ?? document.documentElement).getPropertyValue(name),
  )
  watch(
    () => isDark.value,
    () => {
      setTimeout(() => {
        val.value = getComputedStyle(document.querySelector('.ep-docs') ?? document.documentElement).getPropertyValue(
          name,
        )
      }, 100)
    },
  )
  return val
}

export function getColorValue(type: string) {
  const color = getComputedStyle(document.querySelector('.ep-docs') ?? document.documentElement).getPropertyValue(
    `--epd-color-${type}`,
  )
  return color
}

// copy color

export function useCopyColor() {
  const source = ref('')
  const { copy, isSupported } = useClipboard({ source })

  const vm = getCurrentInstance()!
  const copyColor = async (colorType: string) => {
    const colorValue = getColorValue(colorType)
    source.value = colorValue
    const { $message } = vm.appContext.config.globalProperties
    if (!isSupported) {
      $message.error('Copy failed')
    }
    try {
      await copy()
      $message.success(`--epd-color-${colorType}: ${source.value}`)
    }
    catch (e: any) {
      $message.error(e.message)
    }
  }

  return {
    copyColor,
  }
}
