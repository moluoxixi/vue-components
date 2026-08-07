<script setup lang="ts">
import type { ElementPlusDesignerOption } from '../types'
import { ElCheckbox, ElCheckboxGroup } from 'element-plus'

defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: Array<string | number>
  options?: ElementPlusDesignerOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Array<string | number>]
}>()

function updateModelValue(value: Array<string | number>): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <ElCheckboxGroup v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
    <ElCheckbox
      v-for="option in options ?? []"
      :key="String(option.value)"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </ElCheckbox>
  </ElCheckboxGroup>
</template>
