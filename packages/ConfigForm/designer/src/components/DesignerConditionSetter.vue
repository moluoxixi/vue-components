<script setup lang="ts">
import type {
  DesignerConditionCompareOperator,
  DesignerConditionExpression,
} from '../condition'
import { ref, watch } from 'vue'

type ConditionMode = 'off' | 'always' | 'never' | 'when' | 'custom'
type LiteralType = 'text' | 'number' | 'boolean'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerConditionExpression | undefined]
}>()

const mode = ref<ConditionMode>('off')
const field = ref('')
const operator = ref<DesignerConditionCompareOperator>('eq')
const literalType = ref<LiteralType>('text')
const literalValue = ref<string | number | boolean>('')

const modes: { label: string, value: ConditionMode }[] = [
  { label: 'Off', value: 'off' },
  { label: 'Always', value: 'always' },
  { label: 'Never', value: 'never' },
  { label: 'When', value: 'when' },
  { label: 'Custom', value: 'custom' },
]

const operators: { label: string, value: DesignerConditionCompareOperator }[] = [
  { label: 'Equals', value: 'eq' },
  { label: 'Not equal', value: 'neq' },
  { label: 'Greater than', value: 'gt' },
  { label: 'At least', value: 'gte' },
  { label: 'Less than', value: 'lt' },
  { label: 'At most', value: 'lte' },
  { label: 'In', value: 'in' },
  { label: 'Contains', value: 'contains' },
]

function syncValue(): void {
  if (typeof props.modelValue !== 'object' || props.modelValue === null || Array.isArray(props.modelValue)) {
    mode.value = 'off'
    return
  }
  const value = props.modelValue as Record<string, unknown>
  if (value.kind === 'literal' && typeof value.value === 'boolean') {
    mode.value = value.value ? 'always' : 'never'
    return
  }
  const left = typeof value.left === 'object' && value.left !== null && !Array.isArray(value.left)
    ? value.left as Record<string, unknown>
    : undefined
  const right = typeof value.right === 'object' && value.right !== null && !Array.isArray(value.right)
    ? value.right as Record<string, unknown>
    : undefined
  if (value.kind === 'compare'
    && left?.kind === 'field'
    && typeof left.field === 'string'
    && right?.kind === 'literal'
    && operators.some(item => item.value === value.operator)) {
    field.value = left.field
    operator.value = value.operator as DesignerConditionCompareOperator
    const nextValue = right.value
    if (typeof nextValue === 'number' || typeof nextValue === 'boolean' || typeof nextValue === 'string') {
      mode.value = 'when'
      literalType.value = typeof nextValue === 'string' ? 'text' : typeof nextValue as 'number' | 'boolean'
      literalValue.value = nextValue
      return
    }
  }
  mode.value = 'custom'
}

watch(() => props.modelValue, syncValue, { deep: true, immediate: true })

function commit(): void {
  if (mode.value === 'custom')
    return
  if (mode.value === 'off') {
    emit('update:modelValue', undefined)
    return
  }
  if (mode.value === 'always' || mode.value === 'never') {
    emit('update:modelValue', { kind: 'literal', value: mode.value === 'always' })
    return
  }
  if (!field.value.trim())
    return
  emit('update:modelValue', {
    kind: 'compare',
    operator: operator.value,
    left: { kind: 'field', field: field.value.trim() },
    right: { kind: 'literal', value: literalValue.value },
  })
}

function selectMode(next: ConditionMode): void {
  mode.value = next
  commit()
}

function changeLiteralType(next: LiteralType): void {
  literalType.value = next
  literalValue.value = next === 'number' ? 0 : next === 'boolean' ? false : ''
  commit()
}

function updateNumber(event: Event): void {
  literalValue.value = Number((event.currentTarget as HTMLInputElement).value)
  commit()
}
</script>

<template>
  <div class="mx-config-form-designer__condition-editor">
    <div class="mx-config-form-designer__segmented" role="group" aria-label="Condition mode">
      <button
        v-for="item in modes"
        :key="item.value"
        type="button"
        :class="{ 'is-active': mode === item.value }"
        :aria-pressed="mode === item.value"
        :disabled="disabled"
        @click="selectMode(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="mode === 'when'" class="mx-config-form-designer__condition-builder">
      <input v-model="field" type="text" aria-label="Condition field" placeholder="Field name" :disabled="disabled" @blur="commit">
      <select v-model="operator" aria-label="Condition operator" :disabled="disabled" @change="commit">
        <option v-for="item in operators" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <div class="mx-config-form-designer__typed-value">
        <select :value="literalType" aria-label="Condition value type" :disabled="disabled" @change="changeLiteralType(($event.currentTarget as HTMLSelectElement).value as LiteralType)">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
        <select v-if="literalType === 'boolean'" v-model="literalValue" aria-label="Condition value" :disabled="disabled" @change="commit">
          <option :value="true">True</option>
          <option :value="false">False</option>
        </select>
        <input v-else-if="literalType === 'number'" :value="literalValue" type="number" aria-label="Condition value" :disabled="disabled" @change="updateNumber">
        <input v-else v-model="literalValue" type="text" aria-label="Condition value" placeholder="Value" :disabled="disabled" @blur="commit">
      </div>
    </div>
  </div>
</template>
