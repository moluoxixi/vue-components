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
  ConfigFormComponentRegistration,
  ConfigFormControlBinding,
  ConfigFormRendererCellAttrs,
  ConfigFormRendererEmits,
  ConfigFormRendererField,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererNode,
  ConfigFormRendererProps,
  ConfigFormRenderMode,
  ConfigFormRuntimeEditorBridge,
  ConfigFormRuntimeEventContext,
  ConfigFormRuntimeNodeMetadata,
} from './types'
import type { Component, ShallowRef, StyleValue, VNodeChild } from 'vue'
import {
  camelize,
  computed,
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toHandlerKey,
  toRaw,
  useAttrs,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import {
  createConfigFormController,
  formatConfigFormReadonlyValue,
  isConfigFormComponentRegistration,
  isConfigFormField,
  isConfigFormFieldReadonly,
  isConfigFormNodeVisible,
  resolveConfigFormCondition,
  resolveConfigFormReadonlyRender,
} from '@moluoxixi/config-form-headless'
import { resolveConfigFormFieldLayout } from './layout'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from './responsive'

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
  labelPosition: 'left',
  mode: 'preview',
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
const registeredNodes = new Map<string, {
  metadata: ConfigFormRuntimeNodeMetadata<TValues>
  cleanup?: () => void
  element?: HTMLElement
}>()
let registeredEditor: ConfigFormRuntimeEditorBridge<TValues> | undefined
let designInteractionObserver: MutationObserver | undefined
const designTabIndex = new Map<HTMLElement, string | null>()

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
  getReactionProps,
  getReactionState,
  getValidating,
  getValue,
  getValues,
  refreshReactions,
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
  if (toRaw(values) === toRaw(model.value))
    return

  model.value = values
  clearValidate()
  refreshReactions()
})

watch(() => props.fields, refreshReactions, { deep: true })

watch(() => props.mode, (mode) => {
  if (mode === 'design')
    startDesignInteractionGuard()
  else {
    designInteractionObserver?.disconnect()
    designInteractionObserver = undefined
    restoreDesignTabIndex()
  }
}, { flush: 'post' })

watch(() => props.reactionProjection?.validate, (fields) => {
  for (const field of fields ?? [])
    void validateField(field)
}, { deep: true })

function resolveReactionProps(field: string): Record<string, unknown> {
  return {
    ...getReactionProps(field),
    ...props.reactionProjection?.props[field],
  }
}

function resolveReactionState(field: string) {
  return {
    ...getReactionState(field),
    ...props.reactionProjection?.states[field],
  }
}

/**
 * Design renders the real Runtime tree as a visual surface. The editor owns
 * hit testing and focus, so third-party controls must not re-enable native
 * interaction through their own root attributes or internal defaults.
 */
function applyDesignInteractionGuard(target: Record<string, unknown>): void {
  if (props.mode !== 'design')
    return

  target.tabindex = -1
  target['data-config-runtime-control'] = ''
}

function restoreDesignTabIndex(): void {
  for (const [element, tabIndex] of designTabIndex) {
    if (!element.isConnected)
      continue
    if (tabIndex === null)
      element.removeAttribute('tabindex')
    else
      element.setAttribute('tabindex', tabIndex)
  }
  designTabIndex.clear()
}

function syncDesignInteractionGuard(): void {
  const form = formRef.value
  if (props.mode !== 'design' || !form?.hasAttribute('inert')) {
    restoreDesignTabIndex()
    return
  }

  const selector = [
    'input',
    'textarea',
    'select',
    'button',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="radio"]',
    '[role="slider"]',
    '[role="switch"]',
    '[tabindex]',
  ].join(',')
  for (const element of form.querySelectorAll<HTMLElement>(selector)) {
    if (!designTabIndex.has(element))
      designTabIndex.set(element, element.getAttribute('tabindex'))
    element.setAttribute('tabindex', '-1')
  }
}

