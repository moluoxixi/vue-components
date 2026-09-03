<script setup lang="ts">
import type { ElementCheckboxFieldEmits, ElementCheckboxFieldProps, ElementPlusDesignerOption } from '../../../types'
import { ElCheckbox, ElCheckboxGroup } from 'element-plus'
import { computed } from 'vue'
import { elementPlusOptionKey, useElementPlusResolvedOptions } from '../../../options'
import ElementOptionState from '../ElementOptionState/index.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<ElementCheckboxFieldProps>()

const state = useElementPlusResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)
const checkboxOptions = computed(() => state.value.options.filter(
  (option): option is ElementPlusDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))

const emit = defineEmits<ElementCheckboxFieldEmits>()

function updateModelValue(value: Array<string | number>): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <span class="mx-element-designer-choice-field">
    <ElCheckboxGroup v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
      <ElCheckbox
        v-for="(option, index) in checkboxOptions"
        :key="elementPlusOptionKey(option.value, index)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </ElCheckbox>
    </ElCheckboxGroup>
    <ElementOptionState :state="state" />
  </span>
</template>
