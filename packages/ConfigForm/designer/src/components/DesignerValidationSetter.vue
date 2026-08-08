<script setup lang="ts">
import type { RuleBase, RuleDescriptor, RulePrimitive, RuleSet } from '@moluoxixi/zod3-to-rule'
import { Plus, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'

type BaseType = RuleBase['type']
type RuleKind = RuleDescriptor['kind']
type PrimitiveType = 'text' | 'number' | 'boolean'
type RuleDraft = { kind: RuleKind, message?: string } & Record<string, unknown>

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RuleSet | undefined]
}>()
const locale = useDesignerLocale()

const enabled = ref(false)
const baseType = ref<BaseType>('string')
const optional = ref(false)
const nullable = ref(false)
const enumValues = ref<string[]>([])
const literalType = ref<PrimitiveType>('text')
const literalValue = ref<RulePrimitive>('')
const rules = ref<RuleDraft[]>([])

const baseTypes = computed<{ label: string, value: BaseType }[]>(() => [
  { label: locale.t('valueType.text', 'Text'), value: 'string' },
  { label: locale.t('valueType.number', 'Number'), value: 'number' },
  { label: locale.t('valueType.boolean', 'Boolean'), value: 'boolean' },
  { label: locale.t('valueType.date', 'Date'), value: 'date' },
  { label: locale.t('valueType.enum', 'Enum'), value: 'enum' },
  { label: locale.t('valueType.literal', 'Literal'), value: 'literal' },
])

const ruleTypes = computed<{ label: string, value: RuleKind }[]>(() => [
  { label: locale.t('rule.required', 'Required'), value: 'required' },
  { label: locale.t('rule.minLength', 'Minimum length'), value: 'minLength' },
  { label: locale.t('rule.maxLength', 'Maximum length'), value: 'maxLength' },
  { label: locale.t('rule.length', 'Exact length'), value: 'length' },
  { label: locale.t('rule.email', 'Email'), value: 'email' },
  { label: locale.t('rule.url', 'URL'), value: 'url' },
  { label: locale.t('rule.uuid', 'UUID'), value: 'uuid' },
  { label: locale.t('rule.regex', 'Pattern'), value: 'regex' },
  { label: locale.t('rule.min', 'Minimum'), value: 'min' },
  { label: locale.t('rule.max', 'Maximum'), value: 'max' },
  { label: locale.t('rule.integer', 'Integer'), value: 'integer' },
  { label: locale.t('rule.finite', 'Finite'), value: 'finite' },
  { label: locale.t('rule.multipleOf', 'Multiple of'), value: 'multipleOf' },
  { label: locale.t('rule.dateMin', 'Earliest date'), value: 'dateMin' },
  { label: locale.t('rule.dateMax', 'Latest date'), value: 'dateMax' },
  { label: locale.t('rule.compare', 'Compare field'), value: 'compare' },
  { label: locale.t('rule.custom', 'Custom'), value: 'custom' },
])

const numberKinds: RuleKind[] = ['minLength', 'maxLength', 'length', 'min', 'max', 'multipleOf']
const inclusiveKinds: RuleKind[] = ['min', 'max']

function isRuleSet(value: unknown): value is RuleSet {
  return typeof value === 'object' && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).version === 1
    && typeof (value as Record<string, unknown>).base === 'object'
    && Array.isArray((value as Record<string, unknown>).rules)
}

function primitiveType(value: RulePrimitive): PrimitiveType {
  if (typeof value === 'number')
    return 'number'
  if (typeof value === 'boolean')
    return 'boolean'
  return 'text'
}

function syncValue(): void {
  if (!isRuleSet(props.modelValue)) {
    enabled.value = false
    baseType.value = 'string'
    optional.value = false
    nullable.value = false
    enumValues.value = []
    rules.value = []
    return
  }

  enabled.value = true
  baseType.value = props.modelValue.base.type
  optional.value = Boolean(props.modelValue.optional)
  nullable.value = Boolean(props.modelValue.nullable)
  enumValues.value = props.modelValue.base.type === 'enum' ? [...props.modelValue.base.values] : []
  if (props.modelValue.base.type === 'literal') {
    literalValue.value = props.modelValue.base.value
    literalType.value = primitiveType(props.modelValue.base.value)
  }
  rules.value = props.modelValue.rules.map(rule => ({ ...rule })) as RuleDraft[]
}

watch(() => props.modelValue, syncValue, { deep: true, immediate: true })

function currentBase(): RuleBase {
  if (baseType.value === 'enum') {
    const values = enumValues.value.length ? enumValues.value : ['']
    return { type: 'enum', values: values as [string, ...string[]] }
  }
  if (baseType.value === 'literal')
    return { type: 'literal', value: literalValue.value }
  return { type: baseType.value }
}