function startDesignInteractionGuard(): void {
  if (props.mode !== 'design' || typeof MutationObserver === 'undefined' || !formRef.value)
    return
  syncDesignInteractionGuard()
  designInteractionObserver?.disconnect()
  designInteractionObserver = new MutationObserver(syncDesignInteractionGuard)
  designInteractionObserver.observe(formRef.value, {
    attributes: true,
    attributeFilter: ['inert'],
    childList: true,
    subtree: true,
  })
}

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

const responsiveLayouts = computed(() => ({
  desktop: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'desktop'),
  tablet: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'tablet'),
  mobile: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'mobile'),
}))

// Design and Preview can render a fixed artboard inside a desktop viewport.
// Keep the selected presentation breakpoint transient so the same Runtime
// layout is used regardless of the host window's media-query state.
const activePresentationLayout = computed(() => (
  props.breakpoint ? responsiveLayouts.value[props.breakpoint] : undefined
))

function ensureEditorBridge(): ConfigFormRuntimeEditorBridge<TValues> | undefined {
  const editor = props.editor
  if (editor === registeredEditor)
    return editor

  for (const registration of registeredNodes.values()) {
    if (registration.cleanup)
      registration.cleanup()
    else if (registeredEditor?.unregisterNode)
      registeredEditor.unregisterNode(registration.metadata, registration.element)
  }
  registeredNodes.clear()
  registeredEditor = editor
  return editor
}

function resolveNodeId(node: ConfigFormRendererNode<TValues>, path: string): string {
  const custom = ensureEditorBridge()?.getNodeId?.(node, path)
  if (isNonEmptyString(custom))
    return custom

  const configured = node.id
  if (isNonEmptyString(configured))
    return configured

  const extensions = node.extensions
  if (extensions && typeof extensions === 'object') {
    const extensionRecord = extensions as Record<string, unknown>
    const extensionId = extensionRecord.nodeId
      ?? extensionRecord['node-id']
      ?? (isObject(extensionRecord.designer) ? (extensionRecord.designer as Record<string, unknown>).nodeId : undefined)
    if (isNonEmptyString(extensionId))
      return extensionId
  }

  if (isConfigFormField(node) && isNonEmptyString(node.field))
    return node.field

  return path
}

function createNodeMetadata(
  node: ConfigFormRendererNode<TValues>,
  path: string,
  slot?: string,
): ConfigFormRuntimeNodeMetadata<TValues> {
  const nodeId = resolveNodeId(node, path)
  const metadata: ConfigFormRuntimeNodeMetadata<TValues> = {
    component: node.component,
    id: nodeId,
    kind: isConfigFormField(node) ? 'field' : 'component',
    mode: props.mode as ConfigFormRenderMode,
    node,
    nodeId,
    path,
    slot,
  }
  const state = ensureEditorBridge()?.readState?.(metadata)
  if (state !== undefined)
    metadata.state = state
  return metadata
}

function nodeMetadataAttrs(metadata: ConfigFormRuntimeNodeMetadata<TValues>): Record<string, unknown> {
  const editorAttrs = props.mode === 'design'
    ? ensureEditorBridge()?.getNodeAttrs?.(metadata) ?? {}
    : {}
  return {
    ...editorAttrs,
    'data-config-node-id': metadata.nodeId,
    'data-config-node-kind': metadata.kind,
    'data-config-path': metadata.path,
    'data-config-slot': metadata.slot,
    // Designer adapters historically query data-node-id. Keep that alias in
    // design mode while the config-prefixed attributes remain canonical.
    'data-node-id': props.mode === 'design' ? metadata.nodeId : undefined,
  }
}

function registerNodeElement(metadata: ConfigFormRuntimeNodeMetadata<TValues>, element: unknown): void {
  const editor = ensureEditorBridge()
  if (!editor?.registerNode)
    return

  const candidate = typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
    ? element
    : isObject(element) && '$el' in element
      ? (element as { $el?: unknown }).$el
      : undefined
  const htmlElement = typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement
    ? candidate
    : undefined
  const key = `${metadata.path}:${metadata.nodeId}`
  if (!htmlElement) {
    const registration = registeredNodes.get(key)
    if (!registration)
      return
    if (registration.cleanup)
      registration.cleanup()
    else
      editor.unregisterNode?.(registration.metadata, registration.element)
    registeredNodes.delete(key)
    return
  }

  const current = registeredNodes.get(key)
  if (current?.element === htmlElement)
    return
  if (current?.cleanup)
    current.cleanup()
  else if (current)
    editor.unregisterNode?.(current.metadata, current.element)

  const cleanup = editor.registerNode(metadata, htmlElement)
  registeredNodes.set(key, {
    cleanup: typeof cleanup === 'function' ? cleanup : undefined,
    element: htmlElement,
    metadata,
  })
}

