<script setup lang="ts">
import type { SafeExpressionNode } from '@moluoxixi/config-form-model'
import type { DesignerInteractionFieldOption } from '../../../types'
import { useDesignerLocale } from '@designer/locale'
import { ElInput, ElOption, ElSelect } from 'element-plus'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'DesignerConditionTree' })
const props = withDefaults(
  defineProps<{
    modelValue: SafeExpressionNode
    fields: readonly DesignerInteractionFieldOption[]
    disabled?: boolean
    depth?: number
  }>(),
  { depth: 0, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: SafeExpressionNode] }>()
const locale = useDesignerLocale()
const chinese = computed(() => locale.locale === 'zh-CN')
const grouped = computed(() => props.modelValue.kind === 'binary' && ['&&', '||'].includes(props.modelValue.operator))
function nestingDepth(node: SafeExpressionNode): number {
  if (node.kind === 'unary' && node.operator === '!')
    return 1 + nestingDepth(node.operand)
  if (node.kind === 'binary' && ['&&', '||'].includes(node.operator))
    return 1 + Math.max(nestingDepth(node.left), nestingDepth(node.right))
  return 0
}
const canWrap = computed(() => props.depth + nestingDepth(props.modelValue) < 6)
const selectedFieldId = computed(() => {
  if (props.modelValue.kind !== 'binary' || props.modelValue.left.kind !== 'reference')
    return undefined
  const fieldName = props.modelValue.left.path[0]
  return props.fields.find(field => field.field === fieldName)?.id
})
const draft = ref('')
const error = ref('')
watch(
  () => props.modelValue,
  (node) => {
    if (node.kind === 'binary' && node.right.kind === 'literal')
      draft.value = JSON.stringify(node.right.value)
    error.value = ''
  },
  { deep: true, immediate: true },
)
function defaultLeaf(): SafeExpressionNode {
  return {
    kind: 'binary',
    operator: '==',
    left: { kind: 'reference', scope: 'values', path: [props.fields[0]?.field ?? 'field'] },
    right: { kind: 'literal', value: '' },
  }
}
function patchSide(side: 'left' | 'right', value: SafeExpressionNode): void {
  if (props.modelValue.kind === 'binary')
    emit('update:modelValue', { ...props.modelValue, [side]: value })
}
function fieldChanged(value: unknown): void {
  const field = props.fields.find(item => item.id === value)
  if (field)
    patchSide('left', { kind: 'reference', scope: 'values', path: [field.field] })
}
function operatorChanged(value: unknown): void {
  if (props.modelValue.kind === 'binary') {
    emit('update:modelValue', {
      ...props.modelValue,
      operator: String(value) as Extract<SafeExpressionNode, { kind: 'binary' }>['operator'],
    })
  }
}
function literalChanged(): void {
  try {
    patchSide('right', { kind: 'literal', value: JSON.parse(draft.value) })
    error.value = ''
  }
  catch {
    error.value = chinese.value
      ? '请输入 JSON 值，例如 "文本"、10、true。'
      : 'Enter a JSON value, such as "text", 10 or true.'
  }
}
function group(): void {
  if (props.disabled || !canWrap.value || props.fields.length === 0)
    return
  emit('update:modelValue', { kind: 'binary', operator: '&&', left: props.modelValue, right: defaultLeaf() })
}
function negate(): void {
  if (props.disabled || !canWrap.value)
    return
  emit('update:modelValue', { kind: 'unary', operator: '!', operand: props.modelValue })
}
</script>

