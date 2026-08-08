<script setup lang="ts">
import type { ElementPlusDesignerOption, ElementPlusOptionSource } from '../types'
import { ElOption, ElSelect } from 'element-plus'
import { computed } from 'vue'
import { elementPlusOptionKey, useElementPlusResolvedOptions } from '../options'
import ElementOptionState from './ElementOptionState.vue'

defineOptions({ inheritAttrs: false })

type ElementSelectValue
  = | ElementPlusDesignerOption['value']
    | ElementPlusDesignerOption['value'][]
    | null

const props = defineProps<{
  modelValue?: ElementSelectValue
  options?: ElementPlusDesignerOption[]
  optionSource?: ElementPlusOptionSource
}>()

const state = useElementPlusResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)

const emit = defineEmits<{
  'update:modelValue': [value: ElementSelectValue]
}>()

function updateModelValue(value: ElementSelectValue): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <span class="mx-element-designer-choice-field">
    <ElSelect v-bind="$attrs" :model-value="modelValue" :loading="state.status === 'loading'" @update:model-value="updateModelValue">
      <ElOption
        v-for="(option, index) in state.options"
        :key="elementPlusOptionKey(option.value, index)"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </ElSelect>
    <ElementOptionState :state="state" />
  </span>
</template>
