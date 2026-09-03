<script setup lang="ts">
import type { ElementRadioFieldEmits, ElementRadioFieldProps } from '../../../types'
import { ElRadio, ElRadioGroup } from 'element-plus'
import { computed } from 'vue'
import { elementPlusOptionKey, useElementPlusResolvedOptions } from '../../../options'
import ElementOptionState from '../ElementOptionState/index.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<ElementRadioFieldProps>()

const state = useElementPlusResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)

const emit = defineEmits<ElementRadioFieldEmits>()

function updateModelValue(value: string | number | boolean | undefined): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <span class="mx-element-designer-choice-field">
    <ElRadioGroup v-bind="$attrs" :model-value="modelValue" @update:model-value="updateModelValue">
      <ElRadio
        v-for="(option, index) in state.options"
        :key="elementPlusOptionKey(option.value, index)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </ElRadio>
    </ElRadioGroup>
    <ElementOptionState :state="state" />
  </span>
</template>
