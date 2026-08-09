<script setup lang="ts">
import type { AntdVueDesignerOption, AntdVueOptionSource } from '../types'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../options'

const props = defineProps<{
  value?: unknown
  options?: AntdVueDesignerOption[]
  optionSource?: AntdVueOptionSource
}>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)

const text = computed(() => {
  const values = Array.isArray(props.value) ? props.value : [props.value]
  return values.map((value) => {
    const option = state.value.options.find(candidate => Object.is(candidate.value, value))
    return String(option?.label ?? value ?? '')
  }).join('、')
})
</script>

<template>
  <span>{{ text }}</span>
</template>
