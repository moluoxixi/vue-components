import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import type {
  StandaloneSourceFieldNode,
  StandaloneSourceLayoutNode,
  StandaloneSourceNode,
  StandaloneSourcePage,
  StandaloneSourceRegistry,
  StandaloneSourceResolvedLayouts,
} from '../types/source'
import {
  resolveSourceLayouts,
  resolveSourceNodeSpan,
  sourceContainerStyle,
  sourceFormStyle,
  sourceNodeStyle,
} from './source-layout'
import { resolveSourceComponentDefinition as componentDefinition } from './source-registry'
import { escapeHtml, quote, scriptJson } from './source-serialization'

function fieldOptions(node: StandaloneSourceNode): Array<{ label: string, value: unknown }> {
  const options = node.props.options
  if (!Array.isArray(options))
    return []
  return options.flatMap((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option))
      return []
    const record = option as Record<string, unknown>
    return typeof record.label === 'string' && Object.hasOwn(record, 'value')
      ? [{ label: record.label, value: record.value }]
      : []
  })
}

function sourceProps(node: StandaloneSourceNode, registry: StandaloneSourceRegistry): Record<string, unknown> {
  const definition = componentDefinition(node, registry)
  const props = {
    ...(definition.binding.staticProps ?? {}),
    ...node.props,
  }
  delete props.options
  delete props.optionSource
  return props
}

function collectInitialValues(
  nodes: StandaloneSourceNode[],
  values: Record<string, unknown>,
  registry: StandaloneSourceRegistry,
): void {
  for (const node of nodes) {
    if (node.kind === 'field' && node.field) {
      const definition = componentDefinition(node, registry)
      const defaultValue = node.defaultValue !== undefined
        ? node.defaultValue
        : definition.binding.defaultValue
      values[node.field] = defaultValue !== undefined
        ? structuredClone(defaultValue)
        : definition.binding.configComponent === 'boolean'
          ? false
          : definition.binding.configComponent === 'number' ? 0 : ''
    }
    if (node.kind === 'layout')
      Object.values(node.slots).forEach(children => collectInitialValues(children, values, registry))
  }
}

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function sourceEventBindings(node: StandaloneSourceNode, excludedEvents: readonly string[] = []): string {
  const nodeId = quote(node.id)
  const eventNames = [...new Set([...node.flowEvents, ...Object.keys(node.events)])]
  return eventNames
    .filter(eventName => !excludedEvents.includes(kebabCase(eventName)))
    .map(eventName => ` @${escapeHtml(kebabCase(eventName))}='runNodeEvent(${nodeId}, ${quote(eventName)}, $event)'`)
    .join('')
}

