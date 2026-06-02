<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type { AntdConfigFormNode } from '../../../types'
import type { FormLayoutEmits, FormLayoutProps } from './types'
import { Row as ARow } from 'ant-design-vue'
import { computed } from 'vue'
import ConfigFormNodeItem from '../../ConfigFormNode'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'AntdConfigFormLayout',
})

const props = withDefaults(defineProps<FormLayoutProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  rowProps: () => ({ gutter: 16 }),
})

const emit = defineEmits<FormLayoutEmits<TValues>>()

const visibleNodes = computed<AntdConfigFormNode<TValues>[]>(() => {
  return props.nodes.filter(node => isConfigFormNodeVisible(node, props.model))
})

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function getNodeKey(node: AntdConfigFormNode<TValues>, index: number): string | number {
  return isConfigFormField(node) ? node.field : index
}
</script>

<template>
  <ARow
    class="mx-antd-config-form__row"
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
  </ARow>
</template>
