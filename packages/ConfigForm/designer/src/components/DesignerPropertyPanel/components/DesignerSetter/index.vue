<script setup lang="ts">
import type { DesignerPropertySetterDefinition } from '@designer/registry'
import type { SurfaceNode } from '@moluoxixi/config-form-model'
import { useDesignerLocale } from '@designer/locale'
import { computed, useId } from 'vue'
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
  node?: SurfaceNode
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
      <span class="mx-config-form-designer__setter-label" :title="props.setter.label">{{ props.setter.label }}</span>
      <span class="mx-config-form-designer__setter-hints">
        <span v-if="inherited" class="mx-config-form-designer__setter-hint">{{ locale.t('setter.inherited', 'Inherited') }}</span>
        <span v-if="props.hint" :id="hintId" class="mx-config-form-designer__setter-hint is-value">{{ props.hint }}</span>
      </span>
    </span>

    <component
      :is="props.setter.component"
      v-if="props.setter.control === 'custom' && props.setter.component"
      :model-value="props.value"
      :disabled="props.readonly"
      :node="props.node"
      v-bind="props.setter.componentProps"
      @update:model-value="commitCustom"
    />
    <DesignerDefaultValueSetter
      v-else-if="props.setter.control === 'defaultValue' && props.setter.valueKind"
      :model-value="props.value"
      :kind="props.setter.valueKind"
      :options="props.setter.options"
      :disabled="props.readonly"
      @update:model-value="commitCustom"
    />
    <DesignerOptionsSetter
      v-else-if="props.setter.control === 'options'"
      :model-value="props.value"
      :option-value-types="props.setter.optionValueTypes"
      :disabled="props.readonly"
      @update:model-value="commitCustom"
    />
    <DesignerValidationSetter
      v-else-if="props.setter.control === 'validation'"
      :model-value="props.value"
      :value-kind="props.setter.valueKind"
      :options="props.setter.options"
      :disabled="props.readonly"
      @update:model-value="commitCustom"
    />
    <DesignerValidateOnSetter
      v-else-if="props.setter.control === 'validateOn'"
      :model-value="props.value"
      :disabled="props.readonly"
      @update:model-value="commitCustom"
    />
  </div>
</template>
