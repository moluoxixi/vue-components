<script setup lang="ts">
import type { DesignerPropertySetterDefinition } from '../registry'
import type { DesignerNode } from '../document'
import { Minus, Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import DesignerConditionSetter from './DesignerConditionSetter.vue'
import DesignerDefaultValueSetter from './DesignerDefaultValueSetter.vue'
import DesignerOptionsSetter from './DesignerOptionsSetter.vue'
import DesignerValidationSetter from './DesignerValidationSetter.vue'

const props = defineProps<{
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  readonly?: boolean
  node?: DesignerNode
  fieldOptions?: string[]
  validatorOptions?: string[]
}>()

const emit = defineEmits<{
  commit: [value: unknown]
}>()
const locale = useDesignerLocale()

const textDraft = ref('')
const draftDirty = ref(false)
const compound = computed(() => ['defaultValue', 'options', 'condition', 'validation'].includes(props.setter.control))
const horizontal = computed(() => ['text', 'textarea', 'number', 'boolean', 'select'].includes(props.setter.control))
const inherited = computed(() => props.value === undefined && props.inheritedValue !== undefined)

function displayText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function resetDraft(): void {
  textDraft.value = displayText(inherited.value ? props.inheritedValue : props.value)
  draftDirty.value = false
}

watch(() => [props.value, props.inheritedValue], resetDraft, { deep: true, immediate: true })

function commitText(): void {
  const next = textDraft.value
  if (props.setter.control === 'number') {
    if (!draftDirty.value)
      return
    draftDirty.value = false
    if (!next.trim()) {
      emit('commit', undefined)
      return
    }
    const numeric = Number(next)
    const clamped = Math.min(props.setter.max ?? Number.POSITIVE_INFINITY, Math.max(props.setter.min ?? Number.NEGATIVE_INFINITY, numeric))
    textDraft.value = String(clamped)
    emit('commit', clamped)
    return
  }
  emit('commit', next || undefined)
}

function commitNumberChange(event: Event): void {
  textDraft.value = (event.currentTarget as HTMLInputElement).value
  draftDirty.value = true
  commitText()
}

function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && props.setter.control !== 'textarea') {
    event.preventDefault()
    commitText()
    ;(event.currentTarget as HTMLElement).blur()
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    resetDraft()
    ;(event.currentTarget as HTMLElement).blur()
  }
}

function stepNumber(direction: -1 | 1): void {
  const current = Number(textDraft.value)
  const inheritedFallback = Number(props.inheritedValue)
  const fallback = Number.isFinite(inheritedFallback) ? inheritedFallback : (props.setter.min ?? 0)
  const step = props.setter.step ?? 1
  const next = (Number.isFinite(current) ? current : fallback) + direction * step
  const clamped = Math.min(props.setter.max ?? Number.POSITIVE_INFINITY, Math.max(props.setter.min ?? Number.NEGATIVE_INFINITY, next))
  textDraft.value = String(clamped)
  draftDirty.value = false
  emit('commit', clamped)
}

function commitBoolean(): void {
  emit('commit', !Boolean(props.value))
}

function commitSelect(value: unknown): void {
  emit('commit', value)
}

function commitCustom(value: unknown): void {
  emit('commit', value)
}
</script>

<template>
  <div class="mx-config-form-designer__setter" :class="{ 'is-compound': compound, 'is-horizontal': horizontal }">
    <span class="mx-config-form-designer__setter-label-row">
      <span class="mx-config-form-designer__setter-label">{{ setter.label }}</span>
      <span v-if="inherited" class="mx-config-form-designer__setter-hint">{{ locale.t('setter.inherited', 'Inherited') }}</span>
    </span>

    <input
      v-if="setter.control === 'text'"
      v-model="textDraft"
      type="text"
      :aria-label="setter.label"
      :disabled="readonly"
      @blur="commitText"
      @keydown="handleTextKeydown"
    >
    <textarea
      v-else-if="setter.control === 'textarea'"
      v-model="textDraft"
      rows="3"
      :aria-label="setter.label"
      :disabled="readonly"
      @blur="commitText"
      @keydown.esc.prevent="resetDraft"
    />
    <div v-else-if="setter.control === 'number'" class="mx-config-form-designer__stepper">
      <button type="button" :aria-label="locale.t('setter.decrease', 'Decrease {label}', { label: setter.label })" :disabled="readonly || (setter.min !== undefined && Number(textDraft) <= setter.min)" @click="stepNumber(-1)">
        <Minus :size="15" aria-hidden="true" />
      </button>
      <input
        v-model="textDraft"
        type="number"
        :aria-label="setter.label"
        :min="setter.min"
        :max="setter.max"
        :step="setter.step"
        :disabled="readonly"
        @input="draftDirty = true"
        @change="commitNumberChange"
        @blur="commitText"
        @keydown="handleTextKeydown"
      >
      <button type="button" :aria-label="locale.t('setter.increase', 'Increase {label}', { label: setter.label })" :disabled="readonly || (setter.max !== undefined && Number(textDraft) >= setter.max)" @click="stepNumber(1)">
        <Plus :size="15" aria-hidden="true" />
      </button>
    </div>
    <button
      v-else-if="setter.control === 'boolean'"
      type="button"
      class="mx-config-form-designer__switch-row"
      role="switch"
      :aria-label="setter.label"
      :aria-checked="Boolean(value)"
      :disabled="readonly"
      @click="commitBoolean"
    >
      <span>{{ value ? locale.t('switch.on', 'On') : locale.t('switch.off', 'Off') }}</span>
      <span class="mx-config-form-designer__switch" :class="{ 'is-on': Boolean(value) }" aria-hidden="true"><span /></span>
    </button>
    <div
      v-else-if="setter.control === 'select'"
      class="mx-config-form-designer__segmented"
      role="group"
      :aria-label="setter.label"
    >
      <button
        v-for="(option, index) in setter.options"
        :key="index"
        type="button"
        :class="{ 'is-active': Object.is(option.value, value) }"
        :aria-pressed="Object.is(option.value, value)"
        :disabled="readonly"
        @click="commitSelect(option.value)"
      >{{ option.label }}</button>
    </div>
    <component
      :is="setter.component"
      v-else-if="setter.control === 'custom' && setter.component"
      :model-value="value"
      :disabled="readonly"
      :node="node"
      v-bind="setter.componentProps"
      @update:model-value="commitCustom"
    />
    <DesignerDefaultValueSetter
      v-else-if="setter.control === 'defaultValue' && setter.valueKind"
      :model-value="value"
      :kind="setter.valueKind"
      :options="setter.options"
      :disabled="readonly"
      @update:model-value="commitCustom"
    />
    <DesignerOptionsSetter v-else-if="setter.control === 'options'" :model-value="value" :disabled="readonly" @update:model-value="commitCustom" />
    <DesignerConditionSetter v-else-if="setter.control === 'condition'" :model-value="value" :disabled="readonly" @update:model-value="commitCustom" />
    <DesignerValidationSetter
      v-else-if="setter.control === 'validation'"
      :model-value="value"
      :disabled="readonly"
      :current-field="node?.kind === 'field' ? node.field : undefined"
      :field-options="fieldOptions"
      :validator-options="validatorOptions"
      @update:model-value="commitCustom"
    />
  </div>
</template>
