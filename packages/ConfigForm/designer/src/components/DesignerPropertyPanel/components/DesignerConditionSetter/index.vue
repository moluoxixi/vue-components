<script setup lang="ts">
import type {
  DesignerConditionCompareOperator,
  DesignerConditionExpression,
} from '@designer/condition'
import {
  ElInput,
  ElInputNumber,
  ElOption,
  ElSegmented,
  ElSelect,
} from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '@designer/locale'

type ConditionMode = 'off' | 'always' | 'never' | 'when' | 'custom'
type LiteralType = 'text' | 'number' | 'boolean'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
  fieldOptions?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerConditionExpression | undefined]
}>()
const locale = useDesignerLocale()

const mode = ref<ConditionMode>('off')
const field = ref('')
const operator = ref<DesignerConditionCompareOperator>('eq')
const literalType = ref<LiteralType>('text')
const literalValue = ref<string | number | boolean>('')

const modes = computed<{ label: string, value: ConditionMode }[]>(() => [
  { label: locale.t('condition.off', 'Off'), value: 'off' },
  { label: locale.t('condition.always', 'Always'), value: 'always' },
  { label: locale.t('condition.never', 'Never'), value: 'never' },
  { label: locale.t('condition.when', 'When'), value: 'when' },
  { label: locale.t('condition.custom', 'Custom'), value: 'custom' },
])

const operators = computed<{ label: string, value: DesignerConditionCompareOperator }[]>(() => [
  { label: locale.t('operator.eq', 'Equals'), value: 'eq' },
  { label: locale.t('operator.neq', 'Not equal'), value: 'neq' },
  { label: locale.t('operator.gt', 'Greater than'), value: 'gt' },
  { label: locale.t('operator.gte', 'At least'), value: 'gte' },
  { label: locale.t('operator.lt', 'Less than'), value: 'lt' },
  { label: locale.t('operator.lte', 'At most'), value: 'lte' },
  { label: locale.t('operator.in', 'In'), value: 'in' },
  { label: locale.t('operator.contains', 'Contains'), value: 'contains' },
])

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
    && operators.value.some(item => item.value === value.operator)) {
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

function updateField(next: string): void {
  field.value = next
  commit()
}

function updateOperator(next: DesignerConditionCompareOperator): void {
  operator.value = next
  commit()
}

function updateLiteralValue(next: string | number | boolean): void {
  literalValue.value = next
  commit()
}

function updateNumber(next: number | undefined): void {
  updateLiteralValue(next ?? 0)
}

function updateLiteralText(next: string): void {
  literalValue.value = next
}
</script>

<template>
  <div class="mx-config-form-designer__condition-editor">
    <ElSegmented
      :model-value="mode"
      :options="modes"
      :disabled="disabled"
      :aria-label="locale.t('condition.mode', 'Condition mode')"
      @change="selectMode"
    />

    <div v-if="mode === 'when'" class="mx-config-form-designer__condition-builder">
      <ElSelect
        v-if="fieldOptions?.length"
        :model-value="field"
        :aria-label="locale.t('condition.field', 'Condition field')"
        :placeholder="locale.t('condition.selectField', 'Select field')"
        :disabled="disabled"
        @update:model-value="updateField"
      >
        <ElOption v-for="option in fieldOptions" :key="option" :label="option" :value="option" />
      </ElSelect>
      <ElInput
        v-else
        :model-value="field"
        :aria-label="locale.t('condition.field', 'Condition field')"
        :placeholder="locale.t('condition.fieldPlaceholder', 'Field name')"
        :disabled="disabled"
        @update:model-value="field = $event"
        @blur="commit"
      />
      <ElSelect
        :model-value="operator"
        :aria-label="locale.t('condition.operator', 'Condition operator')"
        :disabled="disabled"
        @update:model-value="updateOperator"
      >
        <ElOption v-for="item in operators" :key="item.value" :label="item.label" :value="item.value" />
      </ElSelect>
      <div class="mx-config-form-designer__typed-value">
        <ElSelect
          :model-value="literalType"
          :aria-label="locale.t('condition.valueType', 'Condition value type')"
          :disabled="disabled"
          @update:model-value="changeLiteralType"
        >
          <ElOption value="text" :label="locale.t('valueType.text', 'Text')" />
          <ElOption value="number" :label="locale.t('valueType.number', 'Number')" />
          <ElOption value="boolean" :label="locale.t('valueType.boolean', 'Boolean')" />
        </ElSelect>
        <ElSelect
          v-if="literalType === 'boolean'"
          :model-value="literalValue"
          :aria-label="locale.t('condition.value', 'Condition value')"
          :disabled="disabled"
          @update:model-value="updateLiteralValue"
        >
          <ElOption :value="true" :label="locale.t('value.true', 'True')" />
          <ElOption :value="false" :label="locale.t('value.false', 'False')" />
        </ElSelect>
        <ElInputNumber
          v-else-if="literalType === 'number'"
          :model-value="typeof literalValue === 'number' ? literalValue : 0"
          :aria-label="locale.t('condition.value', 'Condition value')"
          :disabled="disabled"
          controls-position="right"
          @change="updateNumber"
        />
        <ElInput
          v-else
          :model-value="typeof literalValue === 'string' ? literalValue : ''"
          :aria-label="locale.t('condition.value', 'Condition value')"
          :placeholder="locale.t('condition.valuePlaceholder', 'Value')"
          :disabled="disabled"
          @update:model-value="updateLiteralText"
          @blur="commit"
        />
      </div>
    </div>
  </div>
</template>
