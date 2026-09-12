<script setup lang="ts">
import type {
  ConfigFormReactionCompareOperator,
  ConfigFormReactionCondition,
  ConfigFormReactionOperand,
} from '@moluoxixi/config-form-core'
import type { ConditionEditorEmits, ConditionEditorProps } from './types'
import { Plus, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { OperandEditor } from '../OperandEditor'

defineOptions({ name: 'FlowConditionEditor' })
const props = withDefaults(defineProps<ConditionEditorProps>(), {
  disabled: false,
  removable: false,
})
const emit = defineEmits<ConditionEditorEmits>()

type ConditionMode = 'always' | 'never' | 'compare' | 'and' | 'or' | 'not' | 'expression'
const mode = computed<ConditionMode>(() => props.modelValue.kind === 'literal'
  ? props.modelValue.value ? 'always' : 'never'
  : props.modelValue.kind)
const operators: ConfigFormReactionCompareOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']

function update(value: ConfigFormReactionCondition): void {
  if (!props.disabled)
    emit('update:modelValue', value)
}

function changeMode(value: ConditionMode): void {
  if (value === 'always' || value === 'never') {
    update({ kind: 'literal', value: value === 'always' })
    return
  }
  if (value === 'compare') {
    update({
      kind: 'compare',
      operator: 'eq',
      left: props.fields[0]
        ? { kind: 'field', field: props.fields[0].field }
        : { kind: 'literal', value: '' },
      right: { kind: 'literal', value: '' },
    })
    return
  }
  if (value === 'and' || value === 'or') {
    update({ kind: value, expressions: [{ kind: 'literal', value: true }] })
    return
  }
  if (value === 'not') {
    update({ kind: 'not', expression: { kind: 'literal', value: true } })
    return
  }
  update({ kind: 'expression', expression: '' })
}

function updateCompare(part: 'operator' | 'left' | 'right', value: ConfigFormReactionCompareOperator | ConfigFormReactionOperand): void {
  if (props.modelValue.kind !== 'compare')
    return
  update({ ...props.modelValue, [part]: value } as ConfigFormReactionCondition)
}

function addNested(): void {
  if (props.modelValue.kind !== 'and' && props.modelValue.kind !== 'or')
    return
  update({
    ...props.modelValue,
    expressions: [...props.modelValue.expressions, { kind: 'literal', value: true }],
  })
}

function updateNested(index: number, value: ConfigFormReactionCondition): void {
  if (props.modelValue.kind !== 'and' && props.modelValue.kind !== 'or')
    return
  const expressions = [...props.modelValue.expressions]
  expressions[index] = value
  update({ ...props.modelValue, expressions })
}

function removeNested(index: number): void {
  if (props.modelValue.kind !== 'and' && props.modelValue.kind !== 'or')
    return
  update({
    ...props.modelValue,
    expressions: props.modelValue.expressions.filter((_, itemIndex) => itemIndex !== index),
  })
}

function operatorLabel(operator: ConfigFormReactionCompareOperator): string {
  const fallbacks: Record<ConfigFormReactionCompareOperator, string> = {
    eq: 'Equals',
    neq: 'Does not equal',
    gt: 'Greater than',
    gte: 'At least',
    lt: 'Less than',
    lte: 'At most',
    in: 'Is in',
    contains: 'Contains',
  }
  return props.locale.t(`operator.${operator}`, fallbacks[operator])
}
</script>

<template>
  <div class="flow-condition-editor" :class="{ 'is-nested': removable }">
    <div class="flow-condition-heading">
      <ElSelect :model-value="mode" :disabled="disabled" :aria-label="locale.t('flow.condition.kind', 'Condition type')" append-to="#workbench-overlays" @change="changeMode">
        <ElOption value="compare" :label="locale.t('flow.condition.compare', 'Compare values')" />
        <ElOption value="and" :label="locale.t('flow.condition.and', 'All conditions (AND)')" />
        <ElOption value="or" :label="locale.t('flow.condition.or', 'Any condition (OR)')" />
        <ElOption value="not" :label="locale.t('flow.condition.not', 'Not')" />
        <ElOption value="always" :label="locale.t('condition.always', 'Always')" />
        <ElOption value="never" :label="locale.t('condition.never', 'Never')" />
        <ElOption value="expression" :label="locale.t('flow.input.expression', 'Advanced expression')" />
      </ElSelect>
      <ElButton v-if="removable" text :disabled="disabled" :title="locale.t('flow.condition.remove', 'Remove condition')" :aria-label="locale.t('flow.condition.remove', 'Remove condition')" @click="emit('remove')">
        <Trash2 :size="14" aria-hidden="true" />
      </ElButton>
    </div>

    <template v-if="modelValue.kind === 'compare'">
      <OperandEditor
        :model-value="modelValue.left"
        :disabled="disabled"
        :fields="fields"
        :event-arguments="eventArguments"
        :outputs="outputs"
        :locale="locale"
        @update:model-value="updateCompare('left', $event)"
      />
      <ElSelect :model-value="modelValue.operator" :disabled="disabled" :aria-label="locale.t('condition.operator', 'Comparison')" append-to="#workbench-overlays" @change="updateCompare('operator', $event)">
        <ElOption v-for="operator in operators" :key="operator" :value="operator" :label="operatorLabel(operator)" />
      </ElSelect>
      <OperandEditor
        :model-value="modelValue.right"
        :disabled="disabled"
        :fields="fields"
        :event-arguments="eventArguments"
        :outputs="outputs"
        :locale="locale"
        @update:model-value="updateCompare('right', $event)"
      />
    </template>

    <template v-else-if="modelValue.kind === 'and' || modelValue.kind === 'or'">
      <div class="flow-condition-children">
        <FlowConditionEditor
          v-for="(condition, index) in modelValue.expressions"
          :key="index"
          :model-value="condition"
          :disabled="disabled"
          :fields="fields"
          :event-arguments="eventArguments"
          :outputs="outputs"
          :locale="locale"
          removable
          @update:model-value="updateNested(index, $event)"
          @remove="removeNested(index)"
        />
      </div>
      <ElButton :disabled="disabled" @click="addNested">
        <Plus :size="14" aria-hidden="true" />
        {{ locale.t('flow.condition.add', 'Add condition') }}
      </ElButton>
    </template>

    <FlowConditionEditor
      v-else-if="modelValue.kind === 'not'"
      :model-value="modelValue.expression"
      :disabled="disabled"
      :fields="fields"
      :event-arguments="eventArguments"
      :outputs="outputs"
      :locale="locale"
      @update:model-value="update({ kind: 'not', expression: $event })"
    />

    <ElInput
      v-else-if="modelValue.kind === 'expression'"
      :model-value="modelValue.expression"
      :disabled="disabled"
      :aria-label="locale.t('flow.input.expression', 'Advanced expression')"
      @update:model-value="update({ kind: 'expression', expression: $event })"
    />
  </div>
</template>

<style scoped>
.flow-condition-editor { display: grid; min-width: 0; gap: 7px; }
.flow-condition-editor.is-nested { padding: 8px 0 8px 10px; border-left: 2px solid var(--wb-control-border); }
.flow-condition-heading { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
.flow-condition-heading .el-button { width: 28px; min-height: 28px; padding: 0; }
.flow-condition-children { display: grid; min-width: 0; gap: 7px; }
</style>