function renderField(
  node: StandaloneSourceFieldNode,
  layouts: StandaloneSourceResolvedLayouts,
  registry: StandaloneSourceRegistry,
): string {
  const definition = componentDefinition(node, registry)
  const source = definition.binding
  const field = quote(node.field)
  const styleAttr = ` style="${sourceNodeStyle(node, layouts)}"`
  const hiddenAttr = ` :hidden='fieldStates[${field}]?.visible === false'`
  const safeId = escapeHtml(node.id)
  const safeTag = escapeHtml(source.tag)
  const nodeId = quote(node.id)
  const valueProp = definition.binding.valueProp ?? 'modelValue'
  const modelDirective = valueProp === 'modelValue'
    ? 'v-model'
    : `v-model:${kebabCase(valueProp)}`
  const updateEvent = `update:${kebabCase(valueProp)}`
  const label = node.label
    ? `\n      <label class="source-field-label">${escapeHtml(node.label)}</label>`
    : ''
  const optionBinding = source.options?.mode === 'prop'
    ? ` :options='fieldOptions[${field}]'`
    : ''
  const optionChildren = source.options?.mode === 'children' && source.options.optionTag
    ? `\n        <${escapeHtml(source.options.optionTag)} v-for='option in fieldOptions[${field}]' :key="String(option.value)" :${escapeHtml(source.options.labelProp ?? 'label')}="option.label" :${escapeHtml(source.options.valueProp ?? 'value')}="option.value" />\n      `
    : ''
  const blurEvent = kebabCase(definition.binding.blurTrigger ?? 'blur')
  const eventBindings = sourceEventBindings(node, [updateEvent, blurEvent])
  const updateBinding = `@${updateEvent}='handleFieldUpdate(${nodeId}, ${field}, ${quote(definition.binding.trigger ?? `update:${valueProp}`)}, $event)'`
  const blurBinding = `@${blurEvent}='handleFieldBlur(${nodeId}, ${field}, ${quote(definition.binding.blurTrigger ?? 'blur')}, $event)'`
  const modelBinding = `${modelDirective}='model[fieldModelKeys[${field}]]'`
  const control = optionChildren
    ? `<${safeTag} class="source-control" v-bind='fieldProps[${field}]' ${modelBinding} ${updateBinding} ${blurBinding}${eventBindings}${optionBinding}>${optionChildren}</${safeTag}>`
    : `<${safeTag} class="source-control" v-bind='fieldProps[${field}]' ${modelBinding} ${updateBinding} ${blurBinding}${eventBindings}${optionBinding} />`
  return `    <div class="source-field${label ? ' has-label' : ''}" data-node-id="${safeId}" data-component="${escapeHtml(node.component)}" data-source-tag="${safeTag}"${hiddenAttr}${styleAttr}>${label}\n      ${control}\n      <p v-if='fieldErrors[${field}]?.length' class="source-field-error" role="alert">{{ fieldErrors[${field}].join(', ') }}</p>\n    </div>`
}

function renderContainer(
  node: StandaloneSourceLayoutNode,
  layouts: StandaloneSourceResolvedLayouts,
  registry: StandaloneSourceRegistry,
): string {
  const definition = componentDefinition(node, registry)
  const source = definition.binding
  const safeId = escapeHtml(node.id)
  const safeTag = escapeHtml(source.tag)
  const nodeKey = quote(node.id)
  const children = node.slots.default ?? []
  const defaultMarkup = renderNodes(children, layouts, registry)
  const namedSlots = Object.entries(node.slots)
    .filter(([name]) => name !== 'default')
    .map(([name, slotChildren]) => `      <template #${escapeHtml(name)}>\n${renderNodes(slotChildren, layouts, registry)}\n      </template>`)
    .join('\n')
  const content = [defaultMarkup, namedSlots].filter(Boolean).join('\n')
  const common = `class="source-layout source-layout-${source.render}" data-node-id="${safeId}" data-component="${escapeHtml(node.component)}" data-source-tag="${safeTag}" v-bind='nodeProps[${nodeKey}]' :style='nodeStyles[${nodeKey}]' :hidden='nodeHidden[${nodeKey}]'${sourceEventBindings(node)}`
  if (source.render === 'section') {
    const title = typeof node.props.title === 'string'
      ? node.props.title
      : typeof node.props.header === 'string' ? node.props.header : undefined
    return `    <section ${common}>${title ? `\n      <h2>${escapeHtml(title)}</h2>` : ''}\n${content}\n    </section>`
  }
  return `    <${safeTag} ${common}>\n${content}\n    </${safeTag}>`
}

function renderNodes(
  nodes: StandaloneSourceNode[],
  layouts: StandaloneSourceResolvedLayouts,
  registry: StandaloneSourceRegistry,
): string {
  return nodes.map(node => node.kind === 'field'
    ? renderField(node, layouts, registry)
    : renderContainer(node, layouts, registry)).join('\n')
}

