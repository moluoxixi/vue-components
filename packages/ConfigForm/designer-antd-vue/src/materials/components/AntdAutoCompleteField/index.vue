<script setup lang="ts">
import type { AntdAutoCompleteFieldEmits, AntdAutoCompleteFieldProps, AntdAutoCompleteValue, AntdVueDesignerOption } from '../../../types'
import { DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { AutoComplete } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdAutoCompleteFieldProps>()

const autoCompleteOptions = computed(() => normalizeAntdVueOptions(
  props.options,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
).filter(
  (option): option is AntdVueDesignerOption & { value: string | number } => typeof option.value !== 'boolean',
))

const emit = defineEmits<AntdAutoCompleteFieldEmits>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <AutoComplete
      v-bind="$attrs"
      data-designer-selection-target
      :value="value"
      :options="autoCompleteOptions"
      @update:value="emit('update:value', $event as AntdAutoCompleteValue)"
    />
  </span>
</template>
