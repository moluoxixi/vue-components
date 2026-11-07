<script setup lang="ts">
import type { AntdRadioFieldEmits, AntdRadioFieldProps } from '../../../types'
import { DESIGNER_OPTION_VALUE_TYPES } from '@moluoxixi/config-form-designer'
import { RadioGroup } from 'ant-design-vue'
import { computed } from 'vue'
import { normalizeAntdVueOptions } from '../../../options'

defineOptions({ inheritAttrs: false })

const props = defineProps<AntdRadioFieldProps>()

const emit = defineEmits<AntdRadioFieldEmits>()

const options = computed(() => normalizeAntdVueOptions(props.options, DESIGNER_OPTION_VALUE_TYPES))
</script>

<template>
  <span class="mx-antd-designer-choice-field">
    <RadioGroup
      v-bind="$attrs"
      data-designer-selection-target
      :value="props.value"
      :options="options"
      @update:value="emit('update:value', $event)"
    />
  </span>
</template>
