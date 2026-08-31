import type { ConfigFormReactionCondition } from '@moluoxixi/config-form-core'
import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form/renderer'
import type {
  CompiledRuleSet,
  RuleCompileContext,
  RuleDiagnostic,
  RuleSet,
} from '@moluoxixi/zod3-to-rule'
import type {
  CanonicalRuntimeFieldNode,
  CanonicalRuntimeNode,
  CanonicalRuntimePage,
  CompileCanonicalPageRuntimeInput,
  VueRuntimeBindingResolver,
  VueRuntimeCompileResult,
  VueRuntimeComponentBinding,
  VueRuntimeDiagnostic,
  VueRuntimeRendererConfig,
} from './types'
import { evaluateConfigFormReactionCondition } from '@moluoxixi/config-form-core'
import { compileRules, RuleCompileError } from '@moluoxixi/zod3-to-rule'

type CanonicalRuntimeCondition = NonNullable<
  NonNullable<CanonicalRuntimeNode['conditions']>[keyof NonNullable<CanonicalRuntimeNode['conditions']>]
>

interface RuntimeNodeFragmentCacheEntry {
  diagnostics: readonly VueRuntimeDiagnostic[]
  flowEventsKey: string
  node: ConfigFormRendererNode
}

const runtimeNodeFragmentCaches = new WeakMap<
  VueRuntimeBindingResolver,
  WeakMap<object, RuntimeNodeFragmentCacheEntry>
>()

function diagnostic(
  code: string,
  message: string,
  path: Array<string | number>,
  nodeId?: string,
  severity: VueRuntimeDiagnostic['severity'] = 'error',
): VueRuntimeDiagnostic {
  return {
    code,
    message,
    path,
    severity,
    ...(nodeId ? { nodeId } : {}),
  }
}

function hasErrors(diagnostics: VueRuntimeDiagnostic[]): boolean {
  return diagnostics.some(item => item.severity === 'error')
}

function compileCondition(condition: CanonicalRuntimeCondition) {
  const executable = structuredClone(condition) as ConfigFormReactionCondition
  return (values: Record<string, unknown>): boolean => (
    evaluateConfigFormReactionCondition(executable, values)
  )
}

function createRuleContext(
  ruleSet: RuleSet,
  resolver: VueRuntimeBindingResolver,
): RuleCompileContext {
  const custom: RuleCompileContext['custom'] = {}
  for (const rule of ruleSet.rules) {
    if (rule.kind !== 'custom')
      continue
    const validator = resolver.resolveValidator?.(rule.key)
    if (validator)
      custom[rule.key] = validator
  }
  return { custom }
}

function ruleDiagnostic(
  source: RuleDiagnostic,
  path: Array<string | number>,
  nodeId: string,
): VueRuntimeDiagnostic {
  return diagnostic(
    source.code,
    source.message,
    [...path, 'validation', ...source.path],
    nodeId,
    source.severity,
  )
}

function compileValidation(
  node: CanonicalRuntimeFieldNode,
  path: Array<string | number>,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
): CompiledRuleSet | undefined {
  if (!node.validation)
    return undefined

  const ruleSet = structuredClone(node.validation) as RuleSet
  try {
    const compiled = compileRules(ruleSet, createRuleContext(ruleSet, resolver))
    diagnostics.push(...compiled.diagnostics.map(item => ruleDiagnostic(item, path, node.id)))
    return compiled
  }
  catch (error) {
    if (!(error instanceof RuleCompileError))
      throw error
    diagnostics.push(...error.diagnostics.map(item => ruleDiagnostic(item, path, node.id)))
    return undefined
  }
}

function diagnoseDefaultRules(
  node: CanonicalRuntimeFieldNode,
  path: Array<string | number>,
  validation: CompiledRuleSet | undefined,
  diagnostics: VueRuntimeDiagnostic[],
): void {
  if (node.defaultValue === undefined)
    return

  const required = node.validation?.rules.some(rule => rule.kind === 'required')
    || (node.conditions?.required?.kind === 'literal' && node.conditions.required.value)
  if (node.defaultValue === null && required) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_DEFAULT_REQUIRED_NULL',
      'A required field cannot use null as its default value.',
      [...path, 'defaultValue'],
      node.id,
    ))
    return
  }

  if (!node.validation || !validation)
    return

  const candidate = node.validation.base.type === 'date' && typeof node.defaultValue === 'string'
    ? new Date(node.defaultValue)
    : node.defaultValue
  const result = validation.schema.safeParse(candidate)
  if (!result.success) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_DEFAULT_RULE_INVALID',
      result.error.issues[0]?.message ?? 'Default value does not satisfy the field rules.',
      [...path, 'defaultValue'],
      node.id,
    ))
  }
}

