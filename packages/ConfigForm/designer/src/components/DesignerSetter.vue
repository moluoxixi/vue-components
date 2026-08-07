<script setup lang="ts">
import type { DesignerPropertySetterDefinition } from '../registry'
import { Check, RotateCcw } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  setter: DesignerPropertySetterDefinition
  value: unknown
  readonly?: boolean
}>()

const emit = defineEmits<{
  commit: [value: unknown]
}>()

const textDraft = ref('')
const jsonDraft = ref('')
const error = ref('')
const compound = computed(() => ['options', 'condition', 'validation'].includes(props.setter.control))
const selectedOptionIndex = computed(() => props.setter.options
  ?.findIndex(option => Object.is(option.value, props.value)))

function displayText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function resetDraft(): void {
  textDraft.value = displayText(props.value)
  jsonDraft.value = props.value === undefined ? '' : JSON.stringify(props.value, null, 2)
  error.value = ''
}

watch(() => props.value, resetDraft, { deep: true, immediate: true })

function commitText(): void {
  const next = textDraft.value
  if (props.setter.control === 'number') {
    emit('commit', next.trim() ? Number(next) : undefined)
    return
  }
  emit('commit', next || undefined)
}

function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && props.setter.control !== 'textarea') {
    event.preventDefault()
    commitText()
    ;(event.currentTarget as HTMLElement).blur()
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    resetDraft()
    ;(event.currentTarget as HTMLElement).blur()
  }
}

function commitBoolean(event: Event): void {
  emit('commit', (event.currentTarget as HTMLInputElement).checked)
}

function commitSelect(event: Event): void {
  const index = Number((event.currentTarget as HTMLSelectElement).value)
  emit('commit', props.setter.options?.[index]?.value)
}

function applyJson(): void {
  if (!jsonDraft.value.trim()) {
    emit('commit', undefined)
    error.value = ''
    return
  }
  try {
    emit('commit', JSON.parse(jsonDraft.value))
    error.value = ''
  }
  catch {
    error.value = 'Invalid JSON'
  }
}

function commitCustom(value: unknown): void {
  emit('commit', value)
}
</script>

<template>
  <label class="mx-config-form-designer__setter" :class="{ 'is-compound': compound }">
    <span class="mx-config-form-designer__setter-label">{{ setter.label }}</span>

    <input
      v-if="setter.control === 'text' || setter.control === 'number'"
      v-model="textDraft"
      :type="setter.control === 'number' ? 'number' : 'text'"
      :disabled="readonly"
      @blur="commitText"
      @keydown="handleTextKeydown"
    >
    <textarea
      v-else-if="setter.control === 'textarea'"
      v-model="textDraft"
      rows="3"
      :disabled="readonly"
      @blur="commitText"
      @keydown.esc.prevent="resetDraft"
    />
    <input
      v-else-if="setter.control === 'boolean'"
      type="checkbox"
      :checked="Boolean(value)"
      :disabled="readonly"
      @change="commitBoolean"
    >
    <select
      v-else-if="setter.control === 'select'"
      :value="selectedOptionIndex"
      :disabled="readonly"
      @change="commitSelect"
    >
      <option v-for="(option, index) in setter.options" :key="index" :value="index">
        {{ option.label }}
      </option>
    </select>
    <component
      :is="setter.component"
      v-else-if="setter.control === 'custom' && setter.component"
      :model-value="value"
      :disabled="readonly"
      @update:model-value="commitCustom"
    />
    <template v-else>
      <textarea v-model="jsonDraft" rows="8" spellcheck="false" :disabled="readonly" />
      <span v-if="error" class="mx-config-form-designer__setter-error" role="alert">{{ error }}</span>
      <span class="mx-config-form-designer__setter-actions">
        <button type="button" class="mx-config-form-designer__command-button" :disabled="readonly" @click="applyJson">
          <Check :size="15" aria-hidden="true" /> Apply
        </button>
        <button type="button" class="mx-config-form-designer__command-button is-secondary" :disabled="readonly" @click="resetDraft">
          <RotateCcw :size="15" aria-hidden="true" /> Cancel
        </button>
      </span>
    </template>
  </label>
</template>
