<script setup lang="ts">
import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { AntdChoiceDefaultSetterEmits, AntdChoiceDefaultSetterProps } from '../../../types'
import { DesignerDefaultValueSetter } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

const props = defineProps<AntdChoiceDefaultSetterProps>()

const emit = defineEmits<AntdChoiceDefaultSetterEmits>()

const staticOptions = computed(() => normalizeAntdVueOptions(props.node?.props?.options as unknown[] | undefined))
const setterOptions = computed(() => staticOptions.value.flatMap((option) => {
  if (typeof option.value === 'boolean')
    return []
  return [{ label: option.label, value: option.value }]
}))

function updateValue(value: unknown): void {
  emit('update:modelValue', value as DesignerJsonValue | undefined)
}
</script>

<template>
  <div class="mx-antd-designer-choice-default">
    <DesignerDefaultValueSetter
      :model-value="modelValue as DesignerJsonValue"
      :kind="kind"
      :options="setterOptions"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
  </div>
</template>
