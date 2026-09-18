import type { ConfigFormJsonValue, ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type { ConfigFormFieldAddress, ConfigFormValues } from '@moluoxixi/config-form-headless'
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
    scope: ConfigFormScopePath,
  ) => RendererSlots,
) {
  function renderBoundNode(
    field: ConfigFormRendererField<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    registerElement: boolean,
    scope: ConfigFormScopePath,
  ): VNodeChild {
    const { bem, binding, controller, editorBridge, formId, props } = context
    const address = fieldAddress(field, scope)
    const registration = binding.resolveRegistration(field.component)
    const staticProps = {
      ...registration?.props,
      ...field.props,
      ...controller.resolveInstanceReactionProps(address, field.field),
    }
    const configuredId = staticProps.id
    const controlId = typeof configuredId === 'string' && configuredId
      ? configuredId
      : `${formId}-${toDomId(path)}-control`
    const errorId = `${formId}-${toDomId(path)}-error`
    const reactionState = controller.resolveInstanceReactionState(address, field.field)
    const readonly = resolveConfigFormCondition(props.readonly, controller.model.value, false)
      || (reactionState.readonly ?? isConfigFormFieldReadonly(field, controller.model.value, false))
    const fieldErrors = readonly ? [] : controller.getInstanceErrors(address)
    const fieldMeta = controller.getInstanceMeta(address)
    const fieldAttrs = field.fieldAttrs
    const hasLabel = typeof field.label === 'string'
    const labelPosition = props.labelPosition ?? 'left'
    const layout = resolveConfigFormFieldLayout(labelPosition, hasLabel)
    const label = hasLabel
      ? h('label', {
          'class': bem('label'),
          'data-config-form-label': '',
          'for': controlId,
        }, field.label)
      : null
    const metadataAttrs = registerElement ? editorBridge.nodeMetadataAttrs(metadata) : {}

    return h('div', {
      ...fieldAttrs,
      ...metadataAttrs,
      'class': [bem('field'), bem('field', `label-${labelPosition}`), fieldAttrs?.class, metadataAttrs.class],
      'data-dirty': fieldMeta.dirty,
      'data-field': field.field,
      'data-instance-key': controller.getInstanceKey(address),
      'data-label-position': labelPosition,
      'data-required': reactionState.required ?? resolveConfigFormCondition(field.required, controller.model.value, false),
      'data-touched': fieldMeta.touched,
      'data-validating': controller.isInstanceValidating(address),
      'key': getNodeKey(field, path),
      ...(registerElement ? { ref: (element: unknown) => editorBridge.registerNodeElement(metadata, element) } : {}),
      'style': [layout.field, fieldAttrs?.style],
    }, [
      label,
      h('div', {
        'class': bem('control'),
        'data-config-form-control': '',
        'style': layout.control,
      }, [renderControl(field, path, controlId, errorId, readonly, ancestors, registration, address, fieldErrors)]),
      ...fieldErrors.map((message, index) => h('p', {
        'class': bem('error'),
        'data-config-form-error': '',
        'id': index === 0 ? errorId : undefined,
        'key': `${message}-${index}`,
        'style': layout.error,
      }, message)),
    ])
  }

  function renderControl(
    field: ConfigFormRendererField<TValues>,
    path: string,
    controlId: string | undefined,
    errorId: string | undefined,
    readonly: boolean,
    ancestors: ReadonlySet<object>,
    registration: ConfigFormComponentRegistration | undefined,
    address: ConfigFormFieldAddress,
    fieldErrors: readonly string[],
  ): VNodeChild {
    const { bem, binding, componentListeners, controller, designGuard, props } = context
    const optionState = context.getOptionState(address)
    const optionProps = optionState === undefined
      ? {}
      : {
          options: optionState.options,
          loading: optionState.status === 'loading',
          optionState,
        }
    if (readonly) {
      const readonlyRender = resolveConfigFormReadonlyRender(field, props.readonlyRender)
      const value = controller.getInstanceValue(address)
      const content = readonlyRender
        ? readonlyRender({
            componentProps: {
              ...registration?.props,
              ...field.props,
              ...controller.resolveInstanceReactionProps(address, field.field),
              ...optionProps,
            },
            field,
            model: controller.model.value,
            value,
          })
        : formatConfigFormReadonlyValue(value)

      return h('span', {
        'aria-readonly': 'true',
        'class': bem('readonly'),
        'data-config-form-readonly': '',
        'id': controlId,
        'key': `${path}.readonly`,
      }, [content])
    }

    const controlBinding = binding.resolveBinding(field, registration)
    const componentProps: Record<string, unknown> = {
      ...registration?.props,
      ...field.props,
      ...controller.resolveInstanceReactionProps(address, field.field),
      ...optionProps,
      [controlBinding.valueProp]: controller.getInstanceValue(address),
    }
    const reactionState = controller.resolveInstanceReactionState(address, field.field)
    designGuard.applyDesignInteractionGuard(componentProps)

    if (controlId && !isNonEmptyString(componentProps.id))
      componentProps.id = controlId
    if (reactionState.disabled ?? resolveConfigFormCondition(field.disabled, controller.model.value, false))
      componentProps.disabled = true
    if (reactionState.required ?? resolveConfigFormCondition(field.required, controller.model.value, false))
      componentProps['aria-required'] = true
    if (fieldErrors.length > 0) {
      componentProps['aria-invalid'] = true
      if (errorId)
        componentProps['aria-describedby'] = mergeAriaTokens(componentProps['aria-describedby'], errorId)
    }

    const bindingEventKey = toHandlerKey(camelize(controlBinding.trigger))
    componentListeners.addListener(componentProps, controlBinding.trigger, (...args: unknown[]) => {
      controller.applyFieldInstanceChange({
        address,
        value: (field.getValueFromEvent
          ? field.getValueFromEvent(...args)
          : registration?.getValueFromEvent
            ? registration.getValueFromEvent(...args)
            : args[0]) as ConfigFormJsonValue,
      })
    })
    const blurEvent = field.blurTrigger ?? registration?.blurTrigger ?? 'blur'
    const blurEventKey = toHandlerKey(camelize(blurEvent))
    componentListeners.addListener(componentProps, blurEvent, () => {
      controller.setInstanceTouched(address)
      void controller.validateInstance(address, 'blur')
    })
    componentListeners.wrapComponentListeners(componentProps, new Set([bindingEventKey, blurEventKey]))

    return h(binding.resolveComponent(registration?.component ?? field.component), {
      ...componentProps,
      key: getNodeKey(field, `${path}.control`),
    }, createNodeSlots(field, path, ancestors, address.scope))
  }

  return renderBoundNode
}

function fieldAddress<TValues extends ConfigFormValues>(
  field: ConfigFormRendererField<TValues>,
  scope: ConfigFormScopePath,
): ConfigFormFieldAddress {
  return {
    nodeId: field.id,
    scope: scope.map(entry => ({ ...entry })),
  }
}
