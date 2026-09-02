<script setup lang="ts">
import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { ElementChoiceDefaultSetterEmits, ElementChoiceDefaultSetterProps, ElementPlusDesignerOption } from '../types'
import { DesignerDefaultValueSetter } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import {
  normalizeElementPlusOptions,
  readElementPlusOptionSource,
  useElementPlusResolvedOptions,
} from '../options'
import ElementOptionState from './ElementOptionState.vue'

const props = defineProps<ElementChoiceDefaultSetterProps>()

const emit = defineEmits<ElementChoiceDefaultSetterEmits>()

const staticOptions = computed(() => normalizeElementPlusOptions(props.node?.props?.options as unknown[] | undefined))
const source = computed(() => readElementPlusOptionSource(props.node?.props?.optionSource))
const state = useElementPlusResolvedOptions(source, staticOptions)
const setterOptions = computed(() => state.value.options.flatMap((option) => {
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
    <DesignerDefaultValueSetter
      :model-value="modelValue as DesignerJsonValue"
      :kind="kind"
      :options="setterOptions"
      :disabled="disabled || state.status === 'loading'"
      @update:model-value="updateValue"
    />
    <ElementOptionState :state="state" />
  </div>
</template>