function cloneNodeMetadata(
  node: CanonicalRuntimeNode,
  runtimeFlowEvents: readonly string[] = [],
): Record<string, unknown> | undefined {
  const lowCodeMetadata = {
    ...(Object.keys(node.events).length > 0 ? { events: structuredClone(node.events) } : {}),
    ...(Object.keys(node.bindings).length > 0 ? { bindings: structuredClone(node.bindings) } : {}),
    ...(runtimeFlowEvents.length > 0 ? { flowEvents: [...runtimeFlowEvents] } : {}),
  }
  const extensions = {
    ...(node.extensions ? structuredClone(node.extensions) : {}),
    ...(Object.keys(lowCodeMetadata).length > 0 ? { 'mx.low-code': lowCodeMetadata } : {}),
  }
  return Object.keys(extensions).length > 0 ? extensions : undefined
}

function compileNodeBase(
  node: CanonicalRuntimeNode,
  binding: VueRuntimeComponentBinding,
  runtimeFlowEvents?: readonly string[],
) {
  const span = node.placement.props.span
  const extensions = cloneNodeMetadata(node, runtimeFlowEvents)
  return {
    id: node.id,
    component: binding.component,
    props: structuredClone(node.props) as Record<string, unknown>,
    ...(extensions ? { extensions } : {}),
    ...(node.reactions
      ? { reactions: structuredClone(node.reactions) as ConfigFormRendererNode['reactions'] }
      : {}),
    ...(typeof span === 'number' ? { span } : {}),
    ...(node.conditions?.visible ? { visible: compileCondition(node.conditions.visible) } : {}),
    ...(node.conditions?.hidden ? { hidden: compileCondition(node.conditions.hidden) } : {}),
  }
}

function compileField(
  node: CanonicalRuntimeFieldNode,
  binding: VueRuntimeComponentBinding,
  path: Array<string | number>,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
  runtimeFlowEvents?: readonly string[],
): ConfigFormRendererField {
  const validation = compileValidation(node, path, resolver, diagnostics)
  diagnoseDefaultRules(node, path, validation, diagnostics)
  const required = node.conditions?.required
    ? compileCondition(node.conditions.required)
    : validation?.required

  return {
    ...compileNodeBase(node, binding, runtimeFlowEvents),
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined
      ? {}
      : { defaultValue: structuredClone(node.defaultValue) }),
    ...(node.validateOn === undefined
      ? {}
      : { validateOn: [...(Array.isArray(node.validateOn) ? node.validateOn : [node.validateOn])] }),
    ...(required === undefined ? {} : { required }),
    ...(validation?.requiredMessage === undefined
      ? {}
      : { requiredMessage: validation.requiredMessage }),
    ...(validation ? { schema: validation.schema } : {}),
    ...(validation?.validator ? { validator: validation.validator } : {}),
    ...(node.conditions?.disabled ? { disabled: compileCondition(node.conditions.disabled) } : {}),
    ...(node.conditions?.readonly ? { readonly: compileCondition(node.conditions.readonly) } : {}),
    ...(binding.valueProp ? { valueProp: binding.valueProp } : {}),
    ...(binding.trigger ? { trigger: binding.trigger } : {}),
    ...(binding.blurTrigger ? { blurTrigger: binding.blurTrigger } : {}),
    ...(binding.readonlyRender
      ? {
          readonlyRender: ({ componentProps, model, value }) => binding.readonlyRender!({
            componentProps,
            model,
            node,
            value,
          }),
        }
      : {}),
    ...(binding.getValueFromEvent ? { getValueFromEvent: binding.getValueFromEvent } : {}),
  }
}

