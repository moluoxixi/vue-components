<script setup lang="ts">
import type { AntdSelectFieldEmits, AntdSelectFieldProps, AntdSelectValue, AntdVueDesignerOption } from '../../../types'
import { Select } from 'ant-design-vue'
import { computed } from 'vue'
import { useAntdVueResolvedOptions } from '../../../options'
import AntdOptionState from '../AntdOptionState/index.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdSelectFieldProps>()

const state = useAntdVueResolvedOptions(
  computed(() => props.optionSource),
  computed(() => props.options),
)
const selectOptions = computed(() => state.value.options.filter(
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
      :loading="state.status === 'loading'"
      @update:value="emit('update:value', $event as AntdSelectValue)"
    />
    <AntdOptionState :state="state" />
  </span>
</template>
