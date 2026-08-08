<script setup lang="ts">
import type { DesignerJsonValue } from '../document'
import { ChevronDown, ChevronUp, Plus, Trash2 } from '@lucide/vue'
import { ref, watch } from 'vue'

type OptionValueType = 'text' | 'number' | 'boolean' | 'complex'

interface OptionDraft {
  label: string
  value: string | number | boolean
  valueType: OptionValueType
  originalValue?: unknown
  extra: Record<string, unknown>
}

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerJsonValue[]]
}>()

const rows = ref<OptionDraft[]>([])

function valueType(value: unknown): OptionValueType {
  if (typeof value === 'number')
    return 'number'
  if (typeof value === 'boolean')
    return 'boolean'
  return typeof value === 'string' ? 'text' : 'complex'
}

function syncRows(): void {
  rows.value = Array.isArray(props.modelValue)
    ? props.modelValue.map((option) => {
        const record = typeof option === 'object' && option !== null && !Array.isArray(option)
          ? option as Record<string, unknown>
          : {}
        const isPrimitive = ['string', 'number', 'boolean'].includes(typeof record.value)
        const value = isPrimitive
          ? record.value as string | number | boolean
          : ''
        return {
          label: typeof record.label === 'string' ? record.label : '',
          value,
          valueType: valueType(record.value),
          ...(!isPrimitive ? { originalValue: record.value } : {}),
          extra: Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'label' && key !== 'value')),
        }
      })
    : []
}

watch(() => props.modelValue, syncRows, { deep: true, immediate: true })

function commit(): void {
  emit('update:modelValue', rows.value.map(row => ({
    ...row.extra,
    label: row.label,
    value: (row.valueType === 'complex' ? row.originalValue ?? null : row.value) as DesignerJsonValue,
  }) as DesignerJsonValue))
}

function addRow(): void {
  rows.value.push({
    label: `Option ${rows.value.length + 1}`,
    value: `option-${rows.value.length + 1}`,
    valueType: 'text',
    extra: {},
  })
  commit()
}

function removeRow(index: number): void {
  rows.value.splice(index, 1)
  commit()
}

function moveRow(index: number, offset: -1 | 1): void {
  const target = index + offset
  if (target < 0 || target >= rows.value.length)
    return
  const [row] = rows.value.splice(index, 1)
  rows.value.splice(target, 0, row!)
  commit()
}

function changeType(row: OptionDraft, type: OptionValueType): void {
  row.valueType = type
  row.value = type === 'number' ? 0 : type === 'boolean' ? false : ''
  commit()
}

function updateNumber(row: OptionDraft, event: Event): void {
  row.value = Number((event.currentTarget as HTMLInputElement).value)
  commit()
}
</script>

<template>
  <div class="mx-config-form-designer__collection-editor" aria-label="Options editor">
    <div v-for="(row, index) in rows" :key="index" class="mx-config-form-designer__collection-row">
      <div class="mx-config-form-designer__collection-row-heading">
        <span>Option {{ index + 1 }}</span>
        <span class="mx-config-form-designer__mini-actions">
          <button type="button" class="mx-config-form-designer__mini-button" :aria-label="`Move option ${index + 1} up`" :disabled="disabled || index === 0" @click="moveRow(index, -1)">
            <ChevronUp :size="14" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__mini-button" :aria-label="`Move option ${index + 1} down`" :disabled="disabled || index === rows.length - 1" @click="moveRow(index, 1)">
            <ChevronDown :size="14" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="`Delete option ${index + 1}`" :disabled="disabled" @click="removeRow(index)">
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </span>
      </div>
      <input v-model="row.label" type="text" :aria-label="`Option ${index + 1} label`" placeholder="Label" :disabled="disabled" @blur="commit">
      <div class="mx-config-form-designer__typed-value">
        <select :value="row.valueType" :aria-label="`Option ${index + 1} value type`" :disabled="disabled" @change="changeType(row, ($event.currentTarget as HTMLSelectElement).value as OptionValueType)">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option v-if="row.valueType === 'complex'" value="complex" disabled>Structured</option>
        </select>
        <output v-if="row.valueType === 'complex'">Structured value</output>
        <select v-else-if="row.valueType === 'boolean'" v-model="row.value" :aria-label="`Option ${index + 1} value`" :disabled="disabled" @change="commit">
          <option :value="true">True</option>
          <option :value="false">False</option>
        </select>
        <input v-else-if="row.valueType === 'number'" :value="row.value" type="number" :aria-label="`Option ${index + 1} value`" :disabled="disabled" @change="updateNumber(row, $event)">
        <input v-else v-model="row.value" type="text" :aria-label="`Option ${index + 1} value`" placeholder="Value" :disabled="disabled" @blur="commit">
      </div>
    </div>
    <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addRow">
      <Plus :size="15" aria-hidden="true" />
      Add option
    </button>
  </div>
</template>
