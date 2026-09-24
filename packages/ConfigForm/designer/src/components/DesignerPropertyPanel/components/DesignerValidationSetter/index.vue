<script setup lang="ts">
import type { RuleDescriptor, RuleSet } from '@moluoxixi/zod3-to-rule'
import type { DesignerDefaultValueKind, DesignerSetterOption } from '@designer/registry'
import type { DesignerEditableRuleKind } from '../../types'
import { RULE_SET_VERSION } from '@moluoxixi/zod3-to-rule'
import { Plus, Trash2 } from '@lucide/vue'
import {
  ElCheckbox,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '@designer/locale'
import {
  resolveDesignerValidationBase,
  resolveDesignerValidationRuleKinds,
} from '../../services'

type RuleKind = RuleDescriptor['kind']
type RuleDraft = { kind: RuleKind, message?: string } & Record<string, unknown>

const props = defineProps<{
  modelValue: unknown
  valueKind?: DesignerDefaultValueKind
  options?: DesignerSetterOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RuleSet | undefined]
}>()
const locale = useDesignerLocale()

const enabled = ref(false)
const optional = ref(false)
const nullable = ref(false)
const rules = ref<RuleDraft[]>([])
const base = computed(() => resolveDesignerValidationBase(props.valueKind, props.options))
const allowedRuleKinds = computed(() => resolveDesignerValidationRuleKinds(base.value))

const allRuleTypes = computed<{ label: string, value: DesignerEditableRuleKind }[]>(() => [
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
])
const ruleTypes = computed(() => allRuleTypes.value.filter(rule => allowedRuleKinds.value.includes(rule.value)))
const numberKinds: RuleKind[] = ['minLength', 'maxLength', 'length', 'min', 'max', 'multipleOf']
const inclusiveKinds: RuleKind[] = ['min', 'max']
const hasAdvancedRules = computed(() => rules.value.some(isAdvancedRule))

function isRuleSet(value: unknown): value is RuleSet {
  return typeof value === 'object' && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).version === RULE_SET_VERSION
    && typeof (value as Record<string, unknown>).base === 'object'
    && Array.isArray((value as Record<string, unknown>).rules)
}

function syncValue(): void {
  if (!isRuleSet(props.modelValue) || !base.value) {
    enabled.value = false
    optional.value = false
    nullable.value = false
    rules.value = []
    return
  }

  enabled.value = true
  optional.value = Boolean(props.modelValue.optional)
  nullable.value = Boolean(props.modelValue.nullable)
  rules.value = props.modelValue.rules.map(rule => ({ ...rule })) as RuleDraft[]
}

watch(
  [() => props.modelValue, () => props.valueKind, () => props.options],
  syncValue,
  { deep: true, immediate: true },
)

function commit(): void {
  if (!enabled.value) {
    emit('update:modelValue', undefined)
    return
  }
  const resolvedBase = base.value
  const serializedRules = serializeRules()
  if (!resolvedBase || !serializedRules)
    return
  emit('update:modelValue', {
    version: RULE_SET_VERSION,
    base: structuredClone(resolvedBase),
    rules: serializedRules,
    ...(optional.value ? { optional: true } : {}),
    ...(nullable.value ? { nullable: true } : {}),
  })
}

function updateEnabled(value: string | number | boolean): void {
  if (!base.value)
    return
  enabled.value = value === true
  commit()
}

function updateFlag(flag: 'optional' | 'nullable', value: string | number | boolean): void {
  if (flag === 'optional')
    optional.value = value === true
  else
    nullable.value = value === true
  commit()
}

function isAdvancedRule(rule: RuleDraft): boolean {
  return rule.kind === 'compare'
    || rule.kind === 'custom'
    || !allowedRuleKinds.value.includes(rule.kind as DesignerEditableRuleKind)
}

function defaultRule(kind: DesignerEditableRuleKind): RuleDraft {
  if (['minLength', 'maxLength', 'length'].includes(kind))
    return { kind, value: kind === 'minLength' ? 1 : 0 }
  if (kind === 'min' || kind === 'max')
    return { kind, value: 0, inclusive: true }
  if (kind === 'multipleOf')
    return { kind, value: 1 }
  if (kind === 'regex')
    return { kind, source: '.*' }
  if (kind === 'dateMin' || kind === 'dateMax')
    return { kind, value: `${localCalendarDate()}T00:00:00.000Z` }
  return { kind }
}

