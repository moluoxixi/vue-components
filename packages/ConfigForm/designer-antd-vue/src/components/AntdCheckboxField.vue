<script setup lang="ts">
import type { AntdCheckboxFieldEmits, AntdCheckboxFieldProps, AntdVueDesignerOption } from '../types'
import { CheckboxGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../options'
import AntdOptionState from './AntdOptionState.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdCheckboxFieldProps>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)
const checkboxOptions = computed(() => state.value.options.filter(
  (option): option is AntdVueDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))

const emit = defineEmits<AntdCheckboxFieldEmits>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <CheckboxGroup
      v-bind="$attrs"
      data-designer-selection-target
      :value="value"
      :options="checkboxOptions"
      @update:value="emit('update:value', $event as Array<string | number>)"
    />
    <AntdOptionState :state="state" />
  </span>
</template>
