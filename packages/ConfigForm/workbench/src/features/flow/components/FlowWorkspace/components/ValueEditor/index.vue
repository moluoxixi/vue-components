<script setup lang="ts">
import type {
  ConfigFormJsonValue,
  ConfigFormValueInput,
  ConfigFormValueReference,
} from '@moluoxixi/config-form-core'
import type { FlowValueOption } from '../../types'
import type { ValueEditorEmits, ValueEditorProps } from './types'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cloneWorkbenchJson as structuredClone } from '../../../../../../utils'

defineOptions({ name: 'FlowValueEditor' })
const props = withDefaults(defineProps<ValueEditorProps>(), {
  allowReferences: true,
  control: 'value',
  dataSources: () => [],
  disabled: false,
  invalid: false,
  options: () => [],
  required: false,
  variables: () => [],
})
const emit = defineEmits<ValueEditorEmits>()
const keyError = ref('')

type SourceKind = 'static' | 'field' | 'variable' | 'event' | 'output' | 'expression'
type StaticKind = 'text' | 'number' | 'boolean' | 'null' | 'object' | 'array'

const reference = computed(() => props.allowReferences ? readReference(props.modelValue) : undefined)
const literalReference = computed(() => reference.value?.kind === 'literal' ? reference.value : undefined)
const editableValue = computed<ConfigFormJsonValue | undefined>(() => literalReference.value
  ? literalReference.value.value
  : props.modelValue as ConfigFormJsonValue | undefined)
const sourceKind = computed<SourceKind>(() => {
  const kind = reference.value?.kind
  return kind && kind !== 'literal' ? kind : 'static'
})
const matchingOutputKey = computed(() => props.outputs.find(option => sameValue(option.value, props.modelValue))?.key)
const enumSelection = computed(() => props.options.findIndex(option => sameValue(option.value, editableValue.value)))
const staticKind = computed<StaticKind>(() => {
  const value = editableValue.value
  if (Array.isArray(value))
    return 'array'
  if (value === null)
    return 'null'
  if (isPlainObject(value))
    return 'object'
  if (typeof value === 'number')
    return 'number'
  if (typeof value === 'boolean')
    return 'boolean'
  return 'text'
})
const objectEntries = computed(() => isPlainObject(editableValue.value)
  ? Object.entries(editableValue.value)
  : [])
const arrayEntries = computed(() => Array.isArray(editableValue.value) ? editableValue.value : [])
const fieldReference = computed(() => reference.value?.kind === 'field' ? reference.value.nodeId : '')
const variableReference = computed(() => reference.value?.kind === 'variable' ? reference.value.variableId : '')
const eventReference = computed(() => reference.value?.kind === 'event' ? reference.value.path : [])
const eventSelection = computed(() => props.eventArguments.find(option => samePath(eventPath(option), eventReference.value))?.value)
const expressionReference = computed(() => reference.value?.kind === 'expression' ? reference.value.source : '')
const nestedReferencesAllowed = computed(() => props.allowReferences && !literalReference.value)

function update(value: ConfigFormValueInput): void {
  if (!props.disabled)
    emit('update:modelValue', value)
}

function updateStatic(value: ConfigFormJsonValue): void {
  if (!props.allowReferences) {
    update(value)
    return
  }
  if (literalReference.value || needsLiteralEscape(value)) {
    update({ $ref: { kind: 'literal', value } })
    return
  }
  update(value)
}

function changeSource(next: SourceKind): void {
  if (next === 'static') {
    update(defaultStaticValue())
    return
  }
  if (next === 'field') {
    if (props.fields[0])
      update({ $ref: { kind: 'field', nodeId: props.fields[0].nodeId } })
    return
  }
  if (next === 'variable') {
    if (props.variables[0])
      update({ $ref: { kind: 'variable', variableId: props.variables[0].value } })
    return
  }
  if (next === 'event') {
    if (props.eventArguments[0])
      update({ $ref: { kind: 'event', path: eventPath(props.eventArguments[0]) } })
    return
  }
  if (next === 'output') {
    if (props.outputs[0])
      update(structuredClone(props.outputs[0].value))
    return
  }
  update({ $ref: { kind: 'expression', source: '' } })
}

