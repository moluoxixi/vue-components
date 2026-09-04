<script setup lang="ts">
import type {
  HeadlessCopyTextDefaultScope,
  HeadlessCopyTextEmits,
  HeadlessCopyTextExpose,
  HeadlessCopyTextProps,
  HeadlessCopyTextSlots,
} from '../../types'
import { computed } from 'vue'
import { useClipboardCopy } from '../../../composables'

defineOptions({ name: 'HeadlessCopyText' })

const props = withDefaults(defineProps<HeadlessCopyTextProps>(), {
  disabled: false,
  resetDelay: 2000,
})

const emit = defineEmits<HeadlessCopyTextEmits>()
defineSlots<HeadlessCopyTextSlots>()

const { copied, copying, copy, error, reset } = useClipboardCopy({
  disabled: () => props.disabled,
  onCopy: text => emit('copy', text),
  onError: copyError => emit('error', copyError),
  resetDelay: () => props.resetDelay,
  text: () => props.text,
})

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
</script>

<template>
  <slot v-bind="scope" />
</template>
