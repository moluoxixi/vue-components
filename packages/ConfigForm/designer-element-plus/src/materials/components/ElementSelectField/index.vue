<script setup lang="ts">
import type { ElementSelectFieldEmits, ElementSelectFieldProps, ElementSelectValue } from '../../../types'
import { DESIGNER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { ElOption, ElSelect } from 'element-plus'
import { computed } from 'vue'
import { elementPlusOptionKey, normalizeElementPlusOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<ElementSelectFieldProps>()

const options = computed(() => normalizeElementPlusOptions(props.options, DESIGNER_OPTION_VALUE_TYPES))

const emit = defineEmits<ElementSelectFieldEmits>()

function updateModelValue(value: ElementSelectValue): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <span class="mx-element-designer-choice-field">
    <ElSelect v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
      <ElOption
        v-for="(option, index) in options"
        :key="elementPlusOptionKey(option.value, index)"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </ElSelect>
  </span>
</template>