function defaultStaticValue(): ConfigFormJsonValue {
  if (props.control === 'number')
    return 0
  if (props.control === 'boolean')
    return false
  if (props.control === 'object')
    return {}
  if (props.control === 'array')
    return []
  if (props.control === 'enum')
    return structuredClone(props.options[0]?.value ?? '')
  return ''
}

function changeStaticKind(kind: StaticKind): void {
  const defaults: Record<StaticKind, ConfigFormJsonValue> = {
    text: '',
    number: 0,
    boolean: false,
    null: null,
    object: {},
    array: [],
  }
  updateStatic(defaults[kind])
}

function updateField(nodeId: string): void {
  const current = reference.value
  update({
    $ref: {
      kind: 'field',
      nodeId,
      ...(current?.kind === 'field' && current.scope ? { scope: current.scope } : {}),
    },
  })
}

function updateVariable(variableId: string): void {
  update({ $ref: { kind: 'variable', variableId } })
}

function updateEvent(value: string): void {
  const option = props.eventArguments.find(item => item.value === value)
  if (option)
    update({ $ref: { kind: 'event', path: eventPath(option) } })
}

function updateOutput(key: string): void {
  const option = props.outputs.find(item => item.key === key)
  if (option)
    update(structuredClone(option.value))
}

function updateExpression(source: string): void {
  update({ $ref: { kind: 'expression', source } })
}

function updateEnum(index: number): void {
  const option = props.options[index]
  if (option)
    updateStatic(structuredClone(option.value))
}

function updateObjectValue(key: string, value: ConfigFormValueInput): void {
  const current = isPlainObject(editableValue.value) ? editableValue.value : {}
  updateStatic({ ...current, [key]: value as ConfigFormJsonValue })
}

function addObjectEntry(): void {
  const current = isPlainObject(editableValue.value) ? editableValue.value : {}
  let index = Object.keys(current).length + 1
  while (Object.hasOwn(current, `key${index}`))
    index += 1
  updateStatic({ ...current, [`key${index}`]: '' })
}

function renameObjectEntry(previous: string, nextValue: unknown): void {
  const next = String(nextValue).trim()
  const current = isPlainObject(editableValue.value) ? editableValue.value : {}
  if (!isSafeKey(next) || (next !== previous && Object.hasOwn(current, next))) {
    keyError.value = props.locale.t('flow.input.invalidKey', 'Enter a unique property name.')
    return
  }
  keyError.value = ''
  const renamed: Record<string, ConfigFormJsonValue> = {}
  Object.entries(current).forEach(([key, value]) => {
    renamed[key === previous ? next : key] = value
  })
  updateStatic(renamed)
}

function removeObjectEntry(key: string): void {
  const current = isPlainObject(editableValue.value) ? editableValue.value : {}
  const next = { ...current }
  delete next[key]
  updateStatic(next)
}

function addArrayEntry(): void {
  updateStatic([...arrayEntries.value, ''])
}

function updateArrayEntry(index: number, value: ConfigFormValueInput): void {
  const next = [...arrayEntries.value]
  next[index] = value as ConfigFormJsonValue
  updateStatic(next)
}

function removeArrayEntry(index: number): void {
  updateStatic(arrayEntries.value.filter((_, itemIndex) => itemIndex !== index))
}

function moveArrayEntry(index: number, direction: -1 | 1): void {
  const destination = index + direction
  if (destination < 0 || destination >= arrayEntries.value.length)
    return
  const next = [...arrayEntries.value]
  const [value] = next.splice(index, 1)
  next.splice(destination, 0, value!)
  updateStatic(next)
}

function eventPath(option: FlowValueOption): string[] {
  return option.path ? [...option.path] : option.value.split('.').filter(Boolean)
}

