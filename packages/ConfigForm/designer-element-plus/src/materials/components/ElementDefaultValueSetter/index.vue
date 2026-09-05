<script setup lang="ts">
import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { ElementDefaultValueSetterEmits, ElementDefaultValueSetterProps } from '../../../types'
import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTimePicker,
} from 'element-plus'
import { computed, ref, useAttrs, watch } from 'vue'
import { useDesignerLocale } from '@moluoxixi/config-form-designer'

defineOptions({ inheritAttrs: false })

const props = defineProps<ElementDefaultValueSetterProps>()
const emit = defineEmits<ElementDefaultValueSetterEmits>()
const attrs = useAttrs()
const locale = useDesignerLocale()
const draft = ref('')
const draftTouched = ref(false)

const numberValue = computed(() => typeof props.modelValue === 'number' ? props.modelValue : undefined)
const booleanValue = computed(() => props.modelValue === true)
const elementOptions = computed(() => (props.options ?? []).flatMap(option => option.value === null
  ? []
  : [{ ...option, value: option.value }]))
const singleValue = computed(() => Array.isArray(props.modelValue) ? undefined : props.modelValue)
const multipleValue = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const stringValue = computed(() => typeof props.modelValue === 'string' ? props.modelValue : undefined)

watch(() => props.modelValue, (value) => {
  draft.value = value === undefined || value === null ? '' : String(value)
  draftTouched.value = false
}, { immediate: true })

function updateDraft(value: string): void {
  draft.value = value
  draftTouched.value = true
}

function commitDraft(): void {
  if (!draftTouched.value)
    return
  draftTouched.value = false
  emit('update:modelValue', draft.value)
}

function updateNumber(value: number | undefined): void {
  emit('update:modelValue', Number.isFinite(value) ? value : undefined)
}

function updateValue(value: unknown): void {
  emit('update:modelValue', (value === null || value === '') ? undefined : value as DesignerJsonValue)
}
</script>

<template>
  <div class="mx-element-designer-default-value">
    <ElInput
      v-if="kind === 'text'"
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-text"
      :model-value="draft"
      :disabled="disabled"
      :aria-label="locale.t('default.value', 'Default value')"
      @update:model-value="updateDraft"
      @blur="commitDraft"
      @keydown.enter.prevent="commitDraft"
    />
    <ElInputNumber
      v-else-if="kind === 'number'"
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-number"
      :model-value="numberValue"
      :disabled="disabled"
      :aria-label="locale.t('default.value', 'Default value')"
      @change="updateNumber"
    />
    <ElSwitch
      v-else-if="kind === 'boolean'"
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-boolean"
      :model-value="booleanValue"
      :disabled="disabled"
      :aria-label="locale.t('default.value', 'Default value')"
      @change="updateValue"
    />
    <ElSelect
      v-else-if="kind === 'select' || kind === 'multiselect'"
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-select"
      :model-value="kind === 'multiselect' ? multipleValue : singleValue"
      :disabled="disabled"
      :multiple="kind === 'multiselect'"
      :aria-label="locale.t('default.value', 'Default value')"
      @update:model-value="updateValue"
    >
      <ElOption
        v-for="(option, index) in elementOptions"
        :key="index"
        :label="option.label"
        :value="option.value"
      />
    </ElSelect>
    <ElDatePicker
      v-else-if="kind === 'date'"
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-date"
      :model-value="stringValue"
      :disabled="disabled"
      :aria-label="locale.t('default.value', 'Default value')"
      type="date"
      value-format="YYYY-MM-DD"
      @update:model-value="updateValue"
    />
    <ElTimePicker
      v-else
      v-bind="attrs"
      :id="props.id"
      class="mx-config-form-designer__property-control is-time"
      :model-value="stringValue"
      :disabled="disabled"
      :aria-label="locale.t('default.value', 'Default value')"
      format="HH:mm:ss"
      value-format="HH:mm:ss"
      @update:model-value="updateValue"
    />
  </div>
</template>
