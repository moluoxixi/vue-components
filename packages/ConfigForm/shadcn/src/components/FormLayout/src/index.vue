<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type { ShadcnConfigFormNode } from '../../../types'
import type { FormLayoutEmits, FormLayoutProps } from './types'
import { computed } from 'vue'
import ConfigFormNodeItem from '../../ConfigFormNode'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'ShadcnConfigFormLayout',
})

const props = withDefaults(defineProps<FormLayoutProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 12,
  rowProps: () => ({}),
})

const emit = defineEmits<FormLayoutEmits<TValues>>()

const visibleNodes = computed<ShadcnConfigFormNode<TValues>[]>(() => {
  return props.nodes.filter(node => isConfigFormNodeVisible(node, props.model))
})

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function getNodeKey(node: ShadcnConfigFormNode<TValues>, index: number): string | number {
  return isConfigFormField(node) ? node.field : index
}
</script>

<template>
  <div
    class="mx-shadcn-config-form__grid"
    v-bind="props.rowProps"
  >
    <ConfigFormNodeItem
      v-for="(node, index) in visibleNodes"
      :key="getNodeKey(node, index)"
      :col-props="props.colProps"
      :errors="errors"
      :field-span="props.fieldSpan"
      :model="model"
      :node="node"
      wrap-cell
      @field-change="handleFieldChange"
    />
  </div>
</template>
