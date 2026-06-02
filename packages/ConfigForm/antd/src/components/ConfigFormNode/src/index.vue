<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type {
  AntdConfigFormComponentNode,
  AntdConfigFormComponentSlot,
  AntdConfigFormComponentSlotContent,
  AntdConfigFormComponentSlotContext,
  AntdConfigFormField,
  AntdConfigFormFieldSlot,
  AntdConfigFormFieldSlotContent,
  AntdConfigFormFieldSlotContext,
  AntdConfigFormNode,
} from '../../../types'
import type { ConfigFormNodeEmits, ConfigFormNodeProps } from './types'
import type { Component, VNodeChild } from 'vue'
import { Col as ACol } from 'ant-design-vue'
import { defineComponent, h, markRaw } from 'vue'
import ConfigFormFieldItem from '../../ConfigFormField'
import FormComponent from '../../FormComponent'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'AntdConfigFormNode',
})

const props = withDefaults(defineProps<ConfigFormNodeProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  wrapCol: false,
})

const emit = defineEmits<ConfigFormNodeEmits<TValues>>()
const ConfigFormFieldComponent = ConfigFormFieldItem as Component
const FormComponentItem = FormComponent as Component

const ConfigFormNodeRender = defineComponent({
  name: 'AntdConfigFormNodeRender',
  setup() {
    /**
     * 递归节点需要动态组装命名 slots，render 函数比模板更能准确表达这层协议。
     */
    return () => renderNode(props.node, props.wrapCol, 'root')
  },
})

function emitFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function renderNode(node: AntdConfigFormNode<TValues>, wrapCol: boolean, path: string): VNodeChild {
  if (!isConfigFormNodeVisible(node, props.model))
    return null

  const body = isConfigFormField(node)
    ? renderBoundNode(node, path)
    : renderComponentNode(node, path)

  if (!wrapCol)
    return body

  return h(ACol, {
    ...props.colProps,
    ...node.colProps,
    key: path,
    span: node.span ?? props.fieldSpan,
  }, () => body)
}

function renderBoundNode(field: AntdConfigFormField<TValues>, path: string): VNodeChild {
  if (typeof field.label !== 'string')
    return renderFormComponentNode(field, path)

  return h(ConfigFormFieldComponent, {
    field,
    key: `${path}.field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderFormComponentNode(field: AntdConfigFormField<TValues>, path: string): VNodeChild {
  return h(FormComponentItem, {
    field,
    key: `${path}.component-field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderComponentNode(node: AntdConfigFormComponentNode<TValues>, path: string): VNodeChild {
  const slots = createNodeSlots(node, path)

  if (typeof node.component === 'string') {
    return h(node.component, {
      ...node.props,
      key: `${path}.component`,
    }, slots?.default?.() ?? [])
  }

  return h(getNodeComponent(node), {
    ...node.props,
    key: `${path}.component`,
  }, slots)
}

function getNodeComponent(node: AntdConfigFormComponentNode<TValues>): AntdConfigFormComponentNode<TValues>['component'] {
  const component = node.component

  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as AntdConfigFormComponentNode<TValues>['component']

  return component
}

function createNodeSlots(
  node: AntdConfigFormNode<TValues>,
  path: string,
): Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined {
  const slots = node.slots

  if (!slots)
    return undefined

  return Object.fromEntries(
    Object.entries(slots).map(([slotName, slot]) => [
      slotName,
      (slotProps: Record<string, unknown> = {}) =>
        renderSlotContent(slot, node, slotProps, `${path}.slots.${slotName}`),
    ]),
  )
}

function renderSlotContent(
  slot: AntdConfigFormComponentSlotContent<TValues> | AntdConfigFormFieldSlotContent<TValues>,
  ownerNode: AntdConfigFormNode<TValues>,
  slotProps: Record<string, unknown>,
  path: string,
): VNodeChild {
  if (typeof slot === 'function')
    return renderSlotFunction(slot, ownerNode, slotProps)

  if (Array.isArray(slot))
    return slot.map((node, index) => renderNode(node, false, `${path}.${index}`))

  return renderNode(slot, false, path)
}

function renderSlotFunction(
  slot: AntdConfigFormComponentSlot<TValues> | AntdConfigFormFieldSlot<TValues>,
  ownerNode: AntdConfigFormNode<TValues>,
  slotProps: Record<string, unknown>,
): VNodeChild {
  if (isConfigFormField(ownerNode))
    return (slot as AntdConfigFormFieldSlot<TValues>)(createFieldSlotContext(ownerNode, slotProps))

  return (slot as AntdConfigFormComponentSlot<TValues>)(createComponentSlotContext(ownerNode, slotProps))
}

function createFieldSlotContext(
  field: AntdConfigFormField<TValues>,
  slotProps: Record<string, unknown>,
): AntdConfigFormFieldSlotContext<TValues> {
  return {
    field,
    model: props.model,
    setValue: value => emitFieldChange({ field: field.field, value }),
    slotProps,
    value: props.model[field.field],
  }
}

function createComponentSlotContext(
  node: AntdConfigFormComponentNode<TValues>,
  slotProps: Record<string, unknown>,
): AntdConfigFormComponentSlotContext<TValues> {
  return {
    model: props.model,
    node,
    slotProps,
  }
}
</script>

<template>
  <ConfigFormNodeRender />
</template>
