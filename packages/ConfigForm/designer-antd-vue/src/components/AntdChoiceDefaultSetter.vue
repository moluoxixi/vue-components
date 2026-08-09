<script setup lang="ts">
import type {
  DesignerDefaultValueKind,
  DesignerFieldNode,
  DesignerJsonValue,
} from '@moluoxixi/config-form-designer'
import { DesignerDefaultValueSetter } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import {
  normalizeAntdVueOptions,
  readAntdVueOptionSource,
  useAntdVueResolvedOptions,
} from '../options'
import AntdOptionState from './AntdOptionState.vue'

const props = defineProps<{
  modelValue?: unknown
  disabled?: boolean
  node?: DesignerFieldNode
  kind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerJsonValue | undefined]
}>()

const staticOptions = computed(() => normalizeAntdVueOptions(props.node?.props?.options as unknown[] | undefined))
const source = computed(() => readAntdVueOptionSource(props.node?.props?.optionSource))
const state = useAntdVueResolvedOptions(source, staticOptions)
const setterOptions = computed(() => state.value.options.flatMap((option) => {
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
      :disabled="disabled || state.status === 'loading'"
      @update:model-value="updateValue"
    />
    <AntdOptionState :state="state" />
  </div>
</template>
