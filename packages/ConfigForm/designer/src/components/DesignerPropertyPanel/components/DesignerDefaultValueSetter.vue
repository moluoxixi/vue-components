<script setup lang="ts">
import type {
  DesignerDefaultValueKind,
  DesignerSetterOption,
} from '../../../registry'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '../../../locale'

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

watch(() => props.modelValue, value => {
  draft.value = value === undefined || value === null ? '' : String(value)
  draftTouched.value = false
}, { immediate: true })

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

function isSelected(value: unknown): boolean {
  return selectedValues.value.some(selected => Object.is(selected, value))
}

function toggleValue(value: unknown): void {
  const next = [...selectedValues.value]
  const index = next.findIndex(selected => Object.is(selected, value))
  if (index >= 0)
    next.splice(index, 1)
  else
    next.push(value)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="mx-config-form-designer__default-value">
    <input
      v-if="['text', 'number', 'date', 'time'].includes(kind)"
      v-model="draft"
      :type="kind === 'text' ? 'text' : kind"
      :step="kind === 'time' ? 1 : undefined"
      :aria-label="locale.t('default.value', 'Default value')"
      :disabled="disabled"
      @input="draftTouched = true"
      @blur="commitDraft"
      @keydown.enter.prevent="commitDraft"
    >

    <div v-else-if="kind === 'boolean'" class="mx-config-form-designer__segmented" role="group" :aria-label="locale.t('default.value', 'Default value')">
      <button type="button" :class="{ 'is-active': modelValue === false }" :aria-pressed="modelValue === false" :disabled="disabled" @click="emit('update:modelValue', false)">
        {{ locale.t('switch.off', 'Off') }}
      </button>
      <button type="button" :class="{ 'is-active': modelValue === true }" :aria-pressed="modelValue === true" :disabled="disabled" @click="emit('update:modelValue', true)">
        {{ locale.t('switch.on', 'On') }}
      </button>
    </div>

    <div v-else-if="kind === 'select'" class="mx-config-form-designer__segmented" role="group" :aria-label="locale.t('default.value', 'Default value')">
      <button
        v-for="(option, index) in options"
        :key="index"
        type="button"
        :class="{ 'is-active': Object.is(option.value, modelValue) }"
        :aria-pressed="Object.is(option.value, modelValue)"
        :disabled="disabled"
        @click="emit('update:modelValue', option.value)"
      >{{ option.label }}</button>
    </div>

    <div v-else class="mx-config-form-designer__default-multiselect">
      <div class="mx-config-form-designer__choice-list" role="group" :aria-label="locale.t('default.value', 'Default value')">
        <button
          v-for="(option, index) in options"
          :key="index"
          type="button"
          :class="{ 'is-active': isSelected(option.value) }"
          :aria-pressed="isSelected(option.value)"
          :disabled="disabled"
          @click="toggleValue(option.value)"
        >{{ option.label }}</button>
      </div>
    </div>
  </div>
</template>