export function appSource(
  page: StandaloneSourcePage,
  registry: StandaloneSourceRegistry,
  flowImport = './flows',
): string {
  const initialValues: Record<string, unknown> = {}
  collectInitialValues(page.root, initialValues, registry)
  const props: Record<string, Record<string, unknown>> = {}
  const options: Record<string, Array<{ label: string, value: unknown }>> = {}
  const nodeProps: Record<string, Record<string, unknown>> = {}
  const nodeStyles: Record<string, Record<string, string>> = {}
  const fieldModelKeys: Record<string, string> = {}
  const fieldRequiredMessages: Record<string, string> = {}
  const fieldConditions: Record<string, StandaloneSourceNode['conditions']> = {}
  const nodeConditions: Record<string, StandaloneSourceNode['conditions']> = {}
  const nodeEvents: Record<string, StandaloneSourceNode['events']> = {}
  const runtimeReactions: ConfigFormReaction[] = []
  const layouts = resolveSourceLayouts(page.form)
  const collectProps = (nodes: StandaloneSourceNode[]): void => {
    nodes.forEach((node) => {
      nodeEvents[node.id] = node.events
      if (node.reactions)
        runtimeReactions.push(...node.reactions)
      if (node.kind === 'field') {
        // Reaction targets use the headless field key (not the designer node
        // id), so keep generated projection maps keyed by the same contract.
        const target = node.field
        props[target] = sourceProps(node, registry)
        options[target] = fieldOptions(node)
        const definition = componentDefinition(node, registry)
        const valueBinding = definition.bindings.find(binding => binding.valueProp === (definition.binding.valueProp ?? 'modelValue'))
        const bindingSource = valueBinding ? node.bindings[valueBinding.name]?.source.trim() : undefined
        fieldModelKeys[target] = bindingSource && Object.hasOwn(initialValues, bindingSource)
          ? bindingSource
          : target
        fieldConditions[target] = node.conditions
        const requiredRule = node.validation?.rules.find(rule => rule.kind === 'required')
        fieldRequiredMessages[target] = requiredRule?.message ?? 'Required'
      }
      else {
        nodeProps[node.id] = sourceProps(node, registry)
        nodeStyles[node.id] = {
          ...sourceContainerStyle(node, registry),
          '--source-span-desktop': String(resolveSourceNodeSpan(node, layouts.desktop)),
          '--source-span-tablet': String(resolveSourceNodeSpan(node, layouts.tablet)),
          '--source-span-mobile': String(resolveSourceNodeSpan(node, layouts.mobile)),
        }
        nodeConditions[node.id] = node.conditions
      }
      if (node.kind === 'layout')
        Object.values(node.slots).forEach(collectProps)
    })
  }
  collectProps(page.root)
  return `<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { applyFlowValuePatch, evaluateRuntimeCondition, getFlowProjection, invokeRegisteredAction, projectRuntimeReactions, registerFlowAction, runFlows, type FlowTrigger } from '${flowImport}'
import { fieldValidation, validateFieldForTrigger, validateFields, type GeneratedValidationTrigger } from './validation'

const model = reactive<Record<string, unknown>>(${scriptJson(initialValues, 2)})
const baseFieldProps = ${scriptJson(props, 2)} as Record<string, Record<string, unknown>>
const fieldProps = reactive<Record<string, Record<string, unknown>>>({ ...baseFieldProps })
const fieldOptions = ${scriptJson(options, 2)} as Record<string, Array<{ label: string, value: unknown }>>
const fieldModelKeys = ${scriptJson(fieldModelKeys, 2)} as Record<string, string>
const fieldRequiredMessages = ${scriptJson(fieldRequiredMessages, 2)} as Record<string, string>
const fieldConditions = ${scriptJson(fieldConditions, 2)} as Record<string, Record<string, unknown> | undefined>
const nodeProps = ${scriptJson(nodeProps, 2)} as Record<string, Record<string, unknown>>
const nodeStyles = ${scriptJson(nodeStyles, 2)} as Record<string, Record<string, string>>
const nodeConditions = ${scriptJson(nodeConditions, 2)} as Record<string, Record<string, unknown> | undefined>
const nodeEvents = ${scriptJson(nodeEvents, 2)} as Record<string, Record<string, Array<{ action: string, [key: string]: unknown }>>>
const runtimeReactions = ${scriptJson(runtimeReactions, 2)} as Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>
const fieldStates = reactive<Record<string, Record<string, boolean>>>({})
const nodeHidden = reactive<Record<string, boolean>>({})
const flowValidation = ref<string[]>([])
const fieldErrors = reactive<Record<string, string[]>>({})
const submitted = ref('')
const flowLifecycle = new AbortController()
const validationGeneration: Record<string, number> = Object.create(null)

registerFlowAction('notify', async (input, context) => {
  if (context.signal.aborted)
    throw context.signal.reason
  const message = typeof input === 'string' ? input : JSON.stringify(input)
  submitted.value = message ?? String(input)
  return { notified: submitted.value }
})

function applyRuntimeProjection(): void {
  const before = { ...model }
  const reactionValues = { ...model }
  const reactionProjection = projectRuntimeReactions(runtimeReactions, reactionValues)
  applyFlowValuePatch(model, before, reactionValues)
  const flowProjection = getFlowProjection()
  const projections = [reactionProjection, flowProjection]
  flowValidation.value = [...new Set(projections.flatMap(projection => projection.validate))]

  for (const key of Object.keys(fieldProps))
    delete fieldProps[key]
  for (const [key, value] of Object.entries(baseFieldProps))
    fieldProps[key] = { ...value }
  for (const key of Object.keys(fieldStates))
    delete fieldStates[key]

  for (const [field, conditions] of Object.entries(fieldConditions)) {
    if (!conditions)
      continue
    const state: Record<string, boolean> = {}
    if (conditions.visible !== undefined)
      state.visible = evaluateRuntimeCondition(conditions.visible, model)
    if (conditions.hidden !== undefined)
      state.visible = !evaluateRuntimeCondition(conditions.hidden, model)
    for (const key of ['disabled', 'readonly', 'required'] as const) {
      if (conditions[key] !== undefined)
        state[key] = evaluateRuntimeCondition(conditions[key], model)
    }
    fieldStates[field] = state
  }

  for (const [nodeId, conditions] of Object.entries(nodeConditions)) {
    const visible = conditions?.visible === undefined || evaluateRuntimeCondition(conditions.visible, model)
    const hidden = conditions?.hidden !== undefined && evaluateRuntimeCondition(conditions.hidden, model)
    nodeHidden[nodeId] = !visible || hidden
  }

  for (const projection of projections) {
    for (const [target, nextProps] of Object.entries(projection.props))
      fieldProps[target] = { ...(fieldProps[target] ?? {}), ...nextProps }
    for (const [target, nextState] of Object.entries(projection.states))
      fieldStates[target] = { ...(fieldStates[target] ?? {}), ...nextState }
  }

  for (const [field, state] of Object.entries(fieldStates)) {
    const nextProps = fieldProps[field] ?? (fieldProps[field] = {})
    if (state.disabled !== undefined)
      nextProps.disabled = state.disabled
    if (state.readonly !== undefined)
      nextProps.readonly = state.readonly
    if (state.required !== undefined)
      nextProps.required = state.required
  }
  if (flowValidation.value.length)
    void validateRequestedFields(flowValidation.value)
}

function currentValidationValues(): Record<string, unknown> {
  const values = { ...model }
  for (const [field, modelKey] of Object.entries(fieldModelKeys))
    values[field] = model[modelKey]
  return values
}

function valueMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)
}

function withRequiredError(field: string, errors: string[], values: Record<string, unknown>): string[] {
  return fieldStates[field]?.required === true && valueMissing(values[field]) && errors.length === 0
    ? [fieldRequiredMessages[field] ?? 'Required']
    : errors
}

async function validateOn(field: string, trigger: GeneratedValidationTrigger): Promise<boolean> {
  const generation = (validationGeneration[field] ?? 0) + 1
  validationGeneration[field] = generation
  const values = currentValidationValues()
  const result = await validateFieldForTrigger(field, trigger, values)
  if (result === undefined)
    return true
  const errors = withRequiredError(field, result, values)
  if (validationGeneration[field] !== generation)
    return errors.length === 0
  fieldErrors[field] = errors
  return errors.length === 0
}

async function validateRequestedFields(fields: readonly string[]): Promise<boolean> {
  const targets = [...new Set(fields)]
  const values = currentValidationValues()
  const result = await validateFields(targets, values)
  for (const field of targets)
    fieldErrors[field] = withRequiredError(field, result[field] ?? [], values)
  return targets.every(field => fieldErrors[field]?.length === 0)
}

async function runTrigger(trigger: FlowTrigger): Promise<void> {
  const snapshot = { ...model }
  try {
    const result = await runFlows(trigger, snapshot, flowLifecycle.signal)
    if (result.status === 'aborted' || result.status === 'ignored' || result.status === 'noop')
      return
    if (result.status === 'failure' || result.status === 'timeout') {
      submitted.value = result.error ?? 'Flow execution failed.'
      return
    }
    applyFlowValuePatch(model, snapshot, result.values)
    applyRuntimeProjection()
    if (result.error)
      submitted.value = result.error
  }
  catch (error) {
    submitted.value = error instanceof Error ? error.message : String(error)
  }
}

function runFieldChange(field: string): void {
  applyRuntimeProjection()
  void validateOn(field, 'change')
}

async function runNodeEvent(nodeId: string, eventName: string, payload: unknown): Promise<void> {
  const actions = nodeEvents[nodeId]?.[eventName] ?? []
  for (const action of actions) {
    try {
      const input = Object.hasOwn(action, 'input') ? action.input : payload
      await invokeRegisteredAction(action.action, input, {
        eventName,
        nodeId,
        signal: flowLifecycle.signal,
        values: { ...model },
      })
    }
    catch (error) {
      submitted.value = error instanceof Error ? error.message : String(error)
      return
    }
  }
  await runTrigger({ kind: 'component.event', nodeId, event: eventName })
}

function handleFieldUpdate(nodeId: string, field: string, eventName: string, payload: unknown): void {
  runFieldChange(field)
  void runNodeEvent(nodeId, eventName, payload)
}

function handleFieldBlur(nodeId: string, field: string, eventName: string, payload: unknown): void {
  void validateOn(field, 'blur')
  void runNodeEvent(nodeId, eventName, payload)
}

async function handleSubmit(): Promise<void> {
  applyRuntimeProjection()
  const fields = [...new Set([...Object.keys(fieldValidation), ...flowValidation.value])]
  if (!await validateRequestedFields(fields)) {
    submitted.value = ''
    return
  }
  submitted.value = JSON.stringify(model, null, 2)
  void runTrigger({ kind: 'form.submit' })
}

onMounted(() => {
  applyRuntimeProjection()
  void runTrigger({ kind: 'page.mount' })
})
onBeforeUnmount(() => flowLifecycle.abort('page-unmounted'))
</script>

<template>
  <main class="source-page">
    <header class="source-header">
      <p class="source-kicker">Generated Vue page</p>
      <h1>${escapeHtml(page.name)}</h1>
      <p>Standalone source generated from the committed design model.</p>
    </header>
    <form class="source-form" @submit.prevent="handleSubmit">
      <div class="source-grid" data-label-position="${page.form.labelPosition ?? 'left'}" style="${sourceFormStyle(layouts, page.form)}">
${renderNodes(page.root, layouts, registry)}
      </div>
      <button class="source-submit" type="submit">Save</button>
    </form>
      <p v-if="flowValidation.length" class="source-validation" role="status">Validation requested for: {{ flowValidation.join(', ') }}</p>
      <pre v-if="submitted" class="source-result" aria-live="polite">{{ submitted }}</pre>
  </main>
</template>
`
}
