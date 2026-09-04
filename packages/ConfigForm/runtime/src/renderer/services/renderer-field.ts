import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { VNodeChild } from 'vue'
import type {
  ConfigFormComponentRegistration,
  ConfigFormRendererField,
  ConfigFormRuntimeNodeMetadata,
} from '../types'
import type { RendererPipelineContext, RendererSlots } from '../types/internal'
import {
  formatConfigFormReadonlyValue,
  isConfigFormFieldReadonly,
  resolveConfigFormCondition,
  resolveConfigFormReadonlyRender,
} from '@moluoxixi/config-form-headless'
import { camelize, h, toHandlerKey } from 'vue'
import { resolveConfigFormFieldLayout } from '../utils'
import {
  getNodeKey,
  isNonEmptyString,
  mergeAriaTokens,
  toDomId,
} from './rendering'

export function createFieldRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  createNodeSlots: (
    field: ConfigFormRendererField<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
  ) => RendererSlots,
) {
  function renderBoundNode(
    field: ConfigFormRendererField<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    registerElement: boolean,
  ): VNodeChild {
    const { bem, binding, controller, editorBridge, formId, props } = context
    const registration = binding.resolveRegistration(field.component)
    const staticProps = {
      ...registration?.props,
      ...field.props,
      ...controller.resolveReactionProps(field.field),
    }
    const configuredId = staticProps.id
    const controlId = typeof configuredId === 'string' && configuredId
      ? configuredId
      : `${formId}-${toDomId(path)}-control`
    const errorId = `${formId}-${toDomId(path)}-error`
    const reactionState = controller.resolveReactionState(field.field)
    const readonly = resolveConfigFormCondition(props.readonly, controller.model.value, false)
      || (reactionState.readonly ?? isConfigFormFieldReadonly(field, controller.model.value, false))
    const fieldErrors = readonly ? [] : (controller.errors.value[field.field] ?? [])
    const fieldMeta = controller.meta.value.fields[field.field] ?? controller.getFieldMeta(field.field)
    const fieldAttrs = field.fieldAttrs
    const hasLabel = typeof field.label === 'string'
    const labelPosition = props.labelPosition ?? 'left'
    const layout = resolveConfigFormFieldLayout(labelPosition, hasLabel)
    const label = hasLabel
      ? h('label', {
          class: bem('label'),
          for: controlId,
        }, field.label)
      : null
    const metadataAttrs = registerElement ? editorBridge.nodeMetadataAttrs(metadata) : {}

    return h('div', {
      ...fieldAttrs,
      ...metadataAttrs,
      'class': [bem('field'), bem('field', `label-${labelPosition}`), fieldAttrs?.class, metadataAttrs.class],
      'data-dirty': fieldMeta.dirty,
      'data-field': field.field,
      'data-label-position': labelPosition,
      'data-required': reactionState.required ?? resolveConfigFormCondition(field.required, controller.model.value, false),
      'data-touched': fieldMeta.touched,
      'key': getNodeKey(field, path),
      ...(registerElement ? { ref: (element: unknown) => editorBridge.registerNodeElement(metadata, element) } : {}),
      'style': [layout.field, fieldAttrs?.style],
    }, [
      label,
      h('div', {
        class: bem('control'),
        style: layout.control,
      }, [renderControl(field, path, controlId, errorId, readonly, ancestors, registration, metadata)]),
      ...fieldErrors.map((message, index) => h('p', {
        class: bem('error'),
        id: index === 0 ? errorId : undefined,
        key: `${message}-${index}`,
        style: layout.error,
      }, message)),
    ])
  }

  function renderControl(
    field: ConfigFormRendererField<TValues>,
    path: string,
    controlId?: string,
    errorId?: string,
    readonly = false,
    ancestors: ReadonlySet<object> = new Set(),
    registration?: ConfigFormComponentRegistration,
    metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
  ): VNodeChild {
    const { bem, binding, controller, designGuard, flowEvents, props } = context
    if (readonly) {
      const readonlyRender = resolveConfigFormReadonlyRender(field, props.readonlyRender)
      const value = controller.model.value[field.field]
      const content = readonlyRender
        ? readonlyRender({
            componentProps: {
              ...registration?.props,
              ...field.props,
              ...controller.resolveReactionProps(field.field),
            },
            field,
            model: controller.model.value,
            value,
          })
        : formatConfigFormReadonlyValue(value)

      return h('span', {
        'aria-readonly': 'true',
        'class': bem('readonly'),
        'id': controlId,
        'key': `${path}.readonly`,
      }, [content])
    }

    const controlBinding = binding.resolveBinding(field, registration)
    const componentProps: Record<string, unknown> = {
      ...registration?.props,
      ...field.props,
      ...controller.resolveReactionProps(field.field),
      [controlBinding.valueProp]: controller.model.value[field.field],
    }
    const reactionState = controller.resolveReactionState(field.field)
    designGuard.applyDesignInteractionGuard(componentProps)

    if (controlId && !isNonEmptyString(componentProps.id))
      componentProps.id = controlId
    if (reactionState.disabled ?? resolveConfigFormCondition(field.disabled, controller.model.value, false))
      componentProps.disabled = true
    if (reactionState.required ?? resolveConfigFormCondition(field.required, controller.model.value, false))
      componentProps['aria-required'] = true
    if ((controller.errors.value[field.field]?.length ?? 0) > 0) {
      componentProps['aria-invalid'] = true
      if (errorId)
        componentProps['aria-describedby'] = mergeAriaTokens(componentProps['aria-describedby'], errorId)
    }

    const runtimeEvents = flowEvents.runtimeFlowEventMap(field)
    const bindingEventKey = toHandlerKey(camelize(controlBinding.trigger))
    flowEvents.addListener(componentProps, controlBinding.trigger, (...args: unknown[]) => {
      controller.applyFieldChange({
        field: field.field,
        value: field.getValueFromEvent
          ? field.getValueFromEvent(...args)
          : registration?.getValueFromEvent
            ? registration.getValueFromEvent(...args)
            : args[0],
      })
    }, metadata, runtimeEvents.get(bindingEventKey))
    const blurEvent = field.blurTrigger ?? registration?.blurTrigger ?? 'blur'
    const blurEventKey = toHandlerKey(camelize(blurEvent))
    flowEvents.addListener(componentProps, blurEvent, () => {
      controller.setTouched(field.field)
      void controller.validateField(field.field, 'blur')
    }, metadata, runtimeEvents.get(blurEventKey))
    if (metadata) {
      const managedListeners = new Set([bindingEventKey, blurEventKey])
      flowEvents.addRuntimeFlowEventListeners(componentProps, metadata, runtimeEvents, managedListeners)
      flowEvents.wrapComponentListeners(componentProps, metadata, managedListeners, runtimeEvents)
    }

    return h(binding.resolveComponent(registration?.component ?? field.component), {
      ...componentProps,
      key: getNodeKey(field, `${path}.control`),
    }, createNodeSlots(field, path, ancestors))
  }

  return renderBoundNode
}
