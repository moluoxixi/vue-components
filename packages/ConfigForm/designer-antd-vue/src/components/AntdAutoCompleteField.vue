<script setup lang="ts">
import type { AntdAutoCompleteFieldEmits, AntdAutoCompleteFieldProps, AntdAutoCompleteValue, AntdVueDesignerOption } from '../types'
import { AutoComplete } from 'ant-design-vue'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../options'
import AntdOptionState from './AntdOptionState.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdAutoCompleteFieldProps>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)
const autoCompleteOptions = computed(() => state.value.options.filter(
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
      :loading="state.status === 'loading'"
      @update:value="emit('update:value', $event as AntdAutoCompleteValue)"
    />
    <AntdOptionState :state="state" />
  </span>
</template>
