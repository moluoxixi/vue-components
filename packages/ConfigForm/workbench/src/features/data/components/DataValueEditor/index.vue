<script setup lang="ts">
import type {
  ConfigFormJsonValue,
  ConfigFormValueInput,
  ConfigFormValueReference,
} from '@moluoxixi/config-form-core'
import type { DataValueEditorEmits, DataValueEditorProps, DataValueOption } from './types'
import type { PropType } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cloneWorkbenchJson as structuredClone } from '../../../../utils'

defineOptions({ name: 'DataValueEditor' })
const props = defineProps({
  allowReferences: { type: Boolean, default: true },
  contextValues: { type: Array as PropType<NonNullable<DataValueEditorProps['contextValues']>>, default: () => [] },
  control: { type: String as PropType<NonNullable<DataValueEditorProps['control']>>, default: 'value' },
  dataSources: { type: Array as PropType<NonNullable<DataValueEditorProps['dataSources']>>, default: () => [] },
  disabled: { type: Boolean, default: false },
  fields: { type: Array as PropType<DataValueEditorProps['fields']>, required: true },
  invalid: { type: Boolean, default: false },
  locale: { type: Object as PropType<DataValueEditorProps['locale']>, required: true },
  modelValue: { type: null as unknown as PropType<DataValueEditorProps['modelValue']> },
  options: { type: Array as PropType<NonNullable<DataValueEditorProps['options']>>, default: () => [] },
  required: { type: Boolean, default: false },
  variables: { type: Array as PropType<NonNullable<DataValueEditorProps['variables']>>, default: () => [] },
})
const emit = defineEmits<DataValueEditorEmits>()
const keyError = ref('')

type SourceKind = 'static' | 'field' | 'variable' | 'context' | 'expression'
type StaticKind = 'text' | 'number' | 'boolean' | 'null' | 'object' | 'array'

const reference = computed(() => props.allowReferences ? readReference(props.modelValue) : undefined)
const literalReference = computed(() => reference.value?.kind === 'literal' ? reference.value : undefined)
const editableValue = computed<ConfigFormJsonValue | undefined>(() => literalReference.value
  ? literalReference.value.value
  : props.modelValue as ConfigFormJsonValue | undefined)
