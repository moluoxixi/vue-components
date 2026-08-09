<script setup lang="ts">
import type { AntdVueResolvedOptionState } from '../options'
import { CircleAlert, ListX, LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps<{
  state: AntdVueResolvedOptionState
}>()

const visible = computed(() => props.state.status === 'loading'
  || props.state.status === 'error'
  || (props.state.status === 'ready' && props.state.options.length === 0))
const label = computed(() => {
  if (props.state.status === 'loading')
    return 'Loading options'
  if (props.state.status === 'error')
    return props.state.error ?? 'Failed to load options'
  return 'No options'
})
</script>

<template>
  <span
    v-if="visible"
    class="mx-antd-designer-option-state"
    :class="`is-${state.status}`"
    :aria-label="label"
    :title="label"
    :role="state.status === 'error' ? 'alert' : 'status'"
  >
    <LoaderCircle v-if="state.status === 'loading'" :size="14" aria-hidden="true" />
    <CircleAlert v-else-if="state.status === 'error'" :size="14" aria-hidden="true" />
    <ListX v-else :size="14" aria-hidden="true" />
  </span>
</template>
