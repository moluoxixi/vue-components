<script setup lang="ts">
import type { ModelJsonValue, SafeExpression, SafeExpressionNode } from '@moluoxixi/config-form-model'
import type {
  DesignerExpressionPurpose,
  DesignerInteractionFieldOption,
  DesignerLiteralKind,
} from '../../types'
import { safeExpressionSchema } from '@moluoxixi/config-form-model'
import { ElCheckbox, ElInput, ElOption, ElSegmented, ElSelect } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '../../../../../../locale'

const props = withDefaults(defineProps<{
  disabled?: boolean
  fields: readonly DesignerInteractionFieldOption[]
  modelValue?: SafeExpression
  optional?: boolean
  purpose?: DesignerExpressionPurpose
}>(), {
  disabled: false,
  optional: false,
  purpose: 'condition',
})

const emit = defineEmits<{
  'update:modelValue': [value: SafeExpression | undefined]
}>()

const locale = useDesignerLocale()
const mode = ref<'advanced' | 'simple'>('simple')
const fieldId = ref<string>()
const operator = ref<'!=' | '<' | '<=' | '==' | '>' | '>='>('==')
const literalKind = ref<DesignerLiteralKind>('string')
const literalText = ref('')
const literalBoolean = ref(true)
const advancedDraft = ref('')
const advancedError = ref('')
const enabled = ref(!props.optional || props.modelValue !== undefined)
let syncedSignature = ''

const modeOptions = computed(() => [
  { label: locale.t('interaction.expression.simple', 'Simple'), value: 'simple' },
  { label: locale.t('interaction.expression.advanced', 'Advanced JSON'), value: 'advanced' },
])

const operatorOptions = ['==', '!=', '>', '>=', '<', '<='] as const
const literalKindOptions = computed(() => [
  { label: locale.t('valueType.text', 'Text'), value: 'string' },
  { label: locale.t('valueType.number', 'Number'), value: 'number' },
  { label: locale.t('valueType.boolean', 'Boolean'), value: 'boolean' },
  { label: locale.t('interaction.value.null', 'Null'), value: 'null' },
])

function signature(value: SafeExpression | undefined): string {
  return value === undefined ? '' : JSON.stringify(value)
}

function literalFromDraft(): ModelJsonValue | undefined {
  if (literalKind.value === 'null')
    return null
  if (literalKind.value === 'boolean')
    return literalBoolean.value
  if (literalKind.value === 'number') {
    if (literalText.value.trim() === '')
      return undefined
    const value = Number(literalText.value)
    return Number.isFinite(value) ? value : undefined
  }
  return literalText.value
}

function setLiteralDraft(value: ModelJsonValue): boolean {
  if (value === null) {
    literalKind.value = 'null'
    literalText.value = ''
    return true
  }
  if (typeof value === 'boolean') {
    literalKind.value = 'boolean'
    literalBoolean.value = value
    return true
  }
  if (typeof value === 'number') {
    literalKind.value = 'number'
    literalText.value = String(value)
    return true
  }
  if (typeof value === 'string') {
    literalKind.value = 'string'
    literalText.value = value
    return true
  }
  return false
}

function readSimpleCondition(expression: SafeExpression): boolean {
  const ast = expression.ast
  if (ast.kind !== 'binary'
    || !operatorOptions.includes(ast.operator as typeof operatorOptions[number])
    || ast.left.kind !== 'reference'
    || ast.left.scope !== 'values'
    || ast.left.path.length !== 1
    || ast.right.kind !== 'literal') {
    return false
  }
  const left = ast.left
  const field = props.fields.find(candidate => candidate.field === left.path[0])
  if (!field || !setLiteralDraft(ast.right.value))
    return false
  fieldId.value = field.id
  operator.value = ast.operator as typeof operator.value
  return true
}

function readSimpleValue(expression: SafeExpression): boolean {
  return expression.ast.kind === 'literal' && setLiteralDraft(expression.ast.value)
}

function syncFromModel(value: SafeExpression | undefined): void {
  const nextSignature = signature(value)
  if (nextSignature === syncedSignature)
    return
  syncedSignature = nextSignature
  enabled.value = !props.optional || value !== undefined
  advancedError.value = ''
  advancedDraft.value = value ? JSON.stringify(value, null, 2) : ''
  if (!value) {
    mode.value = 'simple'
    fieldId.value = props.fields[0]?.id
    return
  }
  const simple = props.purpose === 'condition'
    ? readSimpleCondition(value)
    : readSimpleValue(value)
  mode.value = simple ? 'simple' : 'advanced'
}

watch(() => props.modelValue, syncFromModel, { deep: true, immediate: true })
watch(() => props.fields, () => {
  if (!fieldId.value || !props.fields.some(field => field.id === fieldId.value))
    fieldId.value = props.fields[0]?.id
}, { deep: true, immediate: true })

function simpleExpression(): SafeExpression | undefined {
  const literal = literalFromDraft()
  if (literal === undefined)
    return undefined
  let ast: SafeExpressionNode = { kind: 'literal', value: literal }
  if (props.purpose === 'condition') {
    const field = props.fields.find(candidate => candidate.id === fieldId.value)
    if (!field)
      return undefined
    ast = {
      kind: 'binary',
      operator: operator.value,
      left: { kind: 'reference', scope: 'values', path: [field.field] },
      right: ast,
    }
  }
  return { version: 1, ast }
}