function addRule(): void {
  const kind = ruleTypes.value[0]?.value
  if (!kind)
    return
  rules.value.push(defaultRule(kind))
  commit()
}

function removeRule(index: number): void {
  if (isAdvancedRule(rules.value[index]!))
    return
  rules.value.splice(index, 1)
  commit()
}

function changeRuleKind(index: number, kind: DesignerEditableRuleKind): void {
  if (isAdvancedRule(rules.value[index]!) || !allowedRuleKinds.value.includes(kind))
    return
  rules.value[index] = defaultRule(kind)
  commit()
}

function updateRuleDraft(index: number, key: string, value: unknown): void {
  if (isAdvancedRule(rules.value[index]!))
    return
  rules.value[index]![key] = value
}

function updateRule(index: number, key: string, value: unknown): void {
  updateRuleDraft(index, key, value)
  commit()
}

function localCalendarDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dateInputValue(value: unknown): string {
  if (typeof value !== 'string')
    return ''
  const calendarDate = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1]
  if (calendarDate)
    return calendarDate
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function updateDateRule(index: number, value: string | null): void {
  updateRuleDraft(index, 'value', value ? `${value}T00:00:00.000Z` : '')
  if (value)
    commit()
}

function updateNumberRule(index: number, value: number | undefined): void {
  const rule = rules.value[index]
  const valid = value !== undefined
    && Number.isFinite(value)
    && (rule?.kind !== 'multipleOf' || value > 0)
  if (!valid) {
    updateRuleDraft(index, 'value', undefined)
    return
  }

  const next = rule && ['minLength', 'maxLength', 'length'].includes(rule.kind)
    ? Math.max(0, Math.floor(value))
    : value
  updateRule(index, 'value', next)
}

function serializeRules(): RuleDescriptor[] | undefined {
  if (rules.value.some(rule => !isRuleDraftValid(rule)))
    return undefined
  return rules.value.map(rule => Object.fromEntries(
    Object.entries(rule).filter(([, value]) => value !== undefined),
  ) as unknown as RuleDescriptor)
}

function isRuleDraftValid(rule: RuleDraft): boolean {
  if (isAdvancedRule(rule))
    return true
  if (rule.message !== undefined && typeof rule.message !== 'string')
    return false
  if (['minLength', 'maxLength', 'length'].includes(rule.kind))
    return typeof rule.value === 'number' && Number.isInteger(rule.value) && rule.value >= 0
  if (rule.kind === 'min' || rule.kind === 'max')
    return typeof rule.value === 'number' && Number.isFinite(rule.value)
  if (rule.kind === 'multipleOf')
    return typeof rule.value === 'number' && Number.isFinite(rule.value) && rule.value > 0
  if (rule.kind === 'regex') {
    if (typeof rule.source !== 'string' || (rule.flags !== undefined && typeof rule.flags !== 'string'))
      return false
    try {
      new RegExp(rule.source, rule.flags as string | undefined)
      return true
    }
    catch {
      return false
    }
  }
  if (rule.kind === 'dateMin' || rule.kind === 'dateMax')
    return typeof rule.value === 'string' && !Number.isNaN(new Date(rule.value).getTime())
  return true
}

function formatAdvancedRule(rule: RuleDraft): string {
  return JSON.stringify(rule, null, 2)
}
</script>

