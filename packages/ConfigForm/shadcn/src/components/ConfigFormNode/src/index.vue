<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '@moluoxixi/config-form-core'
import type {
  ShadcnConfigFormColProps,
  ShadcnConfigFormComponentNode,
  ShadcnConfigFormComponentSlot,
  ShadcnConfigFormComponentSlotContent,
  ShadcnConfigFormComponentSlotContext,
  ShadcnConfigFormField,
  ShadcnConfigFormFieldSlot,
  ShadcnConfigFormFieldSlotContent,
  ShadcnConfigFormFieldSlotContext,
  ShadcnConfigFormNode,
} from '../../../types'
import type { ConfigFormNodeEmits, ConfigFormNodeProps } from './types'
import type { Component, StyleValue, VNodeChild } from 'vue'
import { defineComponent, h, markRaw } from 'vue'
import ConfigFormFieldItem from '../../ConfigFormField'
import FormComponent from '../../FormComponent'
import { isConfigFormField, isConfigFormNodeVisible } from '@moluoxixi/config-form-core'

defineOptions({
  name: 'ShadcnConfigFormNode',
})

const props = withDefaults(defineProps<ConfigFormNodeProps<TValues>>(), {
  colProps: () => ({}),
  fieldSpan: 24,
  wrapCell: false,
})

const emit = defineEmits<ConfigFormNodeEmits<TValues>>()
const ConfigFormFieldComponent = ConfigFormFieldItem as Component
const FormComponentItem = FormComponent as Component

const ConfigFormNodeRender = defineComponent({
  name: 'ShadcnConfigFormNodeRender',
  setup() {
    /**
     * 递归节点需要动态组装命名 slots，render 函数比模板更能准确表达这层协议。
     */
    return () => renderNode(props.node, props.wrapCell, 'root')
  },
})

function emitFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function renderNode(node: ShadcnConfigFormNode<TValues>, wrapCell: boolean, path: string): VNodeChild {
  if (!isConfigFormNodeVisible(node, props.model))
    return null

  const body = isConfigFormField(node)
    ? renderBoundNode(node, path)
    : renderComponentNode(node, path)

  if (!wrapCell)
    return body

  return h('div', getCellProps(node, path), [body])
}

function renderBoundNode(field: ShadcnConfigFormField<TValues>, path: string): VNodeChild {
  if (typeof field.label !== 'string')
    return renderFormComponentNode(field, path)

  return h(ConfigFormFieldComponent, {
    errors: props.errors,
    field,
    key: `${path}.field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderFormComponentNode(field: ShadcnConfigFormField<TValues>, path: string): VNodeChild {
  return h(FormComponentItem, {
    field,
    key: `${path}.component-field`,
    model: props.model,
    onFieldChange: emitFieldChange,
  }, createNodeSlots(field, path))
}

function renderComponentNode(node: ShadcnConfigFormComponentNode<TValues>, path: string): VNodeChild {
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

function getNodeComponent(node: ShadcnConfigFormComponentNode<TValues>): ShadcnConfigFormComponentNode<TValues>['component'] {
  const component = node.component

  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as ShadcnConfigFormComponentNode<TValues>['component']

  return component
}

function getCellProps(node: ShadcnConfigFormNode<TValues>, path: string): ShadcnConfigFormColProps & { key: string } {
  const span = node.span ?? props.fieldSpan
  const baseStyle = props.colProps.style as StyleValue
  const nodeStyle = node.colProps?.style as StyleValue

  return {
    ...props.colProps,
    ...node.colProps,
    class: [
      'mx-shadcn-config-form__cell',
      props.colProps.class,
      node.colProps?.class,
    ],
    key: path,
    style: [
      baseStyle,
      nodeStyle,
      { gridColumn: `span ${span} / span ${span}` },
    ],
  }
}

function createNodeSlots(
  node: ShadcnConfigFormNode<TValues>,
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
  slot: ShadcnConfigFormComponentSlotContent<TValues> | ShadcnConfigFormFieldSlotContent<TValues>,
  ownerNode: ShadcnConfigFormNode<TValues>,
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
  slot: ShadcnConfigFormComponentSlot<TValues> | ShadcnConfigFormFieldSlot<TValues>,
  ownerNode: ShadcnConfigFormNode<TValues>,
  slotProps: Record<string, unknown>,
): VNodeChild {
  if (isConfigFormField(ownerNode))
    return (slot as ShadcnConfigFormFieldSlot<TValues>)(createFieldSlotContext(ownerNode, slotProps))

  return (slot as ShadcnConfigFormComponentSlot<TValues>)(createComponentSlotContext(ownerNode, slotProps))
}

function createFieldSlotContext(
  field: ShadcnConfigFormField<TValues>,
  slotProps: Record<string, unknown>,
): ShadcnConfigFormFieldSlotContext<TValues> {
  return {
    field,
    model: props.model,
    setValue: value => emitFieldChange({ field: field.field, value }),
    slotProps,
    value: props.model[field.field],
  }
}

function createComponentSlotContext(
  node: ShadcnConfigFormComponentNode<TValues>,
  slotProps: Record<string, unknown>,
): ShadcnConfigFormComponentSlotContext<TValues> {
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
