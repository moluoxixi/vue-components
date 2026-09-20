<script setup lang="ts">
import type { ElementRadioFieldEmits, ElementRadioFieldProps } from '../../../types'
import { DESIGNER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { ElRadio, ElRadioGroup } from 'element-plus'
import { computed } from 'vue'
import { elementPlusOptionKey, normalizeElementPlusOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<ElementRadioFieldProps>()

const options = computed(() => normalizeElementPlusOptions(props.options, DESIGNER_OPTION_VALUE_TYPES))

const emit = defineEmits<ElementRadioFieldEmits>()

function updateModelValue(value: string | number | boolean | undefined): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <span class="mx-element-designer-choice-field">
    <ElRadioGroup v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
      <ElRadio
        v-for="(option, index) in options"
        :key="elementPlusOptionKey(option.value, index)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </ElRadio>
    </ElRadioGroup>
  </span>
</template>
