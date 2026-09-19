<script setup lang="ts">
import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { ElementChoiceDefaultSetterEmits, ElementChoiceDefaultSetterProps } from '../../../types'
import { computed } from 'vue'
import { normalizeElementPlusOptions } from '../../../options'
import ElementDefaultValueSetter from '../ElementDefaultValueSetter/index.vue'

const props = defineProps<ElementChoiceDefaultSetterProps>()

const emit = defineEmits<ElementChoiceDefaultSetterEmits>()

const staticOptions = computed(() => normalizeElementPlusOptions(props.node?.props?.options as unknown[] | undefined))
const setterOptions = computed(() => staticOptions.value.flatMap((option) => {
  if (props.kind === 'multiselect' && typeof option.value === 'boolean')
    return []
  return [{ label: option.label, value: option.value }]
}))

function updateValue(value: unknown): void {
  emit('update:modelValue', value as DesignerJsonValue | undefined)
}
</script>

<template>
  <div class="mx-element-designer-choice-default">
    <ElementDefaultValueSetter
      :model-value="modelValue as DesignerJsonValue"
      :kind="kind"
      :options="setterOptions"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
  </div>
</template>
