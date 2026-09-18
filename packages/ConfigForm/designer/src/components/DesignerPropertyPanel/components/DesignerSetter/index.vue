<script setup lang="ts">
import type { PageNode } from '@moluoxixi/config-form-model'
import type { DesignerPropertySetterDefinition } from '@designer/registry'
import { computed, useId } from 'vue'
import { useDesignerLocale } from '@designer/locale'
import DesignerDefaultValueSetter from '../DesignerDefaultValueSetter/index.vue'
import DesignerOptionsSetter from '../DesignerOptionsSetter/index.vue'
import DesignerValidateOnSetter from '../DesignerValidateOnSetter/index.vue'
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
}>()

const emit = defineEmits<{
  commit: [value: unknown]
}>()
const locale = useDesignerLocale()
const hintId = useId()

const compound = computed(() => ['defaultValue', 'options', 'validation', 'validateOn'].includes(props.setter.control))
const inherited = computed(() => props.value === undefined && props.inheritedValue !== undefined)

function commitCustom(value: unknown): void {
  emit('commit', value)
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
    <DesignerValidationSetter
      v-else-if="setter.control === 'validation'"
      :model-value="value"
      :disabled="readonly"
      @update:model-value="commitCustom"
    />
    <DesignerValidateOnSetter
      v-else-if="setter.control === 'validateOn'"
      :model-value="value"
      :disabled="readonly"
      @update:model-value="commitCustom"
    />
  </div>
</template>