function commit(): void {
  if (!enabled.value) {
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', {
    version: 1,
    base: currentBase(),
    rules: rules.value.map(rule => ({ ...rule })) as RuleDescriptor[],
    ...(optional.value ? { optional: true } : {}),
    ...(nullable.value ? { nullable: true } : {}),
  })
}

function toggleEnabled(): void {
  enabled.value = !enabled.value
  commit()
}

function changeBase(next: BaseType): void {
  baseType.value = next
  if (next === 'enum' && enumValues.value.length === 0)
    enumValues.value = ['Option A', 'Option B']
  if (next === 'literal') {
    literalType.value = 'text'
    literalValue.value = ''
  }
  commit()
}

function toggleFlag(flag: 'optional' | 'nullable'): void {
  if (flag === 'optional')
    optional.value = !optional.value
  else
    nullable.value = !nullable.value
  commit()
}

function addEnumValue(): void {
  enumValues.value.push(`Option ${enumValues.value.length + 1}`)
  commit()
}

function removeEnumValue(index: number): void {
  if (enumValues.value.length <= 1)
    return
  enumValues.value.splice(index, 1)
  commit()
}

function changeLiteralType(next: PrimitiveType): void {
  literalType.value = next
  literalValue.value = next === 'number' ? 0 : next === 'boolean' ? false : ''
  commit()
}

function defaultRule(kind: RuleKind): RuleDraft {
  if (numberKinds.includes(kind))
    return { kind, value: kind === 'multipleOf' ? 1 : 0 }
  if (kind === 'regex')
    return { kind, source: '' }
  if (kind === 'dateMin' || kind === 'dateMax')
    return { kind, value: '' }
  if (kind === 'compare')
    return { kind, field: '', operator: 'eq' }
  if (kind === 'custom')
    return { kind, key: '' }
  return { kind }
}

function addRule(): void {
  rules.value.push(defaultRule('required'))
  commit()
}

function removeRule(index: number): void {
  rules.value.splice(index, 1)
  commit()
}

function changeRuleKind(index: number, kind: RuleKind): void {
  rules.value[index] = defaultRule(kind)
  commit()
}

function updateRule(index: number, key: string, value: unknown): void {
  rules.value[index]![key] = value
  commit()
}
</script>

