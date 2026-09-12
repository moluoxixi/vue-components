import type { ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type {
  ConfigFormAttrs,
  ConfigFormController,
  ConfigFormControllerDiagnostic,
  ConfigFormErrors,
  ConfigFormLifecycleHook,
  ConfigFormMeta,
  ConfigFormNode,
  ConfigFormReactionProjection,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormRendererEmits, ConfigFormRendererProps } from '../types'
import type { RendererControllerState } from '../types/internal'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'

interface UseRendererControllerOptions<TValues extends ConfigFormValues> {
  emit: ConfigFormRendererEmits<TValues>
  props: Readonly<ConfigFormRendererProps<TValues>>
  reactionProjection?: () => ConfigFormReactionProjection<TValues> | undefined
  onLifecycle?: ConfigFormLifecycleHook<TValues>
  shouldRunLifecycle?: (kind: Parameters<ConfigFormLifecycleHook<TValues>>[0]) => boolean
  onDiagnostic?: (diagnostic: ConfigFormControllerDiagnostic) => void
  onScopeInvalidated?: (scope: ConfigFormScopePath) => void
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
  const { emit, props } = options
  const projection = () => options.reactionProjection?.() ?? props.reactionProjection
  const model = computed<TValues>({
    get: () => props.model.read(),
    set: values => props.model.write(values),
  })
  let writingModel = false
  let observedValues: TValues | undefined
  let controller!: ConfigFormController<TValues>
  const errors = shallowRef<ConfigFormErrors>({})
  const meta = shallowRef<ConfigFormMeta>({ dirty: false, fields: {}, touched: false })
  const validatingRevision = shallowRef(0)
  let observedScopes = new Map<string, ConfigFormScopePath>()

  function updateMeta(nextMeta: ConfigFormMeta): void {
    if (equalMeta(meta.value, nextMeta))
      return

    meta.value = nextMeta
    emit('metaChange', nextMeta)
  }

  controller = createConfigFormController<TValues>({
    valueSchema: props.plan?.valueSchema,
    defaultValues: props.defaultValues,
    // The headless controller only traverses node semantics; renderer-only
    // attribute and slot callback types are never invoked at this boundary.
    fields: () => props.fields as unknown as ControllerNode<TValues>[],
    model: {
      read: () => props.model.read(),
      write: (values) => {
        writingModel = true
        try {
          props.model.write(values)
        }
        finally {
          writingModel = false
        }
      },
    },
    onChange: (values) => {
      reconcileScopes()
      observedValues = controller.getValues()
      emit('change', values)
    },
    onDiagnostic: options.onDiagnostic,
    onError: formErrors => emit('error', formErrors),
    onErrorsChange: (formErrors) => {
      errors.value = formErrors
      emit('errorsChange', formErrors)
    },
    onFieldChange: payload => emit('fieldChange', payload),
    onLifecycle: options.onLifecycle,
    onMetaChange: updateMeta,
    onSubmit: values => emit('submit', values),
    onValidatingChange: () => { validatingRevision.value += 1 },
    readonly: () => props.readonly,
    shouldRunLifecycle: options.shouldRunLifecycle,
    reactionStates: () => projection()?.states,
  })

  observedValues = controller.getValues()
  meta.value = controller.getMeta()
  observedScopes = readScopes()

  watch(model, () => {
    if (writingModel)
      return
    const previousValues = observedValues ?? controller.getValues()
    controller.clearValidate()
    controller.refreshReactions()
    reconcileScopes()
    const currentValues = controller.getValues()
    observedValues = currentValues
    void controller.runLifecycle('form.valuesChange', {
      previousValues,
      values: currentValues,
    })
  }, { deep: true, flush: 'sync' })

  watch([() => props.plan?.valueSchema, () => props.fields], () => {
    controller.updateValueSchema(props.plan?.valueSchema)
    controller.refreshReactions()
    reconcileScopes()
    observedValues = controller.getValues()
  }, { deep: true, flush: 'sync' })
  const validationStateKey = computed(() => {
    const states = projection()?.states ?? {}
    return JSON.stringify(Object.keys(states).sort().map(field => [
      field,
      Object.entries(states[field] ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ]))
  })
  watch([() => props.readonly, validationStateKey], () => {
    controller.clearValidate()
    controller.refreshReactions()
  }, { deep: true, flush: 'sync' })
  onBeforeUnmount(() => controller.clearValidate())

  watch(() => projection()?.validate, (fields) => {
    for (const field of fields ?? [])
      void controller.validateField(field)
  }, { deep: true })

  function resolveReactionProps(field: string): ConfigFormAttrs {
    return {
      ...controller.getReactionProps(field),
      ...projection()?.props[field],
    }
  }

  function resolveReactionState(field: string) {
    return {
      ...controller.getReactionState(field),
      ...projection()?.states[field],
    }
  }

  function resolveInstanceProjection<T>(
    source: Record<string, T> | undefined,
    address: { nodeId: string, scope: ConfigFormScopePath },
    field: string,
  ): T | undefined {
    if (!source)
      return undefined
    const instanceKey = controller.getInstanceKey(address)
    if (source[instanceKey] !== undefined)
      return source[instanceKey]
    if (source[address.nodeId] !== undefined)
      return source[address.nodeId]
    const instance = controller.listFieldInstances(address.nodeId)
      .find(item => item.instanceKey === instanceKey)
    return instance?.ownerScopeId === undefined ? source[field] : undefined
  }

  function resolveInstanceReactionProps(
    address: { nodeId: string, scope: ConfigFormScopePath },
    field: string,
  ): ConfigFormAttrs {
    return {
      ...controller.getInstanceReactionProps(address),
      ...resolveInstanceProjection(projection()?.props, address, field),
    }
  }

  function resolveInstanceReactionState(
    address: { nodeId: string, scope: ConfigFormScopePath },
    field: string,
  ) {
    return {
      ...controller.getInstanceReactionState(address),
      ...resolveInstanceProjection(projection()?.states, address, field),
    }
  }

  function readScopes(): Map<string, ConfigFormScopePath> {
    const scopes = new Map<string, ConfigFormScopePath>()
    controller.listFieldInstances().forEach(({ address }) => {
      if (address.scope.length > 0)
        scopes.set(JSON.stringify(address.scope), address.scope.map(entry => ({ ...entry })))
    })
    return scopes
  }

  function reconcileScopes(): void {
    const next = readScopes()
    observedScopes.forEach((scope, key) => {
      if (!next.has(key))
        options.onScopeInvalidated?.(scope)
    })
    observedScopes = next
  }

  return {
    ...controller,
    errors,
    getInstanceErrors: (address) => {
      // Headless snapshots stay framework-neutral; subscribe at the Vue boundary.
      void errors.value
      return controller.getInstanceErrors(address)
    },
    getInstanceMeta: (address) => {
      void meta.value
      return controller.getInstanceMeta(address)
    },
    getValidating: () => {
      void validatingRevision.value
      return controller.getValidating()
    },
    isFieldValidating: (field) => {
      void validatingRevision.value
      return controller.isFieldValidating(field)
    },
    isInstanceValidating: (address) => {
      void validatingRevision.value
      return controller.isInstanceValidating(address)
    },
    meta,
    model,
    resolveInstanceReactionProps,
    resolveInstanceReactionState,
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