<template>
  <div class="mx-config-form-designer__validation-editor">
    <div class="mx-config-form-designer__switch-row">
      <span>{{ locale.t('validation.enable', 'Enable validation') }}</span>
      <ElSwitch
        :model-value="enabled"
        :aria-label="locale.t('validation.enable', 'Enable validation')"
        :disabled="disabled || !base || hasAdvancedRules"
        @change="updateEnabled"
      />
    </div>

    <template v-if="enabled && base">
      <div class="mx-config-form-designer__flag-buttons">
        <ElCheckbox :model-value="optional" :disabled="disabled" :label="locale.t('validation.optional', 'Optional')" @update:model-value="updateFlag('optional', $event)" />
        <ElCheckbox :model-value="nullable" :disabled="disabled" :label="locale.t('validation.nullable', 'Nullable')" @update:model-value="updateFlag('nullable', $event)" />
      </div>

      <div v-if="rules.length || ruleTypes.length" class="mx-config-form-designer__rule-list">
        <div v-for="(rule, index) in rules" :key="index" class="mx-config-form-designer__rule-row">
          <div v-if="isAdvancedRule(rule)" class="mx-config-form-designer__advanced-rule" data-advanced-validation-rule>
            <span>
              <strong>{{ locale.t('validation.advancedRule', 'Advanced rule') }}</strong>
              <code>{{ rule.kind }}</code>
            </span>
            <pre>{{ formatAdvancedRule(rule) }}</pre>
          </div>
          <template v-else>
            <div class="mx-config-form-designer__collection-row-heading">
              <ElSelect :model-value="rule.kind" :aria-label="locale.t('validation.ruleType', 'Rule {index} type', { index: index + 1 })" :disabled="disabled" @update:model-value="changeRuleKind(index, $event)">
                <ElOption v-for="item in ruleTypes" :key="item.value" :value="item.value" :label="item.label" />
              </ElSelect>
              <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('validation.deleteRule', 'Delete rule {index}', { index: index + 1 })" :disabled="disabled" @click="removeRule(index)">
                <Trash2 :size="14" aria-hidden="true" />
              </button>
            </div>

            <ElInputNumber v-if="numberKinds.includes(rule.kind)" :model-value="typeof rule.value === 'number' ? rule.value : undefined" :aria-label="locale.t('validation.ruleValue', 'Rule {index} value', { index: index + 1 })" :disabled="disabled" controls-position="right" @change="updateNumberRule(index, $event)" />
            <template v-else-if="rule.kind === 'regex'">
              <ElInput :model-value="String(rule.source ?? '')" :aria-label="locale.t('validation.rulePattern', 'Rule {index} pattern', { index: index + 1 })" :placeholder="locale.t('rule.regex', 'Pattern')" :disabled="disabled" @update:model-value="updateRuleDraft(index, 'source', $event)" @blur="commit" />
              <ElInput :model-value="String(rule.flags ?? '')" :aria-label="locale.t('validation.ruleFlags', 'Rule {index} flags', { index: index + 1 })" :placeholder="locale.t('validation.flags', 'Flags')" :disabled="disabled" @update:model-value="updateRuleDraft(index, 'flags', $event || undefined)" @blur="commit" />
            </template>
            <ElDatePicker v-else-if="rule.kind === 'dateMin' || rule.kind === 'dateMax'" :model-value="dateInputValue(rule.value)" type="date" value-format="YYYY-MM-DD" :aria-label="locale.t('validation.ruleDate', 'Rule {index} date', { index: index + 1 })" :disabled="disabled" @update:model-value="updateDateRule(index, $event)" />

            <div v-if="inclusiveKinds.includes(rule.kind)" class="mx-config-form-designer__switch-row is-compact">
              <span>{{ locale.t('validation.inclusive', 'Inclusive') }}</span>
              <ElSwitch :model-value="rule.inclusive !== false" :aria-label="locale.t('validation.inclusive', 'Inclusive')" :disabled="disabled" @change="updateRule(index, 'inclusive', $event)" />
            </div>
            <ElInput :model-value="String(rule.message ?? '')" :aria-label="locale.t('validation.ruleMessage', 'Rule {index} message', { index: index + 1 })" :placeholder="locale.t('validation.customMessage', 'Custom message (optional)')" :disabled="disabled" @update:model-value="updateRuleDraft(index, 'message', $event || undefined)" @blur="commit" />
          </template>
        </div>
        <button v-if="ruleTypes.length" type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addRule">
          <Plus :size="15" aria-hidden="true" />
          {{ locale.t('validation.addRule', 'Add rule') }}
        </button>
      </div>
    </template>
  </div>
</template>
