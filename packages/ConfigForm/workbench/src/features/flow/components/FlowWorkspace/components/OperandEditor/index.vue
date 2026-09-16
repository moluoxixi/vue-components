<script setup lang="ts">
import type {
  ConfigFormJsonValue,
  ConfigFormReactionOperand,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { FlowValueOption } from '../../types'
import type { OperandEditorEmits, OperandEditorProps } from './types'
import { computed } from 'vue'
import { ValueEditor } from '../ValueEditor'

const props = withDefaults(defineProps<OperandEditorProps>(), { disabled: false })
const emit = defineEmits<OperandEditorEmits>()
type OperandSource = 'literal' | 'field' | 'event' | 'output' | 'expression'

const outputExpressions = computed(() => props.outputs.map(option => ({
  ...option,
  expression: expressionForOutput(option.value),
})).filter(option => option.expression))
const selectedOutput = computed(() => {
  const value = props.modelValue
  return value.kind === 'expression'
    ? outputExpressions.value.find(option => option.expression === value.expression)?.key
    : undefined
})
const selectedEvent = computed(() => {
  const value = props.modelValue
  return value.kind === 'expression'
    ? props.eventArguments.find(option => expressionForEvent(option) === value.expression)?.value
    : undefined
})
const selectedField = computed(() => props.modelValue.kind === 'field' ? props.modelValue.field : '')
/**
 * Vue infers `ValueEditor`'s `modelValue` runtime type as
 * `[Boolean, null, Number, String, Object, Array]`. `Boolean` precedes `String`, so Vue's boolean
 * casting rewrites a bound `''` into `true`; an empty text literal would then render as a boolean
 * switch with no way to type a value. An unset value renders the same empty text control, so the
 * empty string is normalized away on this boundary.
 */
const literalEditorValue = computed<ConfigFormValueInput | undefined>(() => {
  const operand = props.modelValue
  if (operand.kind !== 'literal')
    return undefined
  return operand.value === '' ? undefined : operand.value
})
const source = computed<OperandSource>(() => {
  if (props.modelValue.kind === 'field')
    return 'field'
  if (props.modelValue.kind === 'literal')
    return 'literal'
  if (selectedEvent.value)
    return 'event'
  if (selectedOutput.value)
    return 'output'
  return 'expression'
})

function update(value: ConfigFormReactionOperand): void {
  if (!props.disabled)
    emit('update:modelValue', value)
}

function updateLiteral(value: ConfigFormValueInput): void {
  update({ kind: 'literal', value: value as ConfigFormJsonValue })
}

function changeSource(value: OperandSource): void {
  if (value === 'literal')
    update({ kind: 'literal', value: '' })
  else if (value === 'field' && props.fields[0])
    update({ kind: 'field', field: props.fields[0].field })
  else if (value === 'event' && props.eventArguments[0])
    update({ kind: 'expression', expression: expressionForEvent(props.eventArguments[0]) })
  else if (value === 'output' && outputExpressions.value[0])
    update({ kind: 'expression', expression: outputExpressions.value[0].expression })
  else if (value === 'expression')
    update({ kind: 'expression', expression: '' })
}

function setEvent(value: string): void {
  const option = props.eventArguments.find(item => item.value === value)
  if (option)
    update({ kind: 'expression', expression: expressionForEvent(option) })
}

function setOutput(key: string): void {
  const option = outputExpressions.value.find(item => item.key === key)
  if (option)
    update({ kind: 'expression', expression: option.expression })
}

function expressionForEvent(option: FlowValueOption): string {
  return expressionForPath('$event', option.path ?? option.value.split('.').filter(Boolean))
}

function expressionForOutput(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.$ref))
    return ''
  const reference = value.$ref
  if (reference.kind === 'expression' && typeof reference.source === 'string')
    return reference.source
  if (reference.kind !== 'output' || typeof reference.stepId !== 'string')
    return ''
  const path = Array.isArray(reference.path) && reference.path.every(segment => typeof segment === 'string')
    ? reference.path
    : []
  return expressionForPath(`$outputs[${JSON.stringify(reference.stepId)}]`, path)
}

function expressionForPath(root: string, path: readonly string[]): string {
  return path.reduce((source, segment) => /^\d+$/.test(segment)
    ? `${source}[${segment}]`
    : `${source}[${JSON.stringify(segment)}]`, root)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
</script>

<template>
  <div class="flow-operand-editor">
    <ElSelect :model-value="source" :disabled="disabled" :aria-label="locale.t('flow.condition.operandSource', 'Value source')" append-to="#workbench-overlays" @change="changeSource">
      <ElOption value="literal" :label="locale.t('flow.input.static', 'Fixed value')" />
      <ElOption value="field" :disabled="fields.length === 0" :label="locale.t('flow.input.field', 'Form field')" />
      <ElOption value="event" :disabled="eventArguments.length === 0" :label="locale.t('flow.input.event', 'Event parameter')" />
      <ElOption value="output" :disabled="outputExpressions.length === 0" :label="locale.t('flow.input.output', 'Earlier action result')" />
      <ElOption value="expression" :label="locale.t('flow.input.expression', 'Advanced expression')" />
    </ElSelect>

    <ValueEditor
      v-if="modelValue.kind === 'literal'"
      :model-value="literalEditorValue"
      :allow-references="false"
      :disabled="disabled"
      :fields="fields"
      :event-arguments="eventArguments"
      :outputs="outputs"
      :locale="locale"
      @update:model-value="updateLiteral"
    />
    <ElSelect v-else-if="modelValue.kind === 'field'" :model-value="selectedField" :disabled="disabled" filterable append-to="#workbench-overlays" @change="update({ kind: 'field', field: $event })">
      <ElOption v-if="!fields.some(field => field.field === selectedField)" :value="selectedField" :label="locale.t('flow.source.unavailableField', 'Unavailable field')" />
      <ElOption v-for="field in fields" :key="field.nodeId" :value="field.field" :label="field.label" />
    </ElSelect>
    <ElSelect v-else-if="source === 'event'" :model-value="selectedEvent" :disabled="disabled" append-to="#workbench-overlays" @change="setEvent">
      <ElOption v-for="argument in eventArguments" :key="argument.value" :value="argument.value" :label="argument.label" />
    </ElSelect>
    <ElSelect v-else-if="source === 'output'" :model-value="selectedOutput" :disabled="disabled" append-to="#workbench-overlays" @change="setOutput">
      <ElOption v-for="output in outputExpressions" :key="output.key" :value="output.key" :label="output.label" />
    </ElSelect>
    <ElInput v-else-if="modelValue.kind === 'expression'" :model-value="modelValue.expression" :disabled="disabled" :aria-label="locale.t('flow.input.expression', 'Advanced expression')" @update:model-value="update({ kind: 'expression', expression: $event })" />
  </div>
</template>

<style scoped>
.flow-operand-editor { display: grid; min-width: 0; grid-template-columns: minmax(105px, .75fr) minmax(130px, 1.25fr); gap: 6px; }
@media (max-width: 620px) { .flow-operand-editor { grid-template-columns: minmax(0, 1fr); } }
</style>
