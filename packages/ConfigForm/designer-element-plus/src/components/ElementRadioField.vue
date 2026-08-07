<script setup lang="ts">
import type { ElementPlusDesignerOption } from '../types'
import { ElRadio, ElRadioGroup } from 'element-plus'

defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: string | number | boolean
  options?: ElementPlusDesignerOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean | undefined]
}>()

function updateModelValue(value: string | number | boolean | undefined): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <ElRadioGroup v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
    <ElRadio
      v-for="option in options ?? []"
      :key="String(option.value)"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </ElRadio>
  </ElRadioGroup>
</template>
