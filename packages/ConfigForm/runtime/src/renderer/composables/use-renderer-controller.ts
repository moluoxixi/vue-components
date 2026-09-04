import type {
  ConfigFormAttrs,
  ConfigFormErrors,
  ConfigFormMeta,
  ConfigFormNode,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, Ref, ShallowRef } from 'vue'
import type { ConfigFormRendererEmits, ConfigFormRendererProps } from '../types'
import type { RendererControllerState } from '../types/internal'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { shallowRef, toRaw, watch } from 'vue'

interface UseRendererControllerOptions<TValues extends ConfigFormValues> {
  controlledModel: Ref<TValues>
  emit: ConfigFormRendererEmits<TValues>
  props: Readonly<ConfigFormRendererProps<TValues>>
}

type ControllerNode<TValues extends ConfigFormValues> = ConfigFormNode<
  TValues,
  Component | string,
  unknown,
  unknown
>

export function useRendererController<TValues extends ConfigFormValues>(
  options: UseRendererControllerOptions<TValues>,
): RendererControllerState<TValues> {
  const { controlledModel, emit, props } = options
  const model: ShallowRef<TValues> = shallowRef(controlledModel.value)
  const errors = shallowRef<ConfigFormErrors>({})
  const meta = shallowRef<ConfigFormMeta>({ dirty: false, fields: {}, touched: false })

  function updateMeta(nextMeta: ConfigFormMeta): void {
    if (equalMeta(meta.value, nextMeta))
      return

    meta.value = nextMeta
    emit('metaChange', nextMeta)
  }

  const controller = createConfigFormController<TValues>({
    defaultValues: props.defaultValues,
    // The headless controller only traverses node semantics; renderer-only
    // attribute and slot callback types are never invoked at this boundary.
    fields: () => props.fields as unknown as ControllerNode<TValues>[],
    model: {
      read: () => model.value,
      write: (values) => {
        model.value = values
        controlledModel.value = values
      },
    },
    onChange: values => emit('change', values),
    onError: formErrors => emit('error', formErrors),
    onErrorsChange: (formErrors) => {
      errors.value = formErrors
      emit('errorsChange', formErrors)
    },
    onFieldChange: payload => emit('fieldChange', payload),
    onMetaChange: updateMeta,
    onSubmit: values => emit('submit', values),
    readonly: () => props.readonly,
  })

  meta.value = controller.getMeta()

  watch(controlledModel, (values) => {
    if (toRaw(values) === toRaw(model.value))
      return

    model.value = values
    controller.clearValidate()
    controller.refreshReactions()
  })

  watch(() => props.fields, controller.refreshReactions, { deep: true })

  watch(() => props.reactionProjection?.validate, (fields) => {
    for (const field of fields ?? [])
      void controller.validateField(field)
  }, { deep: true })

  function resolveReactionProps(field: string): ConfigFormAttrs {
    return {
      ...controller.getReactionProps(field),
      ...props.reactionProjection?.props[field],
    }
  }

  function resolveReactionState(field: string) {
    return {
      ...controller.getReactionState(field),
      ...props.reactionProjection?.states[field],
    }
  }

  return {
    ...controller,
    errors,
    meta,
    model,
    resolveReactionProps,
    resolveReactionState,
  }
}

function equalMeta(left: ConfigFormMeta, right: ConfigFormMeta): boolean {
  const leftFields = Object.keys(left.fields)
  const rightFields = Object.keys(right.fields)
  return left.dirty === right.dirty
    && left.touched === right.touched
    && leftFields.length === rightFields.length
    && leftFields.every((field) => {
      const leftMeta = left.fields[field]
      const rightMeta = right.fields[field]
      return leftMeta?.dirty === rightMeta?.dirty
        && leftMeta?.touched === rightMeta?.touched
    })
}
