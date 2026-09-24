<script setup lang="ts">
import type {
  DesignerDefaultValueKind,
  DesignerSetterOption,
} from '@designer/registry'
import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTimePicker,
} from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '@designer/locale'

type SelectOptionValue = string | number | boolean | Record<string, unknown> | unknown[]

const props = defineProps<{
  modelValue: unknown
  kind: DesignerDefaultValueKind
  options?: DesignerSetterOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const locale = useDesignerLocale()
const draft = ref('')
const draftTouched = ref(false)
const selectedValues = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const numberValue = computed(() => {
  const value = Number(draft.value)
  return draft.value.trim() && Number.isFinite(value) ? value : undefined
})
const booleanValue = computed(() => props.modelValue === true)
const singleValue = computed<SelectOptionValue | undefined>(() => props.modelValue === null ? undefined : props.modelValue as SelectOptionValue | undefined)
const multipleValue = computed<SelectOptionValue[]>(() => selectedValues.value as SelectOptionValue[])
const selectOptions = computed(() => (props.options ?? []).flatMap(option => option.value === null
  ? []
  : [{ label: option.label, value: option.value as SelectOptionValue }]))

watch(() => props.modelValue, value => {
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
  if (props.kind === 'number') {
    if (!draft.value) {
      emit('update:modelValue', undefined)
      return
    }
    const value = Number(draft.value)
    if (Number.isFinite(value))
      emit('update:modelValue', value)
    return
  }
  emit('update:modelValue', draft.value)
}

function commitNumber(value: number | undefined): void {
  emit('update:modelValue', Number.isFinite(value) ? value : undefined)
}

function commitChoice(value: unknown): void {
  emit('update:modelValue', value === null || value === undefined ? undefined : value)
}
</script>

<template>
  <div class="mx-config-form-designer__default-value">
    <ElInput
      v-if="kind === 'text'"
      :model-value="draft"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @update:model-value="updateDraft"
      @blur="commitDraft"
      @keydown.enter.prevent="commitDraft"
    />
    <ElInputNumber
      v-else-if="kind === 'number'"
      :model-value="numberValue"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      controls-position="right"
      @change="commitNumber"
    />
    <ElSwitch
      v-else-if="kind === 'boolean'"
      :model-value="booleanValue"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @change="commitChoice"
    />
    <ElSelect
      v-else-if="kind === 'select'"
      :model-value="singleValue"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @update:model-value="commitChoice"
    >
      <ElOption
        v-for="(option, index) in selectOptions"
        :key="index"
        :label="option.label"
        :value="option.value"
      />
    </ElSelect>
    <ElSelect
      v-else-if="kind === 'multiselect'"
      :model-value="multipleValue"
      multiple
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @update:model-value="commitChoice"
    >
      <ElOption
        v-for="(option, index) in selectOptions"
        :key="index"
        :label="option.label"
        :value="option.value"
      />
    </ElSelect>
    <ElDatePicker
      v-else-if="kind === 'date'"
      :model-value="draft"
      type="date"
      value-format="YYYY-MM-DD"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @update:model-value="commitChoice"
    />
    <ElTimePicker
      v-else
      :model-value="draft"
      format="HH:mm:ss"
      value-format="HH:mm:ss"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @update:model-value="commitChoice"
    />
  </div>
</template>