function shouldInterceptEditorEvent(
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  event: string,
  args: unknown[],
): boolean {
  if (props.mode !== 'design')
    return false

  const editor = ensureEditorBridge()
  const context: ConfigFormRuntimeEventContext<TValues> = {
    args,
    event,
    metadata,
    mode: metadata.mode,
    node: metadata.node,
    nodeId: metadata.nodeId,
    path: metadata.path,
    slot: metadata.slot,
  }
  const decision = editor?.interceptEvent?.(context) ?? editor?.onEvent?.(context)
  // Design mode is intentionally inert by default. An editor may explicitly
  // return false for controls that it wants to keep interactive.
  return decision !== false
}

function emitRuntimeEvent(
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  event: string,
  args: unknown[],
): void {
  if (props.mode !== 'preview')
    return
  emit('runtimeEvent', {
    args,
    event,
    metadata,
    mode: metadata.mode,
    node: metadata.node,
    nodeId: metadata.nodeId,
    path: metadata.path,
    slot: metadata.slot,
  })
}

function editorEventListener(
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  event: string,
  listener: (...args: unknown[]) => void,
  runtimeEvent?: string,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    if (shouldInterceptEditorEvent(metadata, event, args))
      return
    listener(...args)
    // Emit after the component listener so model-bound events expose the
    // latest Runtime values to Flow dispatchers.
    if (runtimeEvent)
      emitRuntimeEvent(metadata, runtimeEvent, args)
  }
}

function wrapComponentListeners(
  target: Record<string, unknown>,
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  skipKeys: ReadonlySet<string> = new Set(),
  runtimeEvents: ReadonlyMap<string, string> = new Map(),
): void {
  if (props.mode !== 'design' && props.mode !== 'preview')
    return

  for (const key of Object.keys(target)) {
    if (!/^on[A-Z]/.test(key))
      continue
    if (skipKeys.has(key))
      continue
    const value = target[key]
    const runtimeEvent = runtimeEvents.get(key)
    if (props.mode === 'preview' && !runtimeEvent)
      continue
    const event = runtimeEvent ?? eventNameFromHandlerKey(key)
    if (typeof value === 'function') {
      target[key] = editorEventListener(metadata, event, value as (...args: unknown[]) => void, runtimeEvent)
    }
    else if (Array.isArray(value)) {
      const listeners = value.filter((listener): listener is (...args: unknown[]) => void => typeof listener === 'function')
      target[key] = editorEventListener(metadata, event, (...args: unknown[]) => {
        for (const listener of listeners)
          listener(...args)
      }, runtimeEvent)
    }
  }
}

onBeforeUnmount(() => {
  for (const registration of registeredNodes.values()) {
    if (registration.cleanup)
      registration.cleanup()
    else
      registeredEditor?.unregisterNode?.(registration.metadata, registration.element)
  }
  registeredNodes.clear()
})

function bem(element: string, modifier?: string): string {
  return modifier
    ? `${props.namespace}__${element}--${modifier}`
    : `${props.namespace}__${element}`
}

function renderLayout(): VNodeChild {
  const layoutAttrs = props.layoutAttrs
  const inline = props.inline === true
  const layouts = responsiveLayouts.value
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
          '--mx-config-form-columns-desktop': layouts.desktop.columns,
          '--mx-config-form-columns-mobile': layouts.mobile.columns,
          '--mx-config-form-columns-tablet': layouts.tablet.columns,
          ...(activePresentationLayout.value
            ? { '--mx-config-form-active-columns': activePresentationLayout.value.columns }
            : {}),
          display: 'grid',
          gap: props.gap,
          gridTemplateColumns: 'repeat(var(--mx-config-form-active-columns), minmax(0, 1fr))',
        },
  ]

  return h('div', {
    ...layoutAttrs,
    class: [bem('row'), bem('row', inline ? 'inline' : 'grid'), layoutAttrs.class],
    'data-config-form-responsive-layout': inline ? undefined : '',
    style,
  }, props.fields.map((node, index) => renderNode(node, !inline, `fields.${index}`, new Set())))
}

