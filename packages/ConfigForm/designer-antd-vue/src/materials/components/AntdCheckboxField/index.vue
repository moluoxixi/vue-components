<script setup lang="ts">
import type { AntdCheckboxFieldEmits, AntdCheckboxFieldProps, AntdVueDesignerOption } from '../../../types'
import { CheckboxGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdCheckboxFieldProps>()

const checkboxOptions = computed(() => normalizeAntdVueOptions(props.options).filter(
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
  </span>
</template>
