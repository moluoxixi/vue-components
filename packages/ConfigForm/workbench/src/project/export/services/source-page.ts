import type {
  StandaloneSourceNode,
  StandaloneSourceRegistry,
  StandaloneSourceSurface,
} from '../types/source'
import { resolveSourceComponentDefinition } from './source-registry'
import { scriptJson } from './source-serialization'

function collectSourceComponentBindings(
  nodes: StandaloneSourceNode[],
  registry: StandaloneSourceRegistry,
  target = new Map<string, ReturnType<typeof resolveSourceComponentDefinition>['binding']>(),
): Map<string, ReturnType<typeof resolveSourceComponentDefinition>['binding']> {
  for (const node of nodes) {
    if (!target.has(node.component))
      target.set(node.component, structuredClone(resolveSourceComponentDefinition(node, registry).binding))
    if (node.kind === 'layout')
      Object.values(node.slots).forEach(children => collectSourceComponentBindings(children, registry, target))
  }
  return target
}

export function appSource(
  surface: StandaloneSourceSurface,
  registry: StandaloneSourceRegistry,
): string {
  const componentBindings = Object.fromEntries([...collectSourceComponentBindings(surface.root, registry)]
    .sort(([left], [right]) => left.localeCompare(right)))
  return `<script setup lang="ts">
import type { ConfigFormFieldChangePayload } from '../../runtime/headless'
import type {
  ConfigFormRendererExpose,
  ConfigFormRendererProps,
} from '../../runtime/vue/renderer'
import type {
  MaterialSemanticTrigger,
  ModelJsonObject,
  ModelJsonValue,
  PrimaryUiActionBinding,
  PrototypeInstanceProjectionV1,
  PrototypeNodeAddressV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { PrototypeVueSurfaceRendererBindings } from '@moluoxixi/config-form-prototype-runtime/vue'
import { createConfigFormModel } from '../../runtime/headless'
import { createSourceRendererConfig } from '../../runtime/source-page'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '../../runtime/vue/renderer'
import {
  cloneJson,
  createPrototypeInstanceRuntimeSnapshot,
} from '@moluoxixi/config-form-prototype-runtime/session'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  resolveComponent,
  shallowRef,
  toRaw,
  useTemplateRef,
} from 'vue'
import { resolveFieldValidation } from './validation'

const surfaceConfiguration = ${scriptJson(surface, 2)} as const
const surfaceId = ${scriptJson(surface.id)}
const surfaceKind = ${scriptJson(surface.kind)}
const props = defineProps<{ prototype: PrototypeVueSurfaceRendererBindings }>()

function clonePrototypeContract<T>(value: T): T {
  return cloneJson(value as unknown as ModelJsonValue) as unknown as T
}

const root = useTemplateRef<HTMLElement>('root')
const rendererRef = useTemplateRef<ConfigFormRendererExpose<ModelJsonObject>>('renderer')
const values = shallowRef<ModelJsonObject>(cloneJson(toRaw(props.prototype.values)))
const projection = shallowRef<PrototypeInstanceProjectionV1>(clonePrototypeContract(toRaw(props.prototype.projection)))
const rendererRevision = ref(0)
let disposed = false
let unregister: (() => void) | undefined
const model = createConfigFormModel(values)
const rendererConfig = createSourceRendererConfig({
  components: ${scriptJson(componentBindings, 2)} as const,
  surface: surfaceConfiguration,
  resolveComponent,
  resolveFieldValidation,
})

type RuntimeReactionProjection = NonNullable<ConfigFormRendererProps<ModelJsonObject>['reactionProjection']>
interface PrototypeScopeEntry {
  readonly scopeId: string
  readonly rowId: string
}

function sameScope(
  left: readonly PrototypeScopeEntry[],
  right: readonly PrototypeScopeEntry[],
): boolean {
  return left.length === right.length && left.every((entry, index) => (
    entry.scopeId === right[index]?.scopeId && entry.rowId === right[index]?.rowId
  ))
}

function sameRowPath(address: PrototypeNodeAddressV1, rowIds: readonly string[]): boolean {
  return address.scope.length === rowIds.length
    && address.scope.every((entry: PrototypeScopeEntry, index: number) => entry.rowId === rowIds[index])
}

function primaryBindings(trigger: MaterialSemanticTrigger): PrimaryUiActionBinding[] {
  return props.prototype.surface.interactions.filter(
    (interaction): interaction is PrimaryUiActionBinding => (
      interaction.kind === 'primaryUiAction' && interaction.trigger === trigger
    ),
  )
}

function eventOrigin(event: Event): Element | undefined {
  if (event.type === 'submit' && 'submitter' in event && event.submitter instanceof Element)
    return event.submitter
  return event.target instanceof Element ? event.target : undefined
}

function rowIdsFor(element: Element): string[] {
  const rowIds: string[] = []
  let current: Element | null = element
  while (current && current !== root.value) {
    if (current.hasAttribute('data-config-form-row')) {
      const rowId = current.getAttribute('data-row-id')
      if (rowId)
        rowIds.unshift(rowId)
    }
    current = current.parentElement
  }
  return rowIds
}

function addressFor(nodeId: string, element?: Element): PrototypeNodeAddressV1 | undefined {
  const candidates = props.prototype.instance.runtime.nodeAddresses
    .filter(address => address.nodeId === nodeId)
  if (!element)
    return candidates.length === 1 ? clonePrototypeContract(toRaw(candidates[0]!)) : undefined
  const rowIds = rowIdsFor(element)
  const address = candidates.find(candidate => sameRowPath(candidate, rowIds))
  return address ? clonePrototypeContract(toRaw(address)) : undefined
}

function semanticSource(trigger: MaterialSemanticTrigger, event: Event): {
  address: PrototypeNodeAddressV1
  binding: PrimaryUiActionBinding
} | undefined {
  const bindings = primaryBindings(trigger)
  if (bindings.length === 0)
    return undefined
  const origin = eventOrigin(event)
  const nodeElement = origin?.closest('[data-config-node-id]')
  if (nodeElement && root.value?.contains(nodeElement)) {
    const nodeId = nodeElement.getAttribute('data-config-node-id')
    const binding = bindings.find(candidate => candidate.nodeId === nodeId)
    const address = nodeId ? addressFor(nodeId, nodeElement) : undefined
    return binding && address ? { address, binding } : undefined
  }
  if (trigger !== 'submit' || bindings.length !== 1)
    return undefined
  const binding = bindings[0]!
  const address = addressFor(binding.nodeId)
  return address ? { address, binding } : undefined
}

async function activateSemantic(trigger: MaterialSemanticTrigger, event: Event): Promise<void> {
  if (disposed)
    return
  const source = semanticSource(trigger, event)
  if (!source)
    return
  await props.prototype.activate({
    sourceAddress: source.address,
    interactionId: source.binding.id,
  })
}

function handleActivate(event: MouseEvent): void {
  const origin = eventOrigin(event)
  if (
    event.defaultPrevented
    || event.button !== 0
    || origin?.closest('[disabled], [aria-disabled="true"], [data-config-form-row-action]')
  ) {
    return
  }
  void activateSemantic('activate', event)
}

function handleSubmit(event: Event): void {
  void activateSemantic('submit', event)
}

function projectionKey(address: PrototypeNodeAddressV1): string {
  void rendererRevision.value
  try {
    return rendererRef.value?.getInstanceKey(address) ?? address.nodeId
  }
  catch {
    return address.nodeId
  }
}

function setNestedProperty(target: Record<string, unknown>, path: readonly string[], value: ModelJsonValue): void {
  let current = target
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      current[segment] = cloneJson(value)
      return
    }
    const child = current[segment]
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      current = child as Record<string, unknown>
      return
    }
    const next: Record<string, unknown> = {}
    current[segment] = next
    current = next
  })
}

const reactionProjection = computed<RuntimeReactionProjection>(() => {
  const states: RuntimeReactionProjection['states'] = {}
  const projectedProps: RuntimeReactionProjection['props'] = {}
  projection.value.forEach((entry) => {
    const key = projectionKey(entry.address)
    if (Object.keys(entry.states).length > 0)
      states[key] = { ...entry.states }
    if (entry.properties.length > 0) {
      const target: Record<string, unknown> = {}
      entry.properties.forEach(property => setNestedProperty(target, property.path, property.value))
      projectedProps[key] = target
    }
  })
  return { values: values.value, props: projectedProps, states, validate: [] }
})

function replaceValues(nextValues: ModelJsonObject): void {
  values.value = cloneJson(toRaw(nextValues))
}

function replaceProjection(nextProjection: PrototypeInstanceProjectionV1): void {
  projection.value = clonePrototypeContract(toRaw(nextProjection))
}

function focus(address: PrototypeNodeAddressV1): void {
  void nextTick(() => {
    if (disposed)
      return
    const instances = rendererRef.value?.listFieldInstances(address.nodeId) ?? []
    const fieldIndex = instances.findIndex(instance => sameScope(instance.address.scope, address.scope))
    const field = fieldIndex < 0 ? undefined : instances[fieldIndex]
    const shells = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-field]') ?? [])
      .filter(element => element.dataset.field === field?.field)
    const shell = fieldIndex < 0 ? undefined : shells[fieldIndex]
    const target = shell?.querySelector<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? shell ?? root.value
    target?.focus()
  })
}

async function validateFields(addresses: readonly PrototypeNodeAddressV1[]): Promise<boolean> {
  const renderer = rendererRef.value
  if (!renderer)
    return false
  const results = await Promise.all(addresses.map(address => renderer.validateInstance(address)))
  return results.every(Boolean)
}

function resolveChangedAddress(
  payload: ConfigFormFieldChangePayload<ModelJsonObject>,
): PrototypeNodeAddressV1 | undefined {
  if (payload.address)
    return clonePrototypeContract(toRaw(payload.address))
  const candidates = rendererRef.value?.listFieldInstances()
    .filter(instance => instance.field === payload.field) ?? []
  const scope = payload.scope ?? []
  return candidates.find(instance => sameScope(instance.address.scope, scope))?.address
}

function handleFieldChange(payload: ConfigFormFieldChangePayload<ModelJsonObject>): void {
  const nextValues = cloneJson(toRaw(payload.values))
  values.value = nextValues
  const address = resolveChangedAddress(payload)
  if (!address)
    throw new Error('Generated Surface field change has no live node address: ' + payload.field + '.')
  const runtime = createPrototypeInstanceRuntimeSnapshot(
    props.prototype.surface,
    nextValues,
    props.prototype.createRowIdFactory(),
  )
  if (!runtime.success)
    throw new Error(runtime.diagnostics.map(item => item.message).join('\\n'))
  props.prototype.valuesChanged({
    values: nextValues,
    runtime: runtime.data,
    originScope: clonePrototypeContract(toRaw(payload.scope ?? address.scope)),
    changedAddresses: [clonePrototypeContract(toRaw(address))],
  })
}

onMounted(() => {
  unregister = props.prototype.registerController({
    replaceValues: replacement => replaceValues(replacement.values),
    replaceProjection,
    validateSurface: () => rendererRef.value?.validate() ?? false,
    validateFields,
    focus,
    dispose: () => {
      disposed = true
    },
  })
  rendererRevision.value += 1
})

onBeforeUnmount(() => {
  disposed = true
  unregister?.()
})

defineExpose(createConfigFormRendererExpose(rendererRef))
</script>

<template>
  <div
    ref="root"
    class="source-surface"
    :data-surface-id="surfaceId"
    :data-surface-kind="surfaceKind"
    @click="handleActivate"
    @submit="handleSubmit"
  >
    <ConfigFormRenderer
      ref="renderer"
      :model="model"
      :reaction-projection="reactionProjection"
      mode="preview"
      v-bind="rendererConfig"
      @field-change="handleFieldChange"
    />
  </div>
</template>
`
}

