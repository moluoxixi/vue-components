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
) => RendererSlots {
  function createNodeSlots(
    node: ConfigFormRendererNode<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
  ): RendererSlots {
    return isConfigFormField(node)
      ? createFieldSlots(node, path, ancestors)
      : createComponentSlots(node, path, ancestors)
  }

  function createFieldSlots(
    field: ConfigFormRendererField<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
  ): RendererSlots {
    if (!field.slots)
      return undefined

    return Object.fromEntries(
      Object.entries(field.slots).map(([slotName, slot]) => [
        slotName,
        (slotProps: Record<string, unknown> = {}) =>
          renderFieldSlotContent(slot, field, slotProps, `${path}.slots.${slotName}`, ancestors, slotName),
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
  ): RendererSlots {
    if (!node.slots)
      return undefined

    return Object.fromEntries(
      Object.entries(node.slots).map(([slotName, slot]) => [
        slotName,
        (slotProps: Record<string, unknown> = {}) =>
          renderComponentSlotContent(slot, node, slotProps, `${path}.slots.${slotName}`, ancestors, slotName),
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
    slotName?: string,
  ): VNodeChild {
    const { controller } = context
    if (typeof slot === 'function') {
      const slotContext: ConfigFormFieldSlotContext<
        TValues,
        Component | string,
        ConfigFormRendererFieldAttrs,
        ConfigFormRendererCellAttrs
      > = {
        field,
        model: controller.model.value,
        meta: controller.getFieldMeta(field.field),
        setValue: value => controller.applyFieldChange({ field: field.field, value }),
        slotProps,
        value: controller.model.value[field.field],
      }
      return slot(slotContext)
    }

    if (Array.isArray(slot))
      return slot.map((node, index) => renderNode(node, false, `${path}.${index}`, ancestors, slotName))

    return renderNode(slot, false, path, ancestors, slotName)
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
      return slot.map((child, index) => renderNode(child, false, `${path}.${index}`, ancestors, slotName))

    return renderNode(slot, false, path, ancestors, slotName)
  }

  return createNodeSlots
}
