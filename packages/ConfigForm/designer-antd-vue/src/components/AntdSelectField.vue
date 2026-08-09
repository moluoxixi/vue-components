<script setup lang="ts">
import type { AntdVueDesignerOption, AntdVueOptionSource } from '../types'
import { Select } from 'ant-design-vue'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../options'
import AntdOptionState from './AntdOptionState.vue'

defineOptions({ inheritAttrs: false })

type SelectValue = string | number | Array<string | number>

const props = defineProps<{
  value?: SelectValue
  options?: AntdVueDesignerOption[]
  optionSource?: AntdVueOptionSource
}>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)
const selectOptions = computed(() => state.value.options.filter(
  (option): option is AntdVueDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))

const emit = defineEmits<{
  'update:value': [value: SelectValue]
}>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <Select
      v-bind="$attrs"
      :value="value"
      :options="selectOptions"
      :loading="state.status === 'loading'"
      @update:value="emit('update:value', $event as SelectValue)"
    />
    <AntdOptionState :state="state" />
  </span>
</template>