function renderNode(
  node: ConfigFormRendererNode<TValues>,
  wrapCell: boolean,
  path: string,
  ancestors: ReadonlySet<object>,
  slot?: string,
): VNodeChild {
  assertAcyclicNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node)
  const reactionState = isConfigFormField(node) ? resolveReactionState(node.field) : undefined
  const visible = reactionState?.visible ?? isConfigFormNodeVisible(node, model.value)
  if (!visible)
    return null

  const metadata = createNodeMetadata(node, path, slot)

  const body = isConfigFormField(node)
    ? renderBoundNode(node, path, nextAncestors, metadata, !wrapCell)
    : renderComponentNode(node, path, nextAncestors, metadata, !wrapCell)

  if (!wrapCell)
    return body

  const cellAttrs = props.cellAttrs
  const nodeCellAttrs = node.cellAttrs
  const layouts = responsiveLayouts.value
  const desktopSpan = resolveConfigFormNodeSpan(node.span, layouts.desktop)
  const tabletSpan = resolveConfigFormNodeSpan(node.span, layouts.tablet)
  const mobileSpan = resolveConfigFormNodeSpan(node.span, layouts.mobile)
  const style: StyleValue = [
    cellAttrs.style,
    nodeCellAttrs?.style,
    props.inline
      ? { flex: '0 1 auto', minWidth: 0 }
      : {
          '--mx-config-form-span-desktop': desktopSpan,
          '--mx-config-form-span-mobile': mobileSpan,
          '--mx-config-form-span-tablet': tabletSpan,
          ...(activePresentationLayout.value
            ? { '--mx-config-form-active-span': resolveConfigFormNodeSpan(node.span, activePresentationLayout.value) }
            : {}),
          gridColumn: 'span var(--mx-config-form-active-span) / span var(--mx-config-form-active-span)',
          minWidth: 0,
        },
  ]
  const metadataAttrs = nodeMetadataAttrs(metadata)

  return h('div', {
    ...cellAttrs,
    ...nodeCellAttrs,
    ...metadataAttrs,
    class: [bem('cell'), cellAttrs.class, nodeCellAttrs?.class, metadataAttrs.class],
    'data-config-form-responsive-cell': '',
    key: getNodeKey(node, path),
    ref: (element: unknown) => registerNodeElement(metadata, element),
    style,
  }, [body])
}