function readReference(value: unknown): ConfigFormValueReference | undefined {
  if (!isPlainRecord(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, '$ref'))
    return undefined
  const candidate = value.$ref
  if (!isPlainRecord(candidate) || typeof candidate.kind !== 'string')
    return undefined
  const keys = Object.keys(candidate)
  if (candidate.kind === 'literal' && hasOnlyKeys(keys, ['kind', 'value']) && Object.hasOwn(candidate, 'value'))
    return candidate as unknown as ConfigFormValueReference
  if (candidate.kind === 'field' && hasOnlyKeys(keys, ['kind', 'nodeId', 'scope']) && typeof candidate.nodeId === 'string')
    return candidate as unknown as ConfigFormValueReference
  if (candidate.kind === 'variable' && hasOnlyKeys(keys, ['kind', 'variableId']) && typeof candidate.variableId === 'string')
    return candidate as unknown as ConfigFormValueReference
  if (candidate.kind === 'event' && hasOnlyKeys(keys, ['kind', 'path']) && isStringPath(candidate.path))
    return candidate as unknown as ConfigFormValueReference
  if (candidate.kind === 'output' && hasOnlyKeys(keys, ['kind', 'stepId', 'path']) && typeof candidate.stepId === 'string' && (candidate.path === undefined || isStringPath(candidate.path)))
    return candidate as unknown as ConfigFormValueReference
  if (candidate.kind === 'expression' && hasOnlyKeys(keys, ['kind', 'source']) && typeof candidate.source === 'string')
    return candidate as unknown as ConfigFormValueReference
  return undefined
}

function needsLiteralEscape(value: unknown): boolean {
  if (Array.isArray(value))
    return value.some(needsLiteralEscape)
  if (!isPlainRecord(value))
    return false
  if (Object.hasOwn(value, '$ref'))
    return readReference(value) === undefined
  return Object.values(value).some(needsLiteralEscape)
}

function hasOnlyKeys(actual: readonly string[], allowed: readonly string[]): boolean {
  return actual.every(key => allowed.includes(key))
}

