<script setup lang="ts">
import type { AntdRadioFieldEmits, AntdRadioFieldProps } from '../../../types'
import { DESIGNER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { RadioGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdRadioFieldProps>()

const options = computed(() => normalizeAntdVueOptions(props.options, DESIGNER_OPTION_VALUE_TYPES))

const emit = defineEmits<AntdRadioFieldEmits>()
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <RadioGroup
      v-bind="$attrs"
      data-designer-selection-target
      :value="value"
      :options="options"
      @update:value="emit('update:value', $event)"
    />
  </span>
</template>