const sourceKind = computed<SourceKind>(() => {
  const kind = reference.value?.kind
  if (kind === 'event')
    return 'context'
  if (kind === 'field' || kind === 'variable' || kind === 'expression')
    return kind
  return 'static'
})
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
const contextReference = computed(() => reference.value?.kind === 'event' ? reference.value.path : [])
const contextSelection = computed(() => props.contextValues.find(option => samePath(contextPath(option), contextReference.value))?.value)
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
  if (next === 'context') {
    if (props.contextValues[0])
      update({ $ref: { kind: 'event', path: contextPath(props.contextValues[0]) } })
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

function updateContext(value: string): void {
  const option = props.contextValues.find(item => item.value === value)
  if (option)
    update({ $ref: { kind: 'event', path: contextPath(option) } })
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
    keyError.value = props.locale.t('data.value.invalidKey', 'Enter a unique property name.')
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

function contextPath(option: DataValueOption): string[] {
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
  <!-- `aria-required` only belongs on elements whose role supports it. This wrapper is a
       plain div, and ElSelect/ElInputNumber forward unknown attributes to their role-less
       root, so required-ness is carried by the surrounding <label> (with its required
       marker) plus `aria-invalid`. ElInput (inner textbox) and ElSwitch (role="switch")
       do accept it. -->
  <div
    class="data-value-editor"
    :aria-invalid="invalid || undefined"
    :tabindex="invalid ? -1 : undefined"
  >
    <ElSelect
      v-if="allowReferences"
      class="data-value-source"
      :model-value="sourceKind"
      :disabled="disabled"
      :aria-label="locale.t('data.value.source', 'Value source')"
      :aria-invalid="invalid || undefined"
      append-to="#workbench-overlays"
      @change="changeSource"
    >
      <ElOption value="static" :label="locale.t('data.value.static', 'Fixed value')" />
      <ElOption value="field" :disabled="fields.length === 0" :label="locale.t('data.value.field', 'Form field')" />
      <ElOption value="variable" :disabled="variables.length === 0" :label="locale.t('data.value.variable', 'Variable')" />
      <ElOption value="context" :disabled="contextValues.length === 0" :label="locale.t('data.value.context', 'Response value')" />
      <ElOption value="expression" :label="locale.t('data.value.expression', 'Advanced expression')" />
    </ElSelect>

    <template v-if="sourceKind === 'field'">
      <ElSelect
        :model-value="fieldReference"
        :disabled="disabled"
        filterable
        append-to="#workbench-overlays"
        :aria-label="locale.t('data.value.field', 'Form field')"
        :aria-invalid="invalid || undefined"
        @change="updateField"
      >
        <ElOption v-if="fieldReference && !fields.some(item => item.nodeId === fieldReference)" :value="fieldReference" :label="locale.t('data.value.unavailableField', 'Unavailable field')" />
        <ElOption v-for="field in fields" :key="field.nodeId" :value="field.nodeId" :label="field.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'variable'">
      <ElSelect
        :model-value="variableReference"
        :disabled="disabled"
        filterable
        append-to="#workbench-overlays"
        :aria-label="locale.t('data.value.variable', 'Variable')"
        :aria-invalid="invalid || undefined"
        @change="updateVariable"
      >
        <ElOption v-if="variableReference && !variables.some(item => item.value === variableReference)" :value="variableReference" :label="locale.t('data.value.unavailableVariable', 'Unavailable variable')" />
        <ElOption v-for="variable in variables" :key="variable.value" :value="variable.value" :label="variable.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'context'">
      <ElSelect
        :model-value="contextSelection ?? '__unavailable'"
        :disabled="disabled"
        append-to="#workbench-overlays"
        :aria-label="locale.t('data.value.context', 'Response value')"
        :aria-invalid="invalid || undefined"
        @change="updateContext"
      >
        <ElOption v-if="!contextSelection" value="__unavailable" disabled :label="locale.t('data.value.unavailableContext', 'Unavailable response value')" />
        <ElOption v-for="item in contextValues" :key="item.value" :value="item.value" :label="item.label" />
      </ElSelect>
    </template>

    <template v-else-if="sourceKind === 'expression'">
      <ElInput
        :model-value="expressionReference"
        :disabled="disabled"
        :aria-label="locale.t('data.value.expression', 'Advanced expression')"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
        @update:model-value="updateExpression"
      />
    </template>

    <template v-else>
      <ElSelect
        v-if="control === 'value'"
        class="data-value-kind"
        :model-value="staticKind"
        :disabled="disabled"
        :aria-label="locale.t('data.value.type', 'Value type')"
        :aria-invalid="invalid || undefined"
        append-to="#workbench-overlays"
        @change="changeStaticKind"
      >
        <ElOption value="text" :label="locale.t('valueType.text', 'Text')" />
        <ElOption value="number" :label="locale.t('valueType.number', 'Number')" />
        <ElOption value="boolean" :label="locale.t('valueType.boolean', 'Boolean')" />
        <ElOption value="null" :label="locale.t('data.value.empty', 'Empty')" />
        <ElOption value="object" :label="locale.t('data.value.object', 'Key/value object')" />
        <ElOption value="array" :label="locale.t('data.value.array', 'List')" />
      </ElSelect>

      <ElInputNumber
        v-if="control === 'number' || (control === 'value' && staticKind === 'number')"
        :model-value="typeof editableValue === 'number' ? editableValue : 0"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
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
        filterable
        append-to="#workbench-overlays"
        @change="updateStatic"
      >
        <ElOption v-for="source in dataSources" :key="source.value" :value="source.value" :label="source.label" />
      </ElSelect>

      <div v-else-if="control === 'object' || (control === 'value' && staticKind === 'object')" class="data-structured-list is-object">
        <div v-for="([key, value], index) in objectEntries" :key="`${key}-${index}`" class="data-structured-row">
          <ElInput :model-value="key" :disabled="disabled" :aria-label="locale.t('data.value.propertyName', 'Property name')" @change="renameObjectEntry(key, $event)" />
          <DataValueEditor
            :model-value="value"
            :allow-references="nestedReferencesAllowed"
            :disabled="disabled"
            :fields="fields"
            :context-values="contextValues"
            :variables="variables"
            :data-sources="dataSources"
            :locale="locale"
            @update:model-value="updateObjectValue(key, $event)"
          />
          <ElButton text :disabled="disabled" :title="locale.t('data.value.removeProperty', 'Remove property')" :aria-label="locale.t('data.value.removeProperty', 'Remove property')" @click="removeObjectEntry(key)">
            <Trash2 :size="14" aria-hidden="true" />
          </ElButton>
        </div>
        <ElButton :disabled="disabled" @click="addObjectEntry">
          <Plus :size="14" aria-hidden="true" />
          {{ locale.t('data.value.addProperty', 'Add property') }}
        </ElButton>
      </div>

      <div v-else-if="control === 'array' || (control === 'value' && staticKind === 'array')" class="data-structured-list is-array">
        <div v-for="(value, index) in arrayEntries" :key="index" class="data-structured-row">
          <span class="data-array-index">{{ index + 1 }}</span>
          <DataValueEditor
            :model-value="value"
            :allow-references="nestedReferencesAllowed"
            :disabled="disabled"
            :fields="fields"
            :context-values="contextValues"
            :variables="variables"
            :data-sources="dataSources"
            :locale="locale"
            @update:model-value="updateArrayEntry(index, $event)"
          />
          <div class="data-row-actions">
            <ElButton text :disabled="disabled || index === 0" :title="locale.t('data.value.moveUp', 'Move item up')" :aria-label="locale.t('data.value.moveUp', 'Move item up')" @click="moveArrayEntry(index, -1)"><ArrowUp :size="13" /></ElButton>
            <ElButton text :disabled="disabled || index === arrayEntries.length - 1" :title="locale.t('data.value.moveDown', 'Move item down')" :aria-label="locale.t('data.value.moveDown', 'Move item down')" @click="moveArrayEntry(index, 1)"><ArrowDown :size="13" /></ElButton>
            <ElButton text :disabled="disabled" :title="locale.t('data.value.removeItem', 'Remove item')" :aria-label="locale.t('data.value.removeItem', 'Remove item')" @click="removeArrayEntry(index)"><Trash2 :size="13" /></ElButton>
          </div>
        </div>
        <ElButton :disabled="disabled" @click="addArrayEntry">
          <Plus :size="14" aria-hidden="true" />
          {{ locale.t('data.value.addItem', 'Add item') }}
        </ElButton>
      </div>

      <div v-else-if="control === 'value' && staticKind === 'null'" class="data-null-value">
        {{ locale.t('data.value.emptyValue', 'Empty value') }}
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
    <p v-if="keyError" class="data-inline-error" role="alert">{{ keyError }}</p>
  </div>
</template>

<style scoped>
.data-value-editor { display: grid; min-width: 0; gap: 6px; }
.data-value-source, .data-value-kind { width: 100%; }
.data-structured-list { display: grid; min-width: 0; gap: 7px; padding-left: 8px; border-left: 2px solid var(--wb-separator); }
.data-structured-row { display: grid; min-width: 0; grid-template-columns: minmax(82px, .6fr) minmax(140px, 1.4fr) 28px; align-items: start; gap: 6px; }
.data-structured-row > .data-value-editor { min-width: 0; }
.data-structured-list.is-array .data-structured-row { grid-template-columns: 22px minmax(150px, 1fr) auto; }
.data-array-index { padding-top: 7px; color: var(--wb-muted); font-size: 11px; text-align: center; }
.data-row-actions { display: flex; }
.data-row-actions .el-button, .data-structured-row > .el-button { width: 28px; min-height: 28px; margin: 0; padding: 0; }
.data-null-value { min-height: 30px; padding: 7px 9px; color: var(--wb-muted); border: 1px dashed var(--wb-control-border); border-radius: 4px; font-size: 11px; }
.data-inline-error { margin: 0; color: var(--wb-danger); font-size: 11px; overflow-wrap: anywhere; }

@media (max-width: 620px) {
  .data-structured-row { grid-template-columns: minmax(0, 1fr) 28px; }
  .data-structured-row > .el-input { grid-column: 1; }
  .data-structured-row > .data-value-editor { grid-column: 1; }
  .data-structured-row > .el-button { grid-column: 2; grid-row: 1; }
}
</style>
