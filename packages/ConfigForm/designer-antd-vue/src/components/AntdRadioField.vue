<script setup lang="ts">
import type { AntdVueDesignerOption, AntdVueOptionSource } from '../types'
import { RadioGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../options'
import AntdOptionState from './AntdOptionState.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  value?: string | number | boolean
  options?: AntdVueDesignerOption[]
  optionSource?: AntdVueOptionSource
}>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)

const emit = defineEmits<{
  'update:value': [value: string | number | boolean | undefined]
}>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <RadioGroup
      v-bind="$attrs"
      data-designer-selection-target
      :value="value"
      :options="state.options"
      @update:value="emit('update:value', $event)"
    />
    <AntdOptionState :state="state" />
  </span>
</template>