function emitExpression(value: SafeExpression | undefined): void {
  syncedSignature = signature(value)
  advancedDraft.value = value ? JSON.stringify(value, null, 2) : ''
  advancedError.value = ''
  emit('update:modelValue', value)
}

function commitSimple(): void {
  if (!enabled.value)
    return
  const expression = simpleExpression()
  if (expression)
    emitExpression(expression)
}

function selectMode(value: string | number | boolean): void {
  mode.value = value === 'advanced' ? 'advanced' : 'simple'
  if (mode.value === 'advanced') {
    const expression = props.modelValue ?? simpleExpression()
    advancedDraft.value = expression ? JSON.stringify(expression, null, 2) : ''
    advancedError.value = ''
    return
  }
  if (!fieldId.value)
    fieldId.value = props.fields[0]?.id
  commitSimple()
}

function toggleEnabled(value: string | number | boolean): void {
  enabled.value = value === true
  if (!enabled.value) {
    emitExpression(undefined)
    return
  }
  if (!fieldId.value)
    fieldId.value = props.fields[0]?.id
  commitSimple()
}

function applyAdvanced(): void {
  try {
    const parsed = safeExpressionSchema.safeParse(JSON.parse(advancedDraft.value))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      advancedError.value = `${issue?.path.join('.') || 'expression'}: ${issue?.message ?? locale.t('interaction.expression.invalid', 'Invalid expression')}`
      return
    }
    emitExpression(parsed.data)
  }
  catch (error) {
    advancedError.value = error instanceof Error
      ? error.message
      : locale.t('interaction.expression.invalidJson', 'Invalid JSON')
  }
}
</script>

<template>
  <div class="mx-config-form-designer__expression-editor" :data-expression-purpose="purpose">
    <ElCheckbox v-if="optional" :model-value="enabled" :disabled="disabled" @update:model-value="toggleEnabled">
      {{ locale.t('interaction.condition.enabled', 'Use condition') }}
    </ElCheckbox>

    <template v-if="enabled">
      <ElSegmented
        :model-value="mode"
        :options="modeOptions"
        :disabled="disabled"
        block
        :aria-label="locale.t('interaction.expression.mode', 'Expression mode')"
        @change="selectMode"
      />

      <div v-if="mode === 'simple'" class="mx-config-form-designer__expression-simple">
        <template v-if="purpose === 'condition'">
          <ElSelect
            :model-value="fieldId"
            :disabled="disabled || fields.length === 0"
            :aria-label="locale.t('interaction.condition.field', 'Condition field')"
            @update:model-value="fieldId = $event; commitSimple()"
          >
            <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
          </ElSelect>
          <ElSelect
            :model-value="operator"
            :disabled="disabled"
            :aria-label="locale.t('interaction.condition.operator', 'Condition operator')"
            @update:model-value="operator = $event; commitSimple()"
          >
            <ElOption v-for="item in operatorOptions" :key="item" :value="item" :label="item" />
          </ElSelect>
        </template>
        <ElSelect
          :model-value="literalKind"
          :disabled="disabled"
          :aria-label="locale.t('interaction.value.type', 'Value type')"
          @update:model-value="literalKind = $event; commitSimple()"
        >
          <ElOption v-for="item in literalKindOptions" :key="item.value" :value="item.value" :label="item.label" />
        </ElSelect>
        <ElSelect
          v-if="literalKind === 'boolean'"
          :model-value="literalBoolean"
          :disabled="disabled"
          :aria-label="locale.t('interaction.value.literal', 'Value')"
          @update:model-value="literalBoolean = $event; commitSimple()"
        >
          <ElOption :value="true" :label="locale.t('value.true', 'True')" />
          <ElOption :value="false" :label="locale.t('value.false', 'False')" />
        </ElSelect>
        <ElInput
          v-else-if="literalKind !== 'null'"
          :model-value="literalText"
          :type="literalKind === 'number' ? 'number' : 'text'"
          :disabled="disabled"
          :aria-label="locale.t('interaction.value.literal', 'Value')"
          @update:model-value="literalText = $event"
          @blur="commitSimple"
          @keydown.enter.prevent="commitSimple"
        />
      </div>

      <div v-else class="mx-config-form-designer__expression-advanced">
        <ElInput
          v-model="advancedDraft"
          type="textarea"
          :rows="8"
          :disabled="disabled"
          :aria-label="locale.t('interaction.expression.json', 'Safe expression JSON')"
          :class="{ 'is-error': advancedError }"
          @input="advancedError = ''"
        />
        <p v-if="advancedError" class="mx-config-form-designer__interaction-error" role="alert">
          {{ advancedError }}
        </p>
        <button type="button" class="mx-config-form-designer__interaction-command" :disabled="disabled" @click="applyAdvanced">
          {{ locale.t('action.apply', 'Apply') }}
        </button>
      </div>
    </template>
  </div>
</template>