<template>
  <div class="mx-config-form-designer__validation-editor">
    <button type="button" class="mx-config-form-designer__switch-row" role="switch" :aria-checked="enabled" :disabled="disabled" @click="toggleEnabled">
      <span>{{ locale.t('validation.enable', 'Enable validation') }}</span>
      <span class="mx-config-form-designer__switch" :class="{ 'is-on': enabled }" aria-hidden="true"><span /></span>
    </button>

    <template v-if="enabled">
      <div class="mx-config-form-designer__validation-grid">
        <label>
          <span>{{ locale.t('validation.valueType', 'Value type') }}</span>
          <select :value="baseType" :disabled="disabled" @change="changeBase(($event.currentTarget as HTMLSelectElement).value as BaseType)">
            <option v-for="item in baseTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <div class="mx-config-form-designer__flag-buttons">
          <button type="button" :class="{ 'is-active': optional }" :aria-pressed="optional" :disabled="disabled" @click="toggleFlag('optional')">{{ locale.t('validation.optional', 'Optional') }}</button>
          <button type="button" :class="{ 'is-active': nullable }" :aria-pressed="nullable" :disabled="disabled" @click="toggleFlag('nullable')">{{ locale.t('validation.nullable', 'Nullable') }}</button>
        </div>
      </div>

      <div v-if="baseType === 'enum'" class="mx-config-form-designer__enum-values">
        <div v-for="(_, index) in enumValues" :key="index">
          <input v-model="enumValues[index]" type="text" :aria-label="locale.t('validation.enumValue', 'Enum value {index}', { index: index + 1 })" :disabled="disabled" @blur="commit">
          <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('validation.deleteEnumValue', 'Delete enum value {index}', { index: index + 1 })" :disabled="disabled || enumValues.length <= 1" @click="removeEnumValue(index)">
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </div>
        <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addEnumValue"><Plus :size="15" aria-hidden="true" /> {{ locale.t('validation.addValue', 'Add value') }}</button>
      </div>

      <div v-else-if="baseType === 'literal'" class="mx-config-form-designer__typed-value">
        <select :value="literalType" aria-label="Literal type" :disabled="disabled" @change="changeLiteralType(($event.currentTarget as HTMLSelectElement).value as PrimitiveType)">
          <option value="text">{{ locale.t('valueType.text', 'Text') }}</option>
          <option value="number">{{ locale.t('valueType.number', 'Number') }}</option>
          <option value="boolean">{{ locale.t('valueType.boolean', 'Boolean') }}</option>
        </select>
        <select v-if="literalType === 'boolean'" v-model="literalValue" aria-label="Literal value" :disabled="disabled" @change="commit">
          <option :value="true">{{ locale.t('value.true', 'True') }}</option>
          <option :value="false">{{ locale.t('value.false', 'False') }}</option>
        </select>
        <input v-else v-model="literalValue" :type="literalType === 'number' ? 'number' : 'text'" aria-label="Literal value" :disabled="disabled" @blur="commit">
      </div>

      <div class="mx-config-form-designer__rule-list">
        <div v-for="(rule, index) in rules" :key="index" class="mx-config-form-designer__rule-row">
          <div class="mx-config-form-designer__collection-row-heading">
            <select :value="rule.kind" :aria-label="locale.t('validation.ruleType', 'Rule {index} type', { index: index + 1 })" :disabled="disabled" @change="changeRuleKind(index, ($event.currentTarget as HTMLSelectElement).value as RuleKind)">
              <option v-for="item in ruleTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('validation.deleteRule', 'Delete rule {index}', { index: index + 1 })" :disabled="disabled" @click="removeRule(index)">
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </div>

          <input v-if="numberKinds.includes(rule.kind)" :value="rule.value" type="number" :aria-label="locale.t('validation.ruleValue', 'Rule {index} value', { index: index + 1 })" :disabled="disabled" @change="updateRule(index, 'value', Number(($event.currentTarget as HTMLInputElement).value))">
          <template v-else-if="rule.kind === 'regex'">
            <input :value="rule.source" type="text" :aria-label="locale.t('validation.rulePattern', 'Rule {index} pattern', { index: index + 1 })" :placeholder="locale.t('rule.regex', 'Pattern')" :disabled="disabled" @blur="updateRule(index, 'source', ($event.currentTarget as HTMLInputElement).value)">
            <input :value="rule.flags" type="text" :aria-label="locale.t('validation.ruleFlags', 'Rule {index} flags', { index: index + 1 })" :placeholder="locale.t('validation.flags', 'Flags')" :disabled="disabled" @blur="updateRule(index, 'flags', ($event.currentTarget as HTMLInputElement).value || undefined)">
          </template>
          <input v-else-if="rule.kind === 'dateMin' || rule.kind === 'dateMax'" :value="rule.value" type="date" :aria-label="locale.t('validation.ruleDate', 'Rule {index} date', { index: index + 1 })" :disabled="disabled" @change="updateRule(index, 'value', ($event.currentTarget as HTMLInputElement).value)">
          <template v-else-if="rule.kind === 'compare'">
            <input :value="rule.field" type="text" :aria-label="locale.t('validation.ruleField', 'Rule {index} field', { index: index + 1 })" :placeholder="locale.t('condition.fieldPlaceholder', 'Field name')" :disabled="disabled" @blur="updateRule(index, 'field', ($event.currentTarget as HTMLInputElement).value)">
            <select :value="rule.operator" :aria-label="locale.t('validation.ruleOperator', 'Rule {index} operator', { index: index + 1 })" :disabled="disabled" @change="updateRule(index, 'operator', ($event.currentTarget as HTMLSelectElement).value)">
              <option value="eq">{{ locale.t('operator.eq', 'Equals') }}</option>
              <option value="neq">{{ locale.t('operator.neq', 'Not equal') }}</option>
              <option value="gt">{{ locale.t('operator.gt', 'Greater than') }}</option>
              <option value="gte">{{ locale.t('operator.gte', 'At least') }}</option>
              <option value="lt">{{ locale.t('operator.lt', 'Less than') }}</option>
              <option value="lte">{{ locale.t('operator.lte', 'At most') }}</option>
            </select>
          </template>
          <input v-else-if="rule.kind === 'custom'" :value="rule.key" type="text" :aria-label="locale.t('validation.ruleKey', 'Rule {index} key', { index: index + 1 })" :placeholder="locale.t('validation.validatorKey', 'Validator key')" :disabled="disabled" @blur="updateRule(index, 'key', ($event.currentTarget as HTMLInputElement).value)">

          <button v-if="inclusiveKinds.includes(rule.kind)" type="button" class="mx-config-form-designer__switch-row is-compact" role="switch" :aria-checked="rule.inclusive !== false" :disabled="disabled" @click="updateRule(index, 'inclusive', rule.inclusive === false)">
            <span>{{ locale.t('validation.inclusive', 'Inclusive') }}</span>
            <span class="mx-config-form-designer__switch" :class="{ 'is-on': rule.inclusive !== false }" aria-hidden="true"><span /></span>
          </button>
          <input :value="rule.message" type="text" :aria-label="locale.t('validation.ruleMessage', 'Rule {index} message', { index: index + 1 })" :placeholder="locale.t('validation.customMessage', 'Custom message (optional)')" :disabled="disabled" @blur="updateRule(index, 'message', ($event.currentTarget as HTMLInputElement).value || undefined)">
        </div>
        <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addRule">
          <Plus :size="15" aria-hidden="true" />
          {{ locale.t('validation.addRule', 'Add rule') }}
        </button>
      </div>
    </template>
  </div>
</template>
