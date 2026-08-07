<script setup lang="ts">
import type { ElementPlusDesignerOption } from '../types'
import { ElOption, ElSelect } from 'element-plus'

defineOptions({ inheritAttrs: false })

type ElementSelectValue
  = | ElementPlusDesignerOption['value']
    | ElementPlusDesignerOption['value'][]
    | null

defineProps<{
  modelValue?: ElementSelectValue
  options?: ElementPlusDesignerOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ElementSelectValue]
}>()

function updateModelValue(value: ElementSelectValue): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <ElSelect v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
    <ElOption
      v-for="option in options ?? []"
      :key="String(option.value)"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
    />
  </ElSelect>
</template>
