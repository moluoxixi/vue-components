import type { ConfigFormJsonValue, ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type {
  ConfigFormComponentNode,
  ConfigFormComponentSlotContent,
  ConfigFormComponentSlotContext,
  ConfigFormFieldSlotContent,
  ConfigFormFieldSlotContext,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, VNodeChild } from 'vue'
import type {
  ConfigFormRendererCellAttrs,
  ConfigFormRendererField,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererNode,
} from '../types'
import type { RendererPipelineContext, RendererSlots, RenderNode } from '../types/internal'
import { isConfigFormField } from '@moluoxixi/config-form-headless'

export function createSlotRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  renderNode: RenderNode<TValues>,
): (
  node: ConfigFormRendererNode<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
  scope: ConfigFormScopePath,
) => RendererSlots {
  function createNodeSlots(
    node: ConfigFormRendererNode<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
    scope: ConfigFormScopePath,
  ): RendererSlots {
    return isConfigFormField(node)
      ? createFieldSlots(node, path, ancestors, scope)
      : createComponentSlots(node, path, ancestors, scope)
  }

  function createFieldSlots(
    field: ConfigFormRendererField<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
    scope: ConfigFormScopePath,
  ): RendererSlots {
    if (!field.slots)
      return undefined

    return Object.fromEntries(
      Object.entries(field.slots).map(([slotName, slot]) => [
        slotName,
        (slotProps: Record<string, unknown> = {}) =>
          renderFieldSlotContent(slot, field, slotProps, `${path}.slots.${slotName}`, ancestors, scope, slotName),
      ]),
    )
  }

  function createComponentSlots(
    node: ConfigFormComponentNode<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    >,
    path: string,
    ancestors: ReadonlySet<object>,
    scope: ConfigFormScopePath,
  ): RendererSlots {
    if (!node.slots)
      return undefined

    return Object.fromEntries(
      Object.entries(node.slots).map(([slotName, slot]) => [
        slotName,
        (slotProps: Record<string, unknown> = {}) =>
          renderComponentSlotContent(slot, node, slotProps, `${path}.slots.${slotName}`, ancestors, scope, slotName),
      ]),
    )
  }

  function renderFieldSlotContent(
    slot: ConfigFormFieldSlotContent<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    >,
    field: ConfigFormRendererField<TValues>,
    slotProps: Record<string, unknown>,
    path: string,
    ancestors: ReadonlySet<object>,
    scope: ConfigFormScopePath,
    slotName?: string,
  ): VNodeChild {
    const { controller } = context
    if (typeof slot === 'function') {
      const address = { nodeId: field.id, scope }
      const slotContext: ConfigFormFieldSlotContext<
        TValues,
        Component | string,
        ConfigFormRendererFieldAttrs,
        ConfigFormRendererCellAttrs
      > = {
        field,
        model: controller.model.value,
        meta: controller.getInstanceMeta(address),
        setValue: value => controller.setInstanceValue(address, value as ConfigFormJsonValue),
        slotProps,
        value: controller.getInstanceValue(address),
      }
      return slot(slotContext)
    }

    if (Array.isArray(slot))
      return slot.map((node, index) => renderNode(withInheritedContainerState(node, ancestors), false, `${path}.${index}`, ancestors, scope, slotName))

    return renderNode(withInheritedContainerState(slot, ancestors), false, path, ancestors, scope, slotName)
  }
  function renderComponentSlotContent(
    slot: ConfigFormComponentSlotContent<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    >,
    node: ConfigFormComponentNode<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    >,
    slotProps: Record<string, unknown>,
    path: string,
    ancestors: ReadonlySet<object>,
    scope: ConfigFormScopePath,
    slotName?: string,
  ): VNodeChild {
    if (typeof slot === 'function') {
      const slotContext: ConfigFormComponentSlotContext<
        TValues,
        Component | string,
        ConfigFormRendererFieldAttrs,
        ConfigFormRendererCellAttrs
      > = {
        meta: context.controller.meta.value,
        model: context.controller.model.value,
        node,
        slotProps,
      }
      return slot(slotContext)
    }

    if (Array.isArray(slot))
      return slot.map((child, index) => renderNode(withInheritedContainerState(child, ancestors), false, `${path}.${index}`, ancestors, scope, slotName))

    return renderNode(withInheritedContainerState(slot, ancestors), false, path, ancestors, scope, slotName)
  }

  function resolveContainerCondition<TValues extends ConfigFormValues>(
    condition: unknown,
    values: TValues,
  ): boolean {
    return typeof condition === 'function'
      ? Boolean((condition as (current: TValues) => unknown)(values))
      : condition === true
  }

  function withInheritedContainerState<TValues extends ConfigFormValues>(
    node: ConfigFormRendererNode<TValues>,
    ancestors: ReadonlySet<object>,
  ): ConfigFormRendererNode<TValues> {
    let readonly = false
    let disabled = false
    for (const ancestor of ancestors) {
      const props = (ancestor as { props?: Record<string, unknown> }).props
      readonly ||= resolveContainerCondition(props?.readonly, context.controller.model.value)
      disabled ||= resolveContainerCondition(props?.disabled, context.controller.model.value)
    }
    if (!readonly && !disabled)
      return node

    if (isConfigFormField(node)) {
      return {
        ...node,
        ...(readonly ? { readonly: true } : {}),
        ...(disabled ? { disabled: true } : {}),
      }
    }

    return {
      ...node,
      props: {
        ...node.props,
        ...(readonly ? { readonly: true } : {}),
        ...(disabled ? { disabled: true } : {}),
      },
    }
  }
  return createNodeSlots
}

export function arraySlotColumns<TValues extends ConfigFormValues>(
  node: ConfigFormComponentNode<TValues, Component | string, ConfigFormRendererFieldAttrs, ConfigFormRendererCellAttrs>,
): { key: string, title: string }[] {
  const slot = node.slots?.default
  if (!slot || typeof slot === 'function')
    return [{ key: 'content', title: 'Content' }]
  const children = Array.isArray(slot) ? slot : [slot]
  return children.map((child, index) => ({
    key: child.id ?? `column-${index}`,
    title: isConfigFormField(child)
      ? child.label || child.field
      : typeof child.props?.title === 'string' && child.props.title
        ? child.props.title
        : child.valueScope?.field ?? `Column ${index + 1}`,
  }))
}