function renderBoundNode(
  field: ConfigFormRendererField<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  registerElement: boolean,
): VNodeChild {
  const registration = resolveRegistration(field.component)
  const staticProps = {
    ...registration?.props,
    ...field.props,
    ...resolveReactionProps(field.field),
  }
  const configuredId = staticProps.id
  const controlId = typeof configuredId === 'string' && configuredId
    ? configuredId
    : `${formId}-${toDomId(path)}-control`
  const errorId = `${formId}-${toDomId(path)}-error`
  const reactionState = resolveReactionState(field.field)
  const readonly = resolveConfigFormCondition(props.readonly, model.value, false)
    || (reactionState.readonly ?? isConfigFormFieldReadonly(field, model.value, false))
  const fieldErrors = readonly ? [] : (errors.value[field.field] ?? [])
  const fieldMeta = meta.value.fields[field.field] ?? getFieldMeta(field.field)
  const fieldAttrs = field.fieldAttrs
  const hasLabel = typeof field.label === 'string'
  const layout = resolveConfigFormFieldLayout(props.labelPosition, hasLabel)
  const label = hasLabel
    ? h('label', {
        class: bem('label'),
        for: controlId,
      }, field.label)
    : null
  const metadataAttrs = registerElement ? nodeMetadataAttrs(metadata) : {}

  return h('div', {
    ...fieldAttrs,
    ...metadataAttrs,
    class: [bem('field'), bem('field', `label-${props.labelPosition}`), fieldAttrs?.class, metadataAttrs.class],
    'data-dirty': fieldMeta.dirty,
    'data-field': field.field,
    'data-label-position': props.labelPosition,
    'data-required': reactionState.required ?? resolveConfigFormCondition(field.required, model.value, false),
    'data-touched': fieldMeta.touched,
    key: getNodeKey(field, path),
    ...(registerElement ? { ref: (element: unknown) => registerNodeElement(metadata, element) } : {}),
    style: [layout.field, fieldAttrs?.style],
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
  if (readonly) {
    const readonlyRender = resolveConfigFormReadonlyRender(
      field,
      props.readonlyRender,
    )
    const value = model.value[field.field]
    const content = readonlyRender
      ? readonlyRender({
          componentProps: {
            ...registration?.props,
            ...field.props,
            ...resolveReactionProps(field.field),
          },
          field,
          model: model.value,
          value,
        })
      : formatConfigFormReadonlyValue(value)

    return h('span', {
      'aria-readonly': 'true',
      class: bem('readonly'),
      id: controlId,
      key: `${path}.readonly`,
    }, [content])
  }

  const binding = resolveBinding(field, registration)
  const componentProps: Record<string, unknown> = {
    ...registration?.props,
    ...field.props,
    ...resolveReactionProps(field.field),
    [binding.valueProp]: model.value[field.field],
  }
  const reactionState = resolveReactionState(field.field)

  applyDesignInteractionGuard(componentProps)

  if (controlId && !isNonEmptyString(componentProps.id))
    componentProps.id = controlId

  if (reactionState.disabled ?? resolveConfigFormCondition(field.disabled, model.value, false))
    componentProps.disabled = true

  if (reactionState.required ?? resolveConfigFormCondition(field.required, model.value, false))
    componentProps['aria-required'] = true

  if ((errors.value[field.field]?.length ?? 0) > 0) {
    componentProps['aria-invalid'] = true
    if (errorId)
      componentProps['aria-describedby'] = mergeAriaTokens(componentProps['aria-describedby'], errorId)
  }

  const runtimeEvents = runtimeFlowEventMap(field)
  const bindingEventKey = toHandlerKey(camelize(binding.trigger))
  addListener(componentProps, binding.trigger, (...args: unknown[]) => {
    applyFieldChange({
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
  addListener(componentProps, blurEvent, () => {
    setTouched(field.field)
    void validateField(field.field, 'blur')
  }, metadata, runtimeEvents.get(blurEventKey))
  if (metadata) {
    const managedListeners = new Set([
      bindingEventKey,
      blurEventKey,
    ])
    addRuntimeFlowEventListeners(componentProps, metadata, runtimeEvents, managedListeners)
    wrapComponentListeners(componentProps, metadata, managedListeners, runtimeEvents)
  }

  return h(resolveComponent(registration?.component ?? field.component), {
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
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  registerElement: boolean,
): VNodeChild {
  const slots = createNodeSlots(node, path, ancestors)
  const registration = resolveRegistration(node.component)
  const component = registration?.component ?? node.component
  const metadataAttrs = registerElement ? nodeMetadataAttrs(metadata) : {}
  const componentProps: Record<string, unknown> = {
    ...registration?.props,
    ...node.props,
    ...metadataAttrs,
    class: [registration?.props?.class, node.props?.class, metadataAttrs.class],
  }
  applyDesignInteractionGuard(componentProps)
  if (registerElement)
    Object.assign(componentProps, { ref: (element: unknown) => registerNodeElement(metadata, element) })
  const runtimeEvents = runtimeFlowEventMap(node)
  const managedListeners = new Set<string>()
  addRuntimeFlowEventListeners(componentProps, metadata, runtimeEvents, managedListeners)
  wrapComponentListeners(componentProps, metadata, managedListeners, runtimeEvents)
  const configuredKey = componentProps.key
  const vnodeKey = isVNodeKey(configuredKey) ? configuredKey : `${path}.component`

  if (typeof component === 'string') {
    return h(component, {
      ...componentProps,
      key: vnodeKey,
    }, slots?.default?.() ?? [])
  }

  return h(resolveComponent(component), {
    ...componentProps,
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
): Record<string, (slotProps?: Record<string, unknown>) => VNodeChild> | undefined {
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
    return slot.map((child, index) => renderNode(child, false, `${path}.${index}`, ancestors, slotName))

  return renderNode(slot, false, path, ancestors, slotName)
}

function resolveBinding(
  field: ConfigFormRendererField<TValues>,
  registration?: ConfigFormComponentRegistration,
): ConfigFormControlBinding {
  const adapterBinding = props.resolveBinding?.(field)
  return {
    trigger: field.trigger ?? registration?.trigger ?? adapterBinding?.trigger ?? props.defaultTrigger,
    valueProp: field.valueProp ?? registration?.valueProp ?? adapterBinding?.valueProp ?? props.defaultValueProp,
  }
}

function resolveRegistration(component: Component | string): ConfigFormComponentRegistration | undefined {
  if (typeof component !== 'string')
    return undefined

  if (!props.components || !Object.hasOwn(props.components, component))
    return undefined

  const registered = props.components[component]
  if (registered === undefined)
    return undefined
  return isConfigFormComponentRegistration(registered)
    ? registered
    : { component: registered }
}

function resolveComponent<TComponent extends Component | string>(component: TComponent): TComponent {
  if (isObject(component))
    return markRaw(toRaw(component)) as TComponent
  return component
}

function isObject(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function addListener(
  target: Record<string, unknown>,
  event: string,
  listener: (...args: unknown[]) => void,
  metadata?: ConfigFormRuntimeNodeMetadata<TValues>,
  runtimeEvent?: string,
): void {
  const key = toHandlerKey(camelize(event))
  const existing = target[key]
  const existingListeners = Array.isArray(existing)
    ? existing.filter((value): value is (...args: unknown[]) => unknown => typeof value === 'function')
    : typeof existing === 'function' ? [existing] : []
  target[key] = (...args: unknown[]) => {
    if (metadata && shouldInterceptEditorEvent(metadata, event, args))
      return
    for (const existingListener of existingListeners)
      existingListener(...args)
    listener(...args)
    if (metadata && runtimeEvent)
      emitRuntimeEvent(metadata, runtimeEvent, args)
  }
}

function addRuntimeFlowEventListeners(
  target: Record<string, unknown>,
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  runtimeEvents: ReadonlyMap<string, string>,
  managedListenerKeys: Set<string>,
): void {
  for (const [key, event] of runtimeEvents) {
    if (!managedListenerKeys.has(key))
      addListener(target, event, () => {}, metadata, event)
    managedListenerKeys.add(key)
  }
}

function runtimeFlowEventMap(node: ConfigFormRendererNode<TValues>): ReadonlyMap<string, string> {
  return new Map(runtimeFlowEvents(node).map(event => [toHandlerKey(camelize(event)), event] as const))
}

function runtimeFlowEvents(node: ConfigFormRendererNode<TValues>): string[] {
  const lowCode = node.extensions?.['mx.low-code']
  if (!isObject(lowCode))
    return []
  const events = (lowCode as Record<string, unknown>).flowEvents
  if (!Array.isArray(events))
    return []
  return [...new Set(events.filter(isNonEmptyString))]
}

function eventNameFromHandlerKey(key: string): string {
  const event = key.slice(2)
  return event.charAt(0).toLowerCase() + event.slice(1)
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

onMounted(() => {
  startDesignInteractionGuard()
})

onBeforeUnmount(() => {
  designInteractionObserver?.disconnect()
  designInteractionObserver = undefined
  restoreDesignTabIndex()
})
</script>

<template>
  <form
    ref="formRef"
    v-bind="formAttrs"
    data-config-form-responsive-root
    :data-dirty="meta.dirty"
    :data-touched="meta.touched"
    @submit.prevent="submit"
  >
    <ConfigFormTree />

    <slot v-bind="{ meta, model, submit, resetFields }" />
  </form>
</template>

<style lang="scss">
@use '../styles/responsive';
</style>
