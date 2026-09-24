<script setup lang="ts">
import type { AntdSelectFieldEmits, AntdSelectFieldProps, AntdSelectValue, AntdVueDesignerOption } from '../../../types'
import { DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { Select } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdSelectFieldProps>()

const selectOptions = computed(() => normalizeAntdVueOptions(
  props.options,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
).filter(
  (option): option is AntdVueDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))

const emit = defineEmits<AntdSelectFieldEmits>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <Select
      v-bind="$attrs"
      data-designer-selection-target
      :value="value"
      :options="selectOptions"
      @update:value="emit('update:value', $event as AntdSelectValue)"
    />
  </span>
</template>