function compileNode(
  page: CanonicalRuntimePage,
  nodeId: string,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
  expected: { parentId: string | null, slot: string | null },
  ancestors: ReadonlySet<string>,
): ConfigFormRendererNode | undefined {
  const path = ['nodesById', nodeId]
  const node = page.nodesById[nodeId]
  if (!node) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_IR_NODE_UNKNOWN',
      `Canonical page references an unknown node: ${nodeId}`,
      path,
      nodeId,
    ))
    return undefined
  }
  if (ancestors.has(nodeId)) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_IR_CYCLE',
      `Canonical page contains a node cycle at ${nodeId}.`,
      path,
      nodeId,
    ))
    return undefined
  }
  if (
    node.placement.parentId !== expected.parentId
    || node.placement.slot !== expected.slot
  ) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_IR_PLACEMENT_MISMATCH',
      `Canonical placement does not match the rendered relation for node ${nodeId}.`,
      [...path, 'placement'],
      nodeId,
    ))
    return undefined
  }
  const nodeFlowEvents = node.flowEvents
  const flowEventsKey = (nodeFlowEvents ?? []).join('\u0000')
  const fragmentCache = runtimeNodeFragmentCaches.get(resolver)
    ?? new WeakMap<object, RuntimeNodeFragmentCacheEntry>()
  if (!runtimeNodeFragmentCaches.has(resolver))
    runtimeNodeFragmentCaches.set(resolver, fragmentCache)
  const cached = fragmentCache.get(node as object)
  if (cached && cached.flowEventsKey === flowEventsKey) {
    diagnostics.push(...cached.diagnostics)
    return cached.node
  }
  const diagnosticStart = diagnostics.length

  const binding = resolver.resolveBinding(node.component)
  if (!binding) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_BINDING_UNAVAILABLE',
      `Vue Runtime binding is unavailable for component ${node.component}.`,
      [...path, 'component'],
      nodeId,
    ))
    return undefined
  }
  if (binding.kind !== node.kind) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_BINDING_KIND_MISMATCH',
      `Vue Runtime binding ${node.component} does not support node kind ${node.kind}.`,
      [...path, 'kind'],
      nodeId,
    ))
    return undefined
  }
  if (
    binding.contractVersion !== node.componentVersion
    || binding.contractFingerprint !== node.componentFingerprint
  ) {
    diagnostics.push(diagnostic(
      'VUE_RUNTIME_BINDING_IDENTITY_MISMATCH',
      `Vue Runtime binding identity does not match Canonical IR for component ${node.component}.`,
      [...path, 'componentFingerprint'],
      nodeId,
    ))
    return undefined
  }

  if (node.kind === 'field') {
    const compiled = compileField(node, binding, path, resolver, diagnostics, nodeFlowEvents)
    if (!hasErrors(diagnostics.slice(diagnosticStart))) {
      fragmentCache.set(node as object, {
        diagnostics: diagnostics.slice(diagnosticStart),
        flowEventsKey,
        node: compiled,
      })
    }
    return compiled
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(nodeId)
  const slots = Object.fromEntries(Object.entries(node.slots).map(([slotName, childIds]) => [
    slotName,
    childIds.flatMap((childId) => {
      const child = compileNode(page, childId, resolver, diagnostics, {
        parentId: node.id,
        slot: slotName,
      }, nextAncestors)
      return child ? [child] : []
    }),
  ]))
  const compiled = {
    ...compileNodeBase(node, binding, nodeFlowEvents),
    slots,
  }
  if (!hasErrors(diagnostics.slice(diagnosticStart))) {
    fragmentCache.set(node as object, {
      diagnostics: diagnostics.slice(diagnosticStart),
      flowEventsKey,
      node: compiled,
    })
  }
  return compiled
}

function rendererConfig(
  page: CanonicalRuntimePage,
  fields: ConfigFormRendererNode[],
  resolver: VueRuntimeBindingResolver,
): VueRuntimeRendererConfig {
  const form = page.form
  return {
    ...(resolver.components ? { components: resolver.components } : {}),
    fields,
    ...(form.readonly === undefined ? {} : { readonly: form.readonly }),
    ...(form.inline === undefined ? {} : { inline: form.inline }),
    ...(form.columns === undefined ? {} : { columns: form.columns }),
    ...(form.gap === undefined ? {} : { gap: form.gap }),
    ...(form.fieldSpan === undefined ? {} : { fieldSpan: form.fieldSpan }),
    ...(form.labelPosition === undefined ? {} : { labelPosition: form.labelPosition }),
    ...(form.responsive === undefined
      ? {}
      : { responsive: structuredClone(form.responsive) as ConfigFormResponsiveLayout }),
  }
}

/** Bind framework-neutral Canonical IR to the shared Vue RuntimeSurface contract. */
export function compileCanonicalPageRuntime(
  input: CompileCanonicalPageRuntimeInput,
  resolver: VueRuntimeBindingResolver,
): VueRuntimeCompileResult {
  const { compilation } = input
  const pageScoped = 'page' in compilation
  const pageId = pageScoped ? compilation.key.pageId : input.pageId
  if (!pageId) {
    return {
      success: false,
      diagnostics: [diagnostic(
        'VUE_RUNTIME_PAGE_ID_REQUIRED',
        'ProjectCompilation runtime input requires a page id.',
        ['pageId'],
      )],
    }
  }
  const page = pageScoped ? compilation.page : compilation.ir.pagesById[pageId]
  if (!page) {
    return {
      success: false,
      diagnostics: [diagnostic(
        'VUE_RUNTIME_IR_PAGE_UNKNOWN',
        `Canonical project does not contain page: ${pageId}`,
        ['pagesById', pageId],
      )],
    }
  }

  const diagnostics: VueRuntimeDiagnostic[] = []
  const fields = page.rootIds.flatMap((nodeId) => {
    const compiled = compileNode(page, nodeId, resolver, diagnostics, {
      parentId: null,
      slot: null,
    }, new Set())
    return compiled ? [compiled] : []
  })
  if (hasErrors(diagnostics))
    return { success: false, diagnostics }

  const compilationKey = Object.freeze({ ...compilation.key })
  const plan = Object.freeze({
    renderer: rendererConfig(page, fields, resolver),
  })
  return {
    success: true,
    artifact: Object.freeze({ compilationKey, pageId: page.id, plan }),
    diagnostics,
  }
}