/** Static Surface projection; Prototype interactions remain owned by the shared Prototype Runtime. */
export function standaloneSurfaceRuntimeSource(): string {
  return `import type { ConfigFormFieldValidator } from './headless'
import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
  ConfigFormRendererNode,
  ConfigFormRendererProps,
} from './vue/renderer'
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

interface SourceComponentBinding {
  component: string
  contractFingerprint: string
  contractVersion: string
  configComponent: string
  defaultValue?: unknown
  tag: string
  render: 'component' | 'layout-flex' | 'layout-grid' | 'section'
  library?: { packageName: string, plugin: string, version: string, stylesheet?: string }
  options?: { mode: 'prop' | 'children', optionTag?: string, labelProp?: string, valueProp?: string }
  staticProps?: Record<string, unknown>
  blurTrigger?: string
  trigger?: string
  valueProp?: string
}

interface SourceNodeBase {
  id: string
  component: string
  props: Record<string, unknown>
  extensions?: Record<string, unknown>
  placement: Record<string, unknown>
}

interface SourceFieldNode extends SourceNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: unknown
  validation?: unknown
  validateOn: readonly ('blur' | 'change' | 'submit')[]
}

interface SourceLayoutNode extends SourceNodeBase {
  kind: 'layout'
  slots: Readonly<Record<string, readonly SourceNode[]>>
  valueScope?: {
    kind: 'array' | 'object'
    field: string
    itemKey?: string
    minItems?: number
    maxItems?: number
  }
}

interface SourceElementNode extends SourceNodeBase {
  kind: 'element'
}

type SourceNode = SourceFieldNode | SourceLayoutNode | SourceElementNode

interface SourceSurfaceConfiguration {
  form: {
    readonly?: boolean
    inline?: boolean
    columns?: number
    gap?: string
    fieldSpan?: number
    labelPosition?: 'left' | 'top'
    labelWidth?: number
    responsive?: ConfigFormRendererProps['responsive']
  }
  root: readonly SourceNode[]
}

interface SourceFieldValidation {
  validateOn: Array<'blur' | 'change' | 'submit'>
  required?: boolean
  requiredMessage?: string
  schema?: unknown
  validator?: ConfigFormFieldValidator
}

interface CreateSourceRendererConfigInput {
  components: Readonly<Record<string, SourceComponentBinding>>
  surface: SourceSurfaceConfiguration
  resolveComponent: (name: string) => Component | string
  resolveFieldValidation: (nodeId: string) => SourceFieldValidation
}

function resolveSourceComponent(
  binding: SourceComponentBinding,
  resolveComponent: CreateSourceRendererConfigInput['resolveComponent'],
): Component {
  const native = !binding.library && /^[a-z][a-z0-9]*$/.test(binding.tag)
  const component = native ? binding.tag : resolveComponent(binding.tag)
  const childOptions = binding.options?.mode === 'children' && binding.options.optionTag
  if (typeof component !== 'string' && !childOptions && binding.render !== 'section')
    return component
  const optionComponent = childOptions ? resolveComponent(binding.options!.optionTag!) : undefined
  return defineComponent({
    name: 'StandaloneSourceComponent',
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => {
        const componentProps = { ...attrs }
        const options = Array.isArray(componentProps.options) ? componentProps.options : []
        if (childOptions)
          delete componentProps.options
        const title = typeof componentProps.title === 'string'
          ? componentProps.title
          : typeof componentProps.header === 'string' ? componentProps.header : undefined
        if (binding.render === 'section') {
          delete componentProps.title
          delete componentProps.header
        }
        const generatedOptions = childOptions && optionComponent
          ? options.flatMap((option, index) => {
              if (!option || typeof option !== 'object' || Array.isArray(option))
                return []
              const record = option as Record<string, unknown>
              if (typeof record.label !== 'string' || !Object.hasOwn(record, 'value'))
                return []
              return [h(optionComponent, {
                key: String(record.value) + '-' + index,
                [binding.options!.labelProp ?? 'label']: record.label,
                [binding.options!.valueProp ?? 'value']: record.value,
              })]
            })
          : []
        const content = [
          ...(title ? [h('h2', title)] : []),
          ...generatedOptions,
          ...(slots.default?.() ?? []),
        ]
        return h(component, componentProps, childOptions || binding.render === 'section'
          ? { ...slots, default: () => content }
          : slots)
      }
    },
  })
}

function layoutStyle(node: SourceLayoutNode, render: SourceComponentBinding['render']): Record<string, string> {
  const numericGap = typeof node.props.gap === 'number' && Number.isFinite(node.props.gap)
    ? Math.max(0, node.props.gap)
    : 0
  if (render === 'layout-flex') {
    return {
      alignItems: ['flex-start', 'center', 'flex-end', 'stretch'].includes(String(node.props.align)) ? String(node.props.align) : 'stretch',
      display: 'flex',
      flexDirection: node.props.direction === 'column' ? 'column' : 'row',
      flexWrap: node.props.wrap === false ? 'nowrap' : 'wrap',
      gap: String(numericGap) + 'px',
      justifyContent: ['flex-start', 'center', 'flex-end', 'space-between'].includes(String(node.props.justify)) ? String(node.props.justify) : 'flex-start',
    }
  }
  if (render === 'layout-grid') {
    const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns)
      ? Math.min(12, Math.max(1, node.props.columns))
      : 1
    return {
      display: 'grid',
      gap: String(numericGap) + 'px',
      gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))',
    }
  }
  return {}
}

function nodeExtensions(node: SourceNode): Record<string, unknown> | undefined {
  if (!node.extensions || Object.keys(node.extensions).length === 0)
    return undefined
  return structuredClone(node.extensions)
}

function rendererNode(
  node: SourceNode,
  components: Readonly<Record<string, SourceComponentBinding>>,
  resolveFieldValidation: CreateSourceRendererConfigInput['resolveFieldValidation'],
): ConfigFormRendererNode {
  const binding = components[node.component]
  if (!binding)
    throw new Error('Missing generated component binding: ' + node.component)
  const extensions = nodeExtensions(node)
  const common = {
    id: node.id,
    component: node.component,
    props: {
      ...structuredClone(node.props),
      ...(node.kind === 'layout' ? { style: [node.props.style, layoutStyle(node, binding.render)] } : {}),
    },
    ...(extensions ? { extensions } : {}),
    ...(typeof node.placement.span === 'number' ? { span: node.placement.span } : {}),
  }
  if (node.kind === 'layout') {
    return {
      ...common,
      ...(node.valueScope ? { valueScope: structuredClone(node.valueScope) } : {}),
      slots: Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [
        name,
        children.map(child => rendererNode(child, components, resolveFieldValidation)),
      ])),
    } as ConfigFormRendererNode
  }
  if (node.kind === 'element')
    return common as ConfigFormRendererNode

  const validation = resolveFieldValidation(node.id)
  return {
    ...common,
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
    validateOn: [...validation.validateOn],
    ...(validation.required === undefined ? {} : { required: validation.required }),
    ...(validation.requiredMessage === undefined ? {} : { requiredMessage: validation.requiredMessage }),
    ...(validation.schema === undefined ? {} : { schema: validation.schema }),
    ...(validation.validator === undefined ? {} : { validator: validation.validator }),
    ...(binding.valueProp ? { valueProp: binding.valueProp } : {}),
    ...(binding.trigger ? { trigger: binding.trigger } : {}),
    ...(binding.blurTrigger ? { blurTrigger: binding.blurTrigger } : {}),
  } as ConfigFormRendererNode
}

export function createSourceRendererConfig(
  input: CreateSourceRendererConfigInput,
): Omit<ConfigFormRendererProps, 'model'> {
  const components: ConfigFormComponentRegistry = Object.fromEntries(Object.entries(input.components).map(([key, binding]) => {
    const registration: ConfigFormComponentRegistration = {
      component: resolveSourceComponent(binding, input.resolveComponent),
      ...(binding.staticProps ? { props: structuredClone(binding.staticProps) } : {}),
      ...(binding.valueProp ? { valueProp: binding.valueProp } : {}),
      ...(binding.trigger ? { trigger: binding.trigger } : {}),
      ...(binding.blurTrigger ? { blurTrigger: binding.blurTrigger } : {}),
    }
    return [key, registration]
  }))
  return {
    components,
    fields: input.surface.root.map(node => rendererNode(node, input.components, input.resolveFieldValidation)),
    ...(input.surface.form.readonly === undefined ? {} : { readonly: input.surface.form.readonly }),
    ...(input.surface.form.inline === undefined ? {} : { inline: input.surface.form.inline }),
    ...(input.surface.form.columns === undefined ? {} : { columns: input.surface.form.columns }),
    ...(input.surface.form.gap === undefined ? {} : { gap: input.surface.form.gap }),
    ...(input.surface.form.fieldSpan === undefined ? {} : { fieldSpan: input.surface.form.fieldSpan }),
    ...(input.surface.form.labelPosition === undefined ? {} : { labelPosition: input.surface.form.labelPosition }),
    ...(input.surface.form.labelWidth === undefined ? {} : { labelWidth: input.surface.form.labelWidth }),
    ...(input.surface.form.responsive === undefined ? {} : { responsive: structuredClone(input.surface.form.responsive) }),
  }
}
`
}
