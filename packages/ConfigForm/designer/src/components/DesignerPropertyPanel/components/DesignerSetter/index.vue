<script setup lang="ts">
import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import type { PageNode } from '@moluoxixi/config-form-model'
import type { DesignerPropertySetterDefinition } from '@designer/registry'
import { computed, useId } from 'vue'
import { useDesignerLocale } from '@designer/locale'
import DesignerConditionSetter from '../DesignerConditionSetter/index.vue'
import DesignerDefaultValueSetter from '../DesignerDefaultValueSetter/index.vue'
import DesignerOptionsSetter from '../DesignerOptionsSetter/index.vue'
import DesignerReactionSetter from '../DesignerReactionSetter/index.vue'
import DesignerValidationSetter from '../DesignerValidationSetter/index.vue'

/**
 * Compound setter host. Simple controls (text / textarea / number / boolean /
 * select) always resolve through the property-control registry — the designer
 * core provides fixed Element Plus defaults — and never reach this component.
 */
const props = defineProps<{
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
  readonly?: boolean
  node?: PageNode
  fieldOptions?: string[]
  reactionIds?: string[]
  validatorOptions?: string[]
}>()

const emit = defineEmits<{
  commit: [value: unknown]
}>()
const locale = useDesignerLocale()
const hintId = useId()

const compound = computed(() => ['defaultValue', 'options', 'condition', 'reaction', 'validation'].includes(props.setter.control))
const inherited = computed(() => props.value === undefined && props.inheritedValue !== undefined)

function commitCustom(value: unknown): void {
  emit('commit', value)
}

function reactionValue(value: unknown): ConfigFormReaction[] | undefined {
  return Array.isArray(value) ? value as ConfigFormReaction[] : undefined
}
</script>

<template>
  <div class="mx-config-form-designer__setter" :class="{ 'is-compound': compound }">
    <span class="mx-config-form-designer__setter-label-row">
      <span class="mx-config-form-designer__setter-label" :title="setter.label">{{ setter.label }}</span>
      <span class="mx-config-form-designer__setter-hints">
        <span v-if="inherited" class="mx-config-form-designer__setter-hint">{{ locale.t('setter.inherited', 'Inherited') }}</span>
        <span v-if="hint" :id="hintId" class="mx-config-form-designer__setter-hint is-value">{{ hint }}</span>
      </span>
    </span>

    <component
      :is="setter.component"
      v-if="setter.control === 'custom' && setter.component"
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
    <DesignerConditionSetter v-else-if="setter.control === 'condition'" :model-value="value" :disabled="readonly" :field-options="fieldOptions" @update:model-value="commitCustom" />
    <DesignerReactionSetter
      v-else-if="setter.control === 'reaction'"
      :model-value="reactionValue(value)"
      :disabled="readonly"
      :current-field="node?.kind === 'field' ? node.field : undefined"
      :field-options="fieldOptions"
      :reserved-ids="reactionIds"
      @update:model-value="commitCustom"
    />
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
