<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type {
  ElementConfigFormNode,
} from '../../../types'
import type { FormLayoutEmits, FormLayoutProps } from './types'
import { ElRow } from 'element-plus'
import { computed } from 'vue'
import ConfigFormNodeItem from '../../ConfigFormNode'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'FormLayout',
})

const props = withDefaults(defineProps<FormLayoutProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  rowProps: () => ({ gutter: 16 }),
})

const emit = defineEmits<FormLayoutEmits<TValues>>()

const visibleNodes = computed<ElementConfigFormNode<TValues>[]>(() => {
  return props.nodes.filter(node => isConfigFormNodeVisible(node, props.model))
})

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function getNodeKey(node: ElementConfigFormNode<TValues>, index: number): string | number {
  return isConfigFormField(node) ? node.field : index
}
</script>

<template>
  <ElRow
    class="mx-element-config-form__row"
    v-bind="props.rowProps"
  >
    <ConfigFormNodeItem
      v-for="(node, index) in visibleNodes"
      :key="getNodeKey(node, index)"
      :col-props="props.colProps"
      :field-span="props.fieldSpan"
      :model="model"
      :node="node"
      wrap-col
      @field-change="handleFieldChange"
    />
  </ElRow>
</template>
