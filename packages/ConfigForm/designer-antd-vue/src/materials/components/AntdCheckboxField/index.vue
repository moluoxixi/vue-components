<script setup lang="ts">
import type { AntdCheckboxFieldEmits, AntdCheckboxFieldProps, AntdVueDesignerOption } from '../../../types'
import { DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { CheckboxGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdCheckboxFieldProps>()

const emit = defineEmits<AntdCheckboxFieldEmits>()

const checkboxOptions = computed(() => normalizeAntdVueOptions(
  props.options,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
).filter(
  (option): option is AntdVueDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <CheckboxGroup
      v-bind="$attrs"
      data-designer-selection-target
      :value="props.value"
      :options="checkboxOptions"
      @update:value="emit('update:value', $event as Array<string | number>)"
    />
  </span>
</template>
