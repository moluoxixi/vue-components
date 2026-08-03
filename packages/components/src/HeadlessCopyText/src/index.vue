<script setup lang="ts">
import type {
  HeadlessCopyTextDefaultScope,
  HeadlessCopyTextEmits,
  HeadlessCopyTextExpose,
  HeadlessCopyTextProps,
  HeadlessCopyTextSlots,
} from './types'
import { computed, onUnmounted, shallowRef } from 'vue'
import { copyText } from '../../utils/clipboard'

defineOptions({ name: 'HeadlessCopyText' })

const props = withDefaults(defineProps<HeadlessCopyTextProps>(), {
  disabled: false,
  resetDelay: 2000,
})

const emit = defineEmits<HeadlessCopyTextEmits>()
defineSlots<HeadlessCopyTextSlots>()

const copied = shallowRef(false)
const copying = shallowRef(false)
const error = shallowRef<Error | null>(null)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function clearResetTimer(): void {
  if (resetTimer !== undefined) {
    clearTimeout(resetTimer)
    resetTimer = undefined
  }
}

function reset(): void {
  clearResetTimer()
  copied.value = false
  error.value = null
}

async function copy(text = props.text): Promise<void> {
  if (props.disabled || copying.value)
    return

  clearResetTimer()
  copying.value = true
  copied.value = false
  error.value = null

  try {
    await copyText(text)
    copied.value = true
    emit('copy', text)

    if (props.resetDelay > 0)
      resetTimer = setTimeout(reset, props.resetDelay)
  }
  catch (reason) {
    const copyError = reason instanceof Error ? reason : new Error(String(reason))
    error.value = copyError
    emit('error', copyError)
    throw copyError
  }
  finally {
    copying.value = false
  }
}

const scope = computed<HeadlessCopyTextDefaultScope>(() => ({
  copied: copied.value,
  copying: copying.value,
  copy,
  disabled: props.disabled,
  error: error.value,
  reset,
  text: props.text,
}))

defineExpose<HeadlessCopyTextExpose>({ copy, reset })

onUnmounted(clearResetTimer)
</script>

<template>
  <slot v-bind="scope" />
</template>
