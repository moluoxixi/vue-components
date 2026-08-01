<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormFieldValidateRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { AntdConfigFormNode } from '../../../types'
import type { FormLayoutEmits, FormLayoutProps } from './types'
import { Row as ARow } from 'ant-design-vue'
import { computed } from 'vue'
import ConfigFormNodeItem from '../../ConfigFormNode'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-headless'

defineOptions({
  name: 'AntdConfigFormLayout',
})

const props = withDefaults(defineProps<FormLayoutProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  inlineLayout: false,
  rowProps: () => ({ gutter: 16 }),
})

const emit = defineEmits<FormLayoutEmits<TValues>>()

const visibleNodes = computed<AntdConfigFormNode<TValues>[]>(() => {
  return props.nodes.filter(node => isConfigFormNodeVisible(node, props.model))
})

const layoutRowProps = computed(() => {
  if (!props.inlineLayout)
    return props.rowProps

  const inlineRowProps = { ...props.rowProps }
  delete inlineRowProps.gutter
  return inlineRowProps
})

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function handleFieldValidate(payload: ConfigFormFieldValidateRequest<TValues>): void {
  emit('fieldValidate', payload)
}

function getNodeKey(node: AntdConfigFormNode<TValues>, index: number): string | number {
  return isConfigFormField(node) ? node.field : index
}
</script>

<template>
  <ARow
    class="mx-antd-config-form__row"
    :class="{ 'mx-antd-config-form__row--inline': props.inlineLayout }"
    v-bind="layoutRowProps"
  >
    <ConfigFormNodeItem
      v-for="(node, index) in visibleNodes"
      :key="getNodeKey(node, index)"
      :col-props="props.colProps"
      :errors="props.errors"
      :field-span="props.fieldSpan"
      :model="model"
      :node="node"
      :readonly="props.readonly"
      :readonly-render="props.readonlyRender"
      :wrap-col="!props.inlineLayout"
      @field-change="handleFieldChange"
      @field-validate="handleFieldValidate"
    />
  </ARow>
</template>
