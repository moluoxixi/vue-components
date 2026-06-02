<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '../../../../../ConfigForm'
import type {
  ElementConfigFormComponentNode,
  ElementConfigFormComponentSlot,
  ElementConfigFormComponentSlotContent,
  ElementConfigFormComponentSlotContext,
  ElementConfigFormField,
  ElementConfigFormFieldSlot,
  ElementConfigFormFieldSlotContent,
  ElementConfigFormFieldSlotContext,
  ElementConfigFormNode,
} from '../../../types'
import type { ConfigFormNodeEmits, ConfigFormNodeProps } from './types'
import type { Component, VNodeChild } from 'vue'
import { ElCol } from 'element-plus'
import { defineComponent, h, markRaw } from 'vue'
import ConfigFormFieldItem from '../../ConfigFormField'
import FormComponent from '../../FormComponent'
import { isConfigFormField, isConfigFormNodeVisible } from '../../../../../ConfigForm'

defineOptions({
  name: 'ConfigFormNode',
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
  name: 'ConfigFormNodeRender',
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

function renderNode(node: ElementConfigFormNode<TValues>, wrapCol: boolean, path: string): VNodeChild {
  if (!isConfigFormNodeVisible(node, props.model))
    return null

  const body = isConfigFormField(node)
    ? renderBoundNode(node, path)
    : renderComponentNode(node, path)

  if (!wrapCol)
    return body

  return h(ElCol, {
    ...props.colProps,
    ...node.colProps,
    key: path,
    span: node.span ?? props.fieldSpan,
  }, () => body)
}

function renderBoundNode(field: ElementConfigFormField<TValues>, path: string): VNodeChild {
  if (typeof field.label !== 'string')
    return renderFormComponentNode(field, path)

  return h(ConfigFormFieldComponent, {
    field,
    key: `${path}.field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderFormComponentNode(field: ElementConfigFormField<TValues>, path: string): VNodeChild {
  return h(FormComponentItem, {
    field,
    key: `${path}.component-field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderComponentNode(node: ElementConfigFormComponentNode<TValues>, path: string): VNodeChild {
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

function getNodeComponent(node: ElementConfigFormComponentNode<TValues>): ElementConfigFormComponentNode<TValues>['component'] {
  return markRaw(node.component as object) as ElementConfigFormComponentNode<TValues>['component']
}

function createNodeSlots(
  node: ElementConfigFormNode<TValues>,
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
  slot: ElementConfigFormComponentSlotContent<TValues> | ElementConfigFormFieldSlotContent<TValues>,
  ownerNode: ElementConfigFormNode<TValues>,
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
  slot: ElementConfigFormComponentSlot<TValues> | ElementConfigFormFieldSlot<TValues>,
  ownerNode: ElementConfigFormNode<TValues>,
  slotProps: Record<string, unknown>,
): VNodeChild {
  if (isConfigFormField(ownerNode))
    return (slot as ElementConfigFormFieldSlot<TValues>)(createFieldSlotContext(ownerNode, slotProps))

  return (slot as ElementConfigFormComponentSlot<TValues>)(createComponentSlotContext(ownerNode, slotProps))
}

function createFieldSlotContext(
  field: ElementConfigFormField<TValues>,
  slotProps: Record<string, unknown>,
): ElementConfigFormFieldSlotContext<TValues> {
  return {
    field,
    model: props.model,
    setValue: value => emitFieldChange({ field: field.field, value }),
    slotProps,
    value: props.model[field.field],
  }
}

function createComponentSlotContext(
  node: ElementConfigFormComponentNode<TValues>,
  slotProps: Record<string, unknown>,
): ElementConfigFormComponentSlotContext<TValues> {
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
