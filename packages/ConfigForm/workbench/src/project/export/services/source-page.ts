import type {
  StandaloneSourceNode,
  StandaloneSourcePage,
  StandaloneSourceRegistry,
} from '../types/source'
import { resolveSourceComponentDefinition } from './source-registry'
import { scriptJson } from './source-serialization'

function collectSourceBindings(
  nodes: StandaloneSourceNode[],
  registry: StandaloneSourceRegistry,
  target = new Map<string, ReturnType<typeof resolveSourceComponentDefinition>['binding']>(),
): Map<string, ReturnType<typeof resolveSourceComponentDefinition>['binding']> {
  for (const node of nodes) {
    if (!target.has(node.component))
      target.set(node.component, structuredClone(resolveSourceComponentDefinition(node, registry).binding))
    if (node.kind === 'layout')
      Object.values(node.slots).forEach(children => collectSourceBindings(children, registry, target))
  }
  return target
}

export function appSource(
  page: StandaloneSourcePage,
  registry: StandaloneSourceRegistry,
): string {
  const { flowPlans: _flowPlans, ...pageConfiguration } = page
  const bindings = Object.fromEntries([...collectSourceBindings(page.root, registry)]
    .sort(([left], [right]) => left.localeCompare(right)))
  return `<script setup lang="ts">
import type { ConfigFormRendererExpose } from '../../runtime/vue/renderer'
import { createSourceDataSourceRequest, createSourceFlowActions } from '../../actions'
import { createConfigFormModel } from '../../runtime/headless'
import { createSourceRendererConfig } from '../../runtime/source-page'
import { ConfigFormRenderer, createConfigFormRendererExpose } from '../../runtime/vue/renderer'
import { resolveComponent, shallowRef, useTemplateRef } from 'vue'
import { flowPlans } from './flows'
import { resolveFieldValidation } from './validation'

const pageName = ${scriptJson(page.name)}
const submitted = shallowRef('')
const eventError = shallowRef('')
const values = shallowRef<Record<string, unknown>>({})
const model = createConfigFormModel(values)
const rendererRef = useTemplateRef<ConfigFormRendererExpose>('renderer')
const rendererConfig = createSourceRendererConfig({
  bindings: ${scriptJson(bindings, 2)},
  flowPlans,
  page: ${scriptJson(pageConfiguration, 2)},
  resolveComponent,
  resolveFieldValidation,
})
const onRequest: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)
const dataSourceHost = { request: createSourceDataSourceRequest(onRequest, () => document.baseURI) }
const flowActions = createSourceFlowActions({
  fetch: onRequest,
  openUrl: (url, target) => { globalThis.open(url, target) },
  message: ({ message }) => { submitted.value = message },
  confirm: ({ message }) => globalThis.confirm(message),
  notify: (message) => { submitted.value = message },
})

function handleSubmit(next: Record<string, unknown>): void {
  submitted.value = JSON.stringify(next, null, 2)
}

function handleFlowError(diagnostic: { message: string }): void {
  eventError.value = diagnostic.message
}

defineExpose(createConfigFormRendererExpose(rendererRef))
</script>

<template>
  <main class="source-page">
    <header class="source-header">
      <p class="source-kicker">Generated Vue page</p>
      <h1>{{ pageName }}</h1>
      <p>Standalone source generated from the committed design model.</p>
    </header>
    <ConfigFormRenderer
      ref="renderer"
      v-bind="rendererConfig"
      :model="model"
      :flow-actions="flowActions"
      :data-source-host="dataSourceHost"
      @flow-error="handleFlowError"
      @submit="handleSubmit"
    >
      <button class="source-submit" type="submit">Save</button>
    </ConfigFormRenderer>
    <pre v-if="submitted" class="source-result" aria-live="polite">{{ submitted }}</pre>
    <p v-if="eventError" class="source-field-error" role="alert">{{ eventError }}</p>
  </main>
</template>
`
}