function isStringPath(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(segment => typeof segment === 'string')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, ConfigFormJsonValue> {
  return isPlainRecord(value)
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isSafeKey(value: string): boolean {
  return !!value && !['__proto__', 'prototype', 'constructor'].includes(value)
}
</script>

<template>
  <div
    class="flow-value-editor"
    :aria-invalid="invalid || undefined"
    :aria-required="required || undefined"
    :tabindex="invalid ? -1 : undefined"
  >
    <ElSelect
      v-if="allowReferences"
      class="flow-value-source"
      :model-value="sourceKind"
      :disabled="disabled"
      :aria-label="locale.t('flow.input.source', 'Value source')"
      :aria-invalid="invalid || undefined"
      :aria-required="required || undefined"
      append-to="#workbench-overlays"
      @change="changeSource"
    >
      <ElOption value="static" :label="locale.t('flow.input.static', 'Fixed value')" />
      <ElOption value="field" :disabled="fields.length === 0" :label="locale.t('flow.input.field', 'Form field')" />
      <ElOption value="variable" :disabled="variables.length === 0" :label="locale.t('flow.input.variable', 'Variable')" />
      <ElOption value="event" :disabled="eventArguments.length === 0" :label="locale.t('flow.input.event', 'Event parameter')" />
      <ElOption value="output" :disabled="outputs.length === 0" :label="locale.t('flow.input.output', 'Earlier action result')" />
      <ElOption value="expression" :label="locale.t('flow.input.expression', 'Advanced expression')" />
    </ElSelect>

    <template v-if="sourceKind === 'field'">
      <ElSelect
        :model-value="fieldReference"
        :disabled="disabled"
        filterable
        append-to="#workbench-overlays"
        :aria-label="locale.t('flow.input.field', 'Form field')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @change="updateField"
      >
        <ElOption v-if="fieldReference && !fields.some(item => item.nodeId === fieldReference)" :value="fieldReference" :label="locale.t('flow.source.unavailableField', 'Unavailable field')" />
        <ElOption v-for="field in fields" :key="field.nodeId" :value="field.nodeId" :label="field.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'variable'">
      <ElSelect
        :model-value="variableReference"
        :disabled="disabled"
        filterable
        append-to="#workbench-overlays"
        :aria-label="locale.t('flow.input.variable', 'Variable')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @change="updateVariable"
      >
        <ElOption v-if="variableReference && !variables.some(item => item.value === variableReference)" :value="variableReference" :label="locale.t('flow.source.unavailableVariable', 'Unavailable variable')" />
        <ElOption v-for="variable in variables" :key="variable.value" :value="variable.value" :label="variable.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'event'">
      <ElSelect
        :model-value="eventSelection ?? '__unavailable'"
        :disabled="disabled"
        append-to="#workbench-overlays"
        :aria-label="locale.t('flow.input.event', 'Event parameter')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @change="updateEvent"
      >
        <ElOption v-if="!eventSelection" value="__unavailable" disabled :label="locale.t('flow.source.unavailableEvent', 'Unavailable event parameter')" />
        <ElOption v-for="argument in eventArguments" :key="argument.value" :value="argument.value" :label="argument.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'output'">
      <ElSelect
        :model-value="matchingOutputKey ?? '__unavailable'"
        :disabled="disabled"
        append-to="#workbench-overlays"
        :aria-label="locale.t('flow.input.output', 'Earlier action result')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @change="updateOutput"
      >
        <ElOption v-if="!matchingOutputKey" value="__unavailable" disabled :label="locale.t('flow.source.unavailableOutput', 'Unavailable earlier result')" />
        <ElOption v-for="output in outputs" :key="output.key" :value="output.key" :label="output.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'expression'">
      <ElInput
        :model-value="expressionReference"
        :disabled="disabled"
        :aria-label="locale.t('flow.input.expression', 'Advanced expression')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @update:model-value="updateExpression"
      />
    </template>

    <template v-else>
      <ElSelect
        v-if="control === 'value'"
        class="flow-value-kind"
        :model-value="staticKind"
        :disabled="disabled"
        :aria-label="locale.t('flow.input.valueType', 'Value type')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        append-to="#workbench-overlays"
        @change="changeStaticKind"
      >
        <ElOption value="text" :label="locale.t('valueType.text', 'Text')" />
        <ElOption value="number" :label="locale.t('valueType.number', 'Number')" />
        <ElOption value="boolean" :label="locale.t('valueType.boolean', 'Boolean')" />
        <ElOption value="null" :label="locale.t('flow.input.empty', 'Empty')" />
        <ElOption value="object" :label="locale.t('flow.input.object', 'Key/value object')" />
        <ElOption value="array" :label="locale.t('flow.input.array', 'List')" />
      </ElSelect>

      <ElInputNumber
        v-if="control === 'number' || (control === 'value' && staticKind === 'number')"
        :model-value="typeof editableValue === 'number' ? editableValue : 0"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        controls-position="right"
        @change="updateStatic($event ?? 0)"
      />
      <ElSwitch
        v-else-if="control === 'boolean' || (control === 'value' && staticKind === 'boolean')"
        :model-value="editableValue === true"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @change="updateStatic(Boolean($event))"
      />
      <ElSelect
        v-else-if="control === 'enum'"
        :model-value="enumSelection"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        append-to="#workbench-overlays"
        @change="updateEnum"
      >
        <ElOption v-for="(option, index) in options" :key="index" :value="index" :label="option.title" />
      </ElSelect>
      <ElSelect
        v-else-if="control === 'field'"
        :model-value="editableValue"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        filterable
        append-to="#workbench-overlays"
        @change="updateStatic"
      >
        <ElOption v-for="field in fields" :key="field.nodeId" :value="field.field" :label="field.label" />
      </ElSelect>
      <ElSelect
        v-else-if="control === 'variable'"
        :model-value="editableValue"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        filterable
        append-to="#workbench-overlays"
        @change="updateStatic"
      >
        <ElOption v-for="variable in variables" :key="variable.value" :value="variable.value" :label="variable.label" />
      </ElSelect>
      <ElSelect
        v-else-if="control === 'dataSource'"
        :model-value="editableValue"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        filterable
        append-to="#workbench-overlays"
        @change="updateStatic"
      >
        <ElOption v-for="source in dataSources" :key="source.value" :value="source.value" :label="source.label" />
      </ElSelect>

      <div v-else-if="control === 'object' || (control === 'value' && staticKind === 'object')" class="flow-structured-list is-object">
        <div v-for="([key, value], index) in objectEntries" :key="`${key}-${index}`" class="flow-structured-row">
          <ElInput :model-value="key" :disabled="disabled" :aria-label="locale.t('flow.input.propertyName', 'Property name')" @change="renameObjectEntry(key, $event)" />
          <FlowValueEditor
            :model-value="value"
            :allow-references="nestedReferencesAllowed"
            :disabled="disabled"
            :fields="fields"
            :event-arguments="eventArguments"
            :outputs="outputs"
            :variables="variables"
            :data-sources="dataSources"
            :locale="locale"
            @update:model-value="updateObjectValue(key, $event)"
          />
          <ElButton text :disabled="disabled" :title="locale.t('flow.input.removeProperty', 'Remove property')" :aria-label="locale.t('flow.input.removeProperty', 'Remove property')" @click="removeObjectEntry(key)">
            <Trash2 :size="14" aria-hidden="true" />
          </ElButton>
        </div>
        <ElButton :disabled="disabled" @click="addObjectEntry">
          <Plus :size="14" aria-hidden="true" />
          {{ locale.t('flow.input.addProperty', 'Add property') }}
        </ElButton>
      </div>

      <div v-else-if="control === 'array' || (control === 'value' && staticKind === 'array')" class="flow-structured-list is-array">
        <div v-for="(value, index) in arrayEntries" :key="index" class="flow-structured-row">
          <span class="flow-array-index">{{ index + 1 }}</span>
          <FlowValueEditor
            :model-value="value"
            :allow-references="nestedReferencesAllowed"
            :disabled="disabled"
            :fields="fields"
            :event-arguments="eventArguments"
            :outputs="outputs"
            :variables="variables"
            :data-sources="dataSources"
            :locale="locale"
            @update:model-value="updateArrayEntry(index, $event)"
          />
          <div class="flow-row-actions">
            <ElButton text :disabled="disabled || index === 0" :title="locale.t('flow.input.moveUp', 'Move item up')" :aria-label="locale.t('flow.input.moveUp', 'Move item up')" @click="moveArrayEntry(index, -1)"><ArrowUp :size="13" /></ElButton>
            <ElButton text :disabled="disabled || index === arrayEntries.length - 1" :title="locale.t('flow.input.moveDown', 'Move item down')" :aria-label="locale.t('flow.input.moveDown', 'Move item down')" @click="moveArrayEntry(index, 1)"><ArrowDown :size="13" /></ElButton>
            <ElButton text :disabled="disabled" :title="locale.t('flow.input.removeItem', 'Remove item')" :aria-label="locale.t('flow.input.removeItem', 'Remove item')" @click="removeArrayEntry(index)"><Trash2 :size="13" /></ElButton>
          </div>
        </div>
        <ElButton :disabled="disabled" @click="addArrayEntry">
          <Plus :size="14" aria-hidden="true" />
          {{ locale.t('flow.input.addItem', 'Add item') }}
        </ElButton>
      </div>

      <div v-else-if="control === 'value' && staticKind === 'null'" class="flow-null-value">
        {{ locale.t('flow.input.emptyValue', 'Empty value') }}
      </div>
      <ElInput
        v-else
        :model-value="typeof editableValue === 'string' ? editableValue : ''"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @update:model-value="updateStatic"
      />
    </template>
    <p v-if="keyError" class="flow-inline-error" role="alert">{{ keyError }}</p>
  </div>
</template>

<style scoped>
.flow-value-editor { display: grid; min-width: 0; gap: 6px; }
.flow-value-source, .flow-value-kind { width: 100%; }
.flow-structured-list { display: grid; min-width: 0; gap: 7px; padding-left: 8px; border-left: 2px solid var(--wb-separator); }
.flow-structured-row { display: grid; min-width: 0; grid-template-columns: minmax(82px, .6fr) minmax(140px, 1.4fr) 28px; align-items: start; gap: 6px; }
.flow-structured-row > .flow-value-editor { min-width: 0; }
.flow-structured-list.is-array .flow-structured-row { grid-template-columns: 22px minmax(150px, 1fr) auto; }
.flow-array-index { padding-top: 7px; color: var(--wb-muted); font-size: 11px; text-align: center; }
.flow-row-actions { display: flex; }
.flow-row-actions .el-button, .flow-structured-row > .el-button { width: 28px; min-height: 28px; margin: 0; padding: 0; }
.flow-null-value { min-height: 30px; padding: 7px 9px; color: var(--wb-muted); border: 1px dashed var(--wb-control-border); border-radius: 4px; font-size: 11px; }
.flow-inline-error { margin: 0; color: var(--wb-danger); font-size: 11px; overflow-wrap: anywhere; }

@media (max-width: 620px) {
  .flow-structured-row { grid-template-columns: minmax(0, 1fr) 28px; }
  .flow-structured-row > .el-input { grid-column: 1; }
  .flow-structured-row > .flow-value-editor { grid-column: 1; }
  .flow-structured-row > .el-button { grid-column: 2; grid-row: 1; }
}
</style>
