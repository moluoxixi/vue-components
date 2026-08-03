<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormComponentNode,
  ConfigFormComponentSlotContent,
  ConfigFormComponentSlotContext,
  ConfigFormErrors,
  ConfigFormFieldSlotContent,
  ConfigFormFieldSlotContext,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type {
  ConfigFormControlBinding,
  ConfigFormRendererCellAttrs,
  ConfigFormRendererEmits,
  ConfigFormRendererField,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererNode,
  ConfigFormRendererProps,
} from './types'
import type { Component, ShallowRef, StyleValue, VNodeChild } from 'vue'
import {
  camelize,
  computed,
  defineComponent,
  h,
  markRaw,
  shallowRef,
  toHandlerKey,
  useAttrs,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import {
  createConfigFormController,
  formatConfigFormReadonlyValue,
  isConfigFormField,
  isConfigFormFieldReadonly,
  isConfigFormNodeVisible,
  resolveConfigFormCondition,
  resolveConfigFormReadonlyRender,
} from '@moluoxixi/config-form-headless'

defineOptions({
  name: 'ConfigFormRenderer',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<ConfigFormRendererProps<TValues>>(), {
  cellAttrs: () => ({}),
  columns: 24,
  defaultTrigger: 'update:modelValue',
  defaultValueProp: 'modelValue',
  fieldSpan: 24,
  formAttrs: () => ({}),
  gap: '16px',
  namespace: 'mx-config-form',
  layoutAttrs: () => ({}),
})

const emit = defineEmits<ConfigFormRendererEmits<TValues>>()
const controlledModel = defineModel<TValues>({ required: true })
const model: ShallowRef<TValues> = shallowRef(controlledModel.value)
const attrs = useAttrs()
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const formId = useId()
const errors = shallowRef<ConfigFormErrors>({})
const meta = shallowRef<ConfigFormMeta>({ dirty: false, fields: {}, touched: false })

const controller = createConfigFormController<TValues>({
  defaultValues: props.defaultValues,
  fields: () => props.fields,
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
  },
  onFieldChange: payload => emit('fieldChange', payload),
  onMetaChange: updateMeta,
  onSubmit: values => emit('submit', values),
  readonly: () => props.readonly,
})

const {
  applyFieldChange,
  clearValidate,
  getFieldMeta,
  getErrors,
  getMeta,
  getValidating,
  getValue,
  getValues,
  refreshMeta,
  resetFields,
  setValue,
  setValues,
  setTouched,
  submit,
  validate,
  validateField,
} = controller

meta.value = getMeta()

watch(controlledModel, (values) => {
  if (values !== model.value) {
    model.value = values
    clearValidate()
    refreshMeta()
  }
})

function updateMeta(nextMeta: ConfigFormMeta): void {
  if (equalMeta(meta.value, nextMeta))
    return

  meta.value = nextMeta
  emit('metaChange', nextMeta)
}

const formAttrs = computed<Record<string, unknown>>(() => ({
  ...attrs,
  ...props.formAttrs,
  class: [props.namespace, attrs.class, props.formAttrs.class],
}))

const ConfigFormTree = defineComponent({
  name: 'ConfigFormRendererTree',
  setup: () => () => renderLayout(),
})

function bem(element: string, modifier?: string): string {
  return modifier
    ? `${props.namespace}__${element}--${modifier}`
    : `${props.namespace}__${element}`
}

function renderLayout(): VNodeChild {
  const layoutAttrs = props.layoutAttrs
  const inline = props.inline === true
  const style: StyleValue = [
    layoutAttrs.style,
    inline
      ? {
          alignItems: 'flex-start',
          display: 'flex',
          flexWrap: 'wrap',
          gap: props.gap,
        }
      : {
          display: 'grid',
          gap: props.gap,
          gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
        },
  ]

  return h('div', {
    ...layoutAttrs,
    class: [bem('row'), bem('row', inline ? 'inline' : 'grid'), layoutAttrs.class],
    style,
  }, props.fields.map((node, index) => renderNode(node, !inline, `fields.${index}`, new Set())))
}

function renderNode(
  node: ConfigFormRendererNode<TValues>,
  wrapCell: boolean,
  path: string,
  ancestors: ReadonlySet<object>,
): VNodeChild {
  assertAcyclicNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node)
  if (!isConfigFormNodeVisible(node, model.value))
    return null

  const body = isConfigFormField(node)
    ? renderBoundNode(node, path, nextAncestors)
    : renderComponentNode(node, path, nextAncestors)

  if (!wrapCell)
    return body

  const cellAttrs = props.cellAttrs
  const nodeCellAttrs = node.cellAttrs
  const span = clampSpan(node.span ?? props.fieldSpan)
  const style: StyleValue = [
    cellAttrs.style,
    nodeCellAttrs?.style,
    props.inline
      ? { flex: '0 1 auto', minWidth: 0 }
      : { gridColumn: `span ${span} / span ${span}`, minWidth: 0 },
  ]

  return h('div', {
    ...cellAttrs,
    ...nodeCellAttrs,
    class: [bem('cell'), cellAttrs.class, nodeCellAttrs?.class],
    key: getNodeKey(node, path),
    style,
  }, [body])
}