/** Generic projection only; field state, lifecycle, validation and Flow execution stay in the shared renderer. */
export function standalonePageRuntimeSource(): string {
  return `import type {
  ConfigFormFlowExecutionPlan,
  ConfigFormPageRuntimeConfiguration,
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from './core'
import type { ConfigFormFieldValidator, ConfigFormValues } from './headless'
import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
  ConfigFormRendererNode,
  ConfigFormRendererProps,
} from './vue/renderer'
import type { ConfigFormPageRuntimePlan } from './vue/runtime'
import type { Component } from 'vue'
import { evaluateConfigFormReactionCondition } from './reaction'
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
  events: Record<string, unknown[]>
  flowEvents: string[]
  extensions?: Record<string, unknown>
  bindings: Record<string, unknown>
  placement: Record<string, unknown>
  conditions?: Partial<Record<'disabled' | 'hidden' | 'readonly' | 'required' | 'visible', ConfigFormReactionCondition>>
  reactions?: ConfigFormReaction[]
}

interface SourceFieldNode extends SourceNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: unknown
  validation?: unknown
  optionSource?: ConfigFormPageRuntimePlan['optionBindings'][number]['source']
  validateOn: Array<'blur' | 'change' | 'submit'>
}

interface SourceLayoutNode extends SourceNodeBase {
  kind: 'layout'
  slots: Record<string, SourceNode[]>
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

type SourceNode = SourceFieldNode | SourceLayoutNode

interface SourcePageConfiguration {
  id: string
  name: string
  route: string
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
  root: SourceNode[]
  runtime: ConfigFormPageRuntimeConfiguration
  scopedFields: ConfigFormScopedFieldDefinition[]
  valueScopes: ConfigFormValueScopeDefinition[]
  optionBindings: ConfigFormPageRuntimePlan['optionBindings']
}

interface SourceFieldRuntimeValidation {
  validateOn: Array<'blur' | 'change' | 'submit'>
  required?: boolean
  requiredMessage?: string
  schema?: unknown
  validator?: ConfigFormFieldValidator
}

interface CreateSourceRendererConfigInput {
  bindings: Record<string, SourceComponentBinding>
  flowPlans: readonly ConfigFormFlowExecutionPlan[]
  page: SourcePageConfiguration
  resolveComponent: (name: string) => Component | string
  resolveFieldValidation: (nodeId: string) => SourceFieldRuntimeValidation
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

function condition(source: ConfigFormReactionCondition | undefined) {
  return source === undefined
    ? undefined
    : (values: ConfigFormValues) => evaluateConfigFormReactionCondition(source, values)
}

function extensions(node: SourceNode): Record<string, unknown> | undefined {
  const lowCode = {
    ...(Object.keys(node.events).length ? { events: structuredClone(node.events) } : {}),
    ...(Object.keys(node.bindings).length ? { bindings: structuredClone(node.bindings) } : {}),
  }
  const result = {
    ...(node.extensions ? structuredClone(node.extensions) : {}),
    ...(Object.keys(lowCode).length ? { 'mx.low-code': lowCode } : {}),
  }
  return Object.keys(result).length ? result : undefined
}

function rendererNode(
  node: SourceNode,
  bindings: Record<string, SourceComponentBinding>,
  resolveFieldValidation: CreateSourceRendererConfigInput['resolveFieldValidation'],
): ConfigFormRendererNode {
  const binding = bindings[node.component]
  if (!binding)
    throw new Error('Missing generated component binding: ' + node.component)
  const metadata = extensions(node)
  const common = {
    id: node.id,
    component: node.component,
    props: {
      ...structuredClone(node.props),
      ...(node.kind === 'layout' ? { style: [node.props.style, layoutStyle(node, binding.render)] } : {}),
    },
    ...(metadata ? { extensions: metadata } : {}),
    ...(node.flowEvents.length ? { eventNames: [...node.flowEvents] } : {}),
    ...(node.reactions ? { reactions: structuredClone(node.reactions) } : {}),
    ...(typeof node.placement.span === 'number' ? { span: node.placement.span } : {}),
    ...(node.conditions?.visible ? { visible: condition(node.conditions.visible) } : {}),
    ...(node.conditions?.hidden ? { hidden: condition(node.conditions.hidden) } : {}),
  }
  if (node.kind === 'layout') {
    return {
      ...common,
      ...(node.valueScope ? { valueScope: structuredClone(node.valueScope) } : {}),
      slots: Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [
        name,
        children.map(child => rendererNode(child, bindings, resolveFieldValidation)),
      ])),
    } as ConfigFormRendererNode
  }
  const validation = resolveFieldValidation(node.id)
  return {
    ...common,
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
    validateOn: [...validation.validateOn],
    ...(node.conditions?.required
      ? { required: condition(node.conditions.required) }
      : validation.required === undefined ? {} : { required: validation.required }),
    ...(validation.requiredMessage === undefined ? {} : { requiredMessage: validation.requiredMessage }),
    ...(validation.schema === undefined ? {} : { schema: validation.schema }),
    ...(validation.validator === undefined ? {} : { validator: validation.validator }),
    ...(node.conditions?.disabled ? { disabled: condition(node.conditions.disabled) } : {}),
    ...(node.conditions?.readonly ? { readonly: condition(node.conditions.readonly) } : {}),
    ...(binding.valueProp ? { valueProp: binding.valueProp } : {}),
    ...(binding.trigger ? { trigger: binding.trigger } : {}),
    ...(binding.blurTrigger ? { blurTrigger: binding.blurTrigger } : {}),
  } as ConfigFormRendererNode
}

export function createSourceRendererConfig(
  input: CreateSourceRendererConfigInput,
): Omit<ConfigFormRendererProps, 'model' | 'flowActions'> {
  const components: ConfigFormComponentRegistry = Object.fromEntries(Object.entries(input.bindings).map(([key, binding]) => {
    const registration: ConfigFormComponentRegistration = {
      component: resolveSourceComponent(binding, input.resolveComponent),
      ...(binding.staticProps ? { props: structuredClone(binding.staticProps) } : {}),
      ...(binding.valueProp ? { valueProp: binding.valueProp } : {}),
      ...(binding.trigger ? { trigger: binding.trigger } : {}),
      ...(binding.blurTrigger ? { blurTrigger: binding.blurTrigger } : {}),
    }
    return [key, registration]
  }))
  const plan: ConfigFormPageRuntimePlan = Object.freeze({
    flows: Object.freeze([...input.flowPlans]),
    optionBindings: Object.freeze(structuredClone(input.page.optionBindings)),
    runtime: Object.freeze(structuredClone(input.page.runtime)),
    valueSchema: Object.freeze({
      scopedFields: Object.freeze(structuredClone(input.page.scopedFields)),
      valueScopes: Object.freeze(structuredClone(input.page.valueScopes)),
    }),
  })
  return {
    components,
    fields: input.page.root.map(node => rendererNode(node, input.bindings, input.resolveFieldValidation)),
    plan,
    ...(input.page.form.readonly === undefined ? {} : { readonly: input.page.form.readonly }),
    ...(input.page.form.inline === undefined ? {} : { inline: input.page.form.inline }),
    ...(input.page.form.columns === undefined ? {} : { columns: input.page.form.columns }),
    ...(input.page.form.gap === undefined ? {} : { gap: input.page.form.gap }),
    ...(input.page.form.fieldSpan === undefined ? {} : { fieldSpan: input.page.form.fieldSpan }),
    ...(input.page.form.labelPosition === undefined ? {} : { labelPosition: input.page.form.labelPosition }),
    ...(input.page.form.labelWidth === undefined ? {} : { labelWidth: input.page.form.labelWidth }),
    ...(input.page.form.responsive === undefined ? {} : { responsive: structuredClone(input.page.form.responsive) }),
  }
}
`
}