<template>
  <div class="mx-config-form-designer__condition-tree" :data-depth="props.depth">
    <template v-if="props.modelValue.kind === 'unary' && props.modelValue.operator === '!'">
      <header>
        <strong>{{ chinese ? '取反' : 'NOT' }}</strong><button type="button" :disabled="props.disabled" @click="emit('update:modelValue', props.modelValue.operand)">
          {{ chinese ? '取消取反' : 'Remove NOT' }}
        </button>
      </header>
      <DesignerConditionTree
        :model-value="props.modelValue.operand"
        :fields="props.fields"
        :disabled="props.disabled"
        :depth="props.depth + 1"
        @update:model-value="emit('update:modelValue', { kind: 'unary', operator: '!', operand: $event })"
      />
    </template>
    <template v-else-if="grouped && props.modelValue.kind === 'binary'">
      <header>
        <ElSelect
          :model-value="props.modelValue.operator"
          :disabled="props.disabled"
          :aria-label="chinese ? '条件组逻辑' : 'Condition group logic'"
          @update:model-value="operatorChanged"
        >
          <ElOption value="&&" :label="chinese ? '全部满足（且）' : 'ALL (AND)'" /><ElOption
            value="||"
            :label="chinese ? '任一满足（或）' : 'ANY (OR)'"
          />
        </ElSelect>
      </header>
      <DesignerConditionTree
        :model-value="props.modelValue.left"
        :fields="props.fields"
        :disabled="props.disabled"
        :depth="props.depth + 1"
        @update:model-value="patchSide('left', $event)"
      />
      <button type="button" :disabled="props.disabled" @click="emit('update:modelValue', props.modelValue.right)">
        {{ chinese ? '移除上方条件' : 'Remove first condition' }}
      </button>
      <DesignerConditionTree
        :model-value="props.modelValue.right"
        :fields="props.fields"
        :disabled="props.disabled"
        :depth="props.depth + 1"
        @update:model-value="patchSide('right', $event)"
      />
      <button type="button" :disabled="props.disabled" @click="emit('update:modelValue', props.modelValue.left)">
        {{ chinese ? '移除下方条件' : 'Remove second condition' }}
      </button>
    </template>
    <template
      v-else-if="
        props.modelValue.kind === 'binary'
          && ['==', '!=', '>', '>=', '<', '<='].includes(props.modelValue.operator)
          && props.modelValue.left.kind === 'reference'
          && props.modelValue.left.scope === 'values'
          && props.modelValue.left.path.length === 1
          && props.modelValue.right.kind === 'literal'
      "
    >
      <ElSelect
        :model-value="selectedFieldId"
        :disabled="props.disabled"
        :aria-label="chinese ? '条件字段' : 'Condition field'"
        @update:model-value="fieldChanged"
      >
        <ElOption v-for="field in props.fields" :key="field.id" :value="field.id" :label="field.label" />
      </ElSelect>
      <ElSelect
        :model-value="props.modelValue.operator"
        :disabled="props.disabled"
        :aria-label="chinese ? '条件运算符' : 'Condition operator'"
        @update:model-value="operatorChanged"
      >
        <ElOption
          v-for="operator in ['==', '!=', '>', '>=', '<', '<=']"
          :key="operator"
          :value="operator"
          :label="operator"
        />
      </ElSelect>
      <ElInput
        v-model="draft"
        :disabled="props.disabled"
        :aria-label="chinese ? '条件 JSON 值' : 'Condition JSON value'"
        @blur="literalChanged"
        @keydown.enter.prevent="literalChanged"
      />
      <p v-if="error" role="alert">
        {{ error }}
      </p>
    </template>
    <div v-else>
      <p>
        {{
          chinese
            ? '此表达式可在高级 JSON 中编辑；条件组会完整保留它。'
            : 'Edit this expression in Advanced JSON. Groups preserve it in full.'
        }}
      </p>
      <pre>{{ JSON.stringify(props.modelValue, null, 2) }}</pre>
    </div>
    <footer v-if="props.depth < 6">
      <button type="button" :disabled="props.disabled || !canWrap || props.fields.length === 0" @click="group">
        {{ chinese ? '+ 嵌套条件组' : '+ Group condition' }}
      </button><button
        type="button"
        :disabled="props.disabled || !canWrap"
        @click="negate"
      >
        {{ chinese ? '取反' : 'Negate' }}
      </button>
    </footer>
  </div>
</template>