function renderBoundNode(
  field: ConfigFormRendererField<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
): VNodeChild {
  const configuredId = field.props?.id
  const controlId = typeof configuredId === 'string' && configuredId
    ? configuredId
    : `${formId}-${toDomId(path)}-control`
  const errorId = `${formId}-${toDomId(path)}-error`
  const readonly = isConfigFormFieldReadonly(field, model.value, props.readonly)
  const fieldErrors = readonly ? [] : (errors.value[field.field] ?? [])
  const fieldMeta = meta.value.fields[field.field] ?? getFieldMeta(field.field)
  const fieldAttrs = field.fieldAttrs
  const label = typeof field.label === 'string'
    ? h('label', {
        class: bem('label'),
        for: controlId,
      }, field.label)
    : null

  return h('div', {
    ...fieldAttrs,
    class: [bem('field'), fieldAttrs?.class],
    'data-dirty': fieldMeta.dirty,
    'data-field': field.field,
    'data-required': resolveConfigFormCondition(field.required, model.value, false),
    'data-touched': fieldMeta.touched,
    key: getNodeKey(field, path),
    style: fieldAttrs?.style,
  }, [
    label,
    h('div', { class: bem('control') }, [renderControl(field, path, controlId, errorId, readonly, ancestors)]),
    ...fieldErrors.map((message, index) => h('p', {
      class: bem('error'),
      id: index === 0 ? errorId : undefined,
      key: `${message}-${index}`,
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
): VNodeChild {
  if (readonly) {
    const readonlyRender = resolveConfigFormReadonlyRender(
      field,
      props.readonlyRender,
    )
    const value = model.value[field.field]
    const content = readonlyRender
      ? readonlyRender({
          componentProps: field.props ?? {},
          field,
          model: model.value,
          value,
        })
      : formatConfigFormReadonlyValue(value)

    return h('span', {
      class: bem('readonly'),
      id: controlId,
      key: `${path}.readonly`,
    }, [content])
  }

  const binding = resolveBinding(field)
  const componentProps: Record<string, unknown> = {
    ...field.props,
    [binding.valueProp]: model.value[field.field],
  }

  if (controlId && !isNonEmptyString(componentProps.id))
    componentProps.id = controlId

  if (resolveConfigFormCondition(field.disabled, model.value, false))
    componentProps.disabled = true

  if (resolveConfigFormCondition(field.required, model.value, false))
    componentProps['aria-required'] = true

  if ((errors.value[field.field]?.length ?? 0) > 0) {
    componentProps['aria-invalid'] = true
    if (errorId)
      componentProps['aria-describedby'] = mergeAriaTokens(componentProps['aria-describedby'], errorId)
  }

  addListener(componentProps, binding.trigger, (...args: unknown[]) => {
    applyFieldChange({
      field: field.field,
      value: field.getValueFromEvent ? field.getValueFromEvent(...args) : args[0],
    })
  })
  addListener(componentProps, field.blurTrigger ?? 'blur', () => {
    setTouched(field.field)
    void validateField(field.field, 'blur')
  })

  return h(resolveComponent(field.component), {
    ...componentProps,
    key: getNodeKey(field, `${path}.control`),
  }, createNodeSlots(field, path, ancestors))
}

function renderComponentNode(
  node: ConfigFormComponentNode<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >,
  path: string,
  ancestors: ReadonlySet<object>,
): VNodeChild {
  const slots = createNodeSlots(node, path, ancestors)
  const configuredKey = node.props?.key
  const vnodeKey = isVNodeKey(configuredKey) ? configuredKey : `${path}.component`

  if (typeof node.component === 'string') {
    return h(node.component, {
      ...node.props,
      key: vnodeKey,
    }, slots?.default?.() ?? [])
  }

  return h(resolveComponent(node.component), {
    ...node.props,
    key: vnodeKey,
  }, slots)
}

function createNodeSlots(
  node: ConfigFormRendererNode<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
): Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined {
  return isConfigFormField(node)
    ? createFieldSlots(node, path, ancestors)
    : createComponentSlots(node, path, ancestors)
}

function createFieldSlots(
  field: ConfigFormRendererField<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
): Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined {
  if (!field.slots)
    return undefined

  return Object.fromEntries(
    Object.entries(field.slots).map(([slotName, slot]) => [
      slotName,
      (slotProps: Record<string, unknown> = {}) =>
        renderFieldSlotContent(slot, field, slotProps, `${path}.slots.${slotName}`, ancestors),
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
): Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined {
  if (!node.slots)
    return undefined

  return Object.fromEntries(
    Object.entries(node.slots).map(([slotName, slot]) => [
      slotName,
      (slotProps: Record<string, unknown> = {}) =>
        renderComponentSlotContent(slot, node, slotProps, `${path}.slots.${slotName}`, ancestors),
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
): VNodeChild {
  if (typeof slot === 'function') {
    const context: ConfigFormFieldSlotContext<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    > = {
      field,
      model: model.value,
      meta: getFieldMeta(field.field),
      setValue: value => applyFieldChange({ field: field.field, value }),
      slotProps,
      value: model.value[field.field],
    }
    return slot(context)
  }

  if (Array.isArray(slot))
    return slot.map((node, index) => renderNode(node, false, `${path}.${index}`, ancestors))

  return renderNode(slot, false, path, ancestors)
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
): VNodeChild {
  if (typeof slot === 'function') {
    const context: ConfigFormComponentSlotContext<
      TValues,
      Component | string,
      ConfigFormRendererFieldAttrs,
      ConfigFormRendererCellAttrs
    > = {
      meta: meta.value,
      model: model.value,
      node,
      slotProps,
    }
    return slot(context)
  }

  if (Array.isArray(slot))
    return slot.map((child, index) => renderNode(child, false, `${path}.${index}`, ancestors))

  return renderNode(slot, false, path, ancestors)
}

function resolveBinding(field: ConfigFormRendererField<TValues>): ConfigFormControlBinding {
  const adapterBinding = props.resolveBinding?.(field)
  return {
    trigger: field.trigger ?? adapterBinding?.trigger ?? props.defaultTrigger,
    valueProp: field.valueProp ?? adapterBinding?.valueProp ?? props.defaultValueProp,
  }
}

function resolveComponent<TComponent extends Component | string>(component: TComponent): TComponent {
  if (isObject(component))
    return markRaw(component)
  return component
}

function isObject(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function addListener(
  target: Record<string, unknown>,
  event: string,
  listener: (...args: unknown[]) => void,
): void {
  const key = toHandlerKey(camelize(event))
  const existing = target[key]
  target[key] = typeof existing === 'function'
    ? (...args: unknown[]) => {
        existing(...args)
        listener(...args)
      }
    : listener
}

function mergeAriaTokens(current: unknown, token: string): string {
  const tokens = typeof current === 'string' ? current.split(/\s+/).filter(Boolean) : []
  return [...new Set([...tokens, token])].join(' ')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isVNodeKey(value: unknown): value is string | number | symbol {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol'
}

function clampSpan(span: number): number {
  return Math.max(1, Math.min(props.columns, span))
}

function assertAcyclicNode(node: object, ancestors: ReadonlySet<object>): void {
  if (ancestors.has(node))
    throw new Error('ConfigForm node slots must not contain circular references.')
}

function getNodeKey(node: ConfigFormRendererNode<TValues>, fallback: string): string | number | symbol {
  const configuredKey = node.props?.key
  if (typeof configuredKey === 'string' || typeof configuredKey === 'number' || typeof configuredKey === 'symbol')
    return configuredKey
  return isConfigFormField(node) ? `field:${node.field}` : fallback
}

function toDomId(path: string): string {
  return path.replace(/[^a-z0-9_-]+/gi, '-')
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

function scrollToField(field: keyof TValues & string | string): void {
  const target = Array.from(formRef.value?.querySelectorAll<HTMLElement>('[data-field]') ?? [])
    .find(element => element.dataset.field === field)
  target?.scrollIntoView()
}

defineExpose({
  clearValidate,
  getFieldMeta,
  getErrors,
  getMeta,
  getValidating,
  getValue,
  getValues,
  resetFields,
  scrollToField,
  setValue,
  setValues,
  setTouched,
  submit,
  validate,
  validateField,
})
</script>

<template>
  <form
    ref="formRef"
    v-bind="formAttrs"
    :data-dirty="meta.dirty"
    :data-touched="meta.touched"
    @submit.prevent="submit"
  >
    <ConfigFormTree />

    <slot v-bind="{ meta, model, submit, resetFields }" />
  </form>
</template>
