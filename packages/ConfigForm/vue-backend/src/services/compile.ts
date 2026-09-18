import type {
  ConfigFormPageRuntimeOptionBinding,
  ConfigFormPageRuntimePlan,
  ConfigFormRendererField,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form'
import type { ConfigFormReactionCondition } from '@moluoxixi/config-form-core'
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
} from '../types'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
  hasOnlyCurrentCanonicalPageKeys,
} from '@moluoxixi/config-form-compiler'
import { evaluateConfigFormReactionCondition } from '@moluoxixi/config-form-core'
import { compileRules, RuleCompileError } from '@moluoxixi/zod3-to-rule'
import { getRuntimeNodeFragmentCache } from '../state'
import { createVueRuntimeDiagnostic, hasVueRuntimeErrors } from '../utils'

type CanonicalRuntimeCondition = NonNullable<
  NonNullable<CanonicalRuntimeNode['conditions']>[keyof NonNullable<CanonicalRuntimeNode['conditions']>]
>

function compilationContractDiagnostics(
  compilation: CompileCanonicalPageRuntimeInput['compilation'],
): VueRuntimeDiagnostic[] {
  const pageScoped = 'page' in compilation
  const irVersion = pageScoped ? compilation.key.irVersion : compilation.ir.version
  const diagnostics: VueRuntimeDiagnostic[] = []
  if (irVersion !== CANONICAL_PROJECT_IR_VERSION) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_VERSION_UNSUPPORTED',
      `Unsupported Canonical IR version: ${String(irVersion)}. Expected ${CANONICAL_PROJECT_IR_VERSION}.`,
      pageScoped ? ['key', 'irVersion'] : ['ir', 'version'],
    ))
  }
  const compilerVersions = [
    { path: ['key', 'compilerVersion'], value: compilation.key.compilerVersion },
    ...(!pageScoped
      ? [{ path: ['ir', 'identity', 'compilerVersion'], value: compilation.ir.identity.compilerVersion }]
      : []),
  ]
  for (const { path, value } of compilerVersions) {
    if (value !== CONFIG_FORM_COMPILER_VERSION) {
      diagnostics.push(createVueRuntimeDiagnostic(
        'VUE_RUNTIME_COMPILER_VERSION_UNSUPPORTED',
        `Unsupported compiler version: ${String(value)}. Expected ${CONFIG_FORM_COMPILER_VERSION}.`,
        path,
      ))
    }
  }
  const pages = pageScoped
    ? [{ page: compilation.page, path: ['page'] }]
    : Object.entries(compilation.ir.pagesById).map(([pageId, page]) => ({
        page,
        path: ['ir', 'pagesById', pageId],
      }))
  for (const { page, path } of pages) {
    if (!hasOnlyCurrentCanonicalPageKeys(page)) {
      diagnostics.push(createVueRuntimeDiagnostic(
        'VUE_RUNTIME_IR_SHAPE_UNSUPPORTED',
        'Canonical page contains fields outside the current IR contract.',
        path,
      ))
    }
  }
  return diagnostics
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
  return createVueRuntimeDiagnostic(
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
    diagnostics.push(createVueRuntimeDiagnostic(
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
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_DEFAULT_RULE_INVALID',
      result.error.issues[0]?.message ?? 'Default value does not satisfy the field rules.',
      [...path, 'defaultValue'],
      node.id,
    ))
  }
}

function cloneNodeMetadata(
  node: CanonicalRuntimeNode,
): Record<string, unknown> | undefined {
  const lowCodeMetadata = {
    ...(Object.keys(node.bindings).length > 0 ? { bindings: structuredClone(node.bindings) } : {}),
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
) {
  const span = node.placement.props.span
  const extensions = cloneNodeMetadata(node)
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
): ConfigFormRendererField {
  const validation = compileValidation(node, path, resolver, diagnostics)
  diagnoseDefaultRules(node, path, validation, diagnostics)
  const required = node.conditions?.required
    ? compileCondition(node.conditions.required)
    : validation?.required

  return {
    ...compileNodeBase(node, binding),
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined
      ? {}
      : { defaultValue: structuredClone(node.defaultValue) }),
    validateOn: [...node.validateOn],
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
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_NODE_UNKNOWN',
      `Canonical page references an unknown node: ${nodeId}`,
      path,
      nodeId,
    ))
    return undefined
  }
  if (ancestors.has(nodeId)) {
    diagnostics.push(createVueRuntimeDiagnostic(
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
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_PLACEMENT_MISMATCH',
      `Canonical placement does not match the rendered relation for node ${nodeId}.`,
      [...path, 'placement'],
      nodeId,
    ))
    return undefined
  }
  const fragmentCache = getRuntimeNodeFragmentCache(resolver)
  const cached = fragmentCache.get(node as object)
  if (cached) {
    diagnostics.push(...cached.diagnostics)
    return cached.node
  }
  const diagnosticStart = diagnostics.length

  const binding = resolver.resolveBinding(node.component)
  if (!binding) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_BINDING_UNAVAILABLE',
      `Vue Runtime binding is unavailable for component ${node.component}.`,
      [...path, 'component'],
      nodeId,
    ))
    return undefined
  }
  if (binding.kind !== node.kind) {
    diagnostics.push(createVueRuntimeDiagnostic(
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
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_BINDING_IDENTITY_MISMATCH',
      `Vue Runtime binding identity does not match Canonical IR for component ${node.component}.`,
      [...path, 'componentFingerprint'],
      nodeId,
    ))
    return undefined
  }

  if (node.kind === 'field') {
    const compiled = compileField(node, binding, path, resolver, diagnostics)
    if (!hasVueRuntimeErrors(diagnostics.slice(diagnosticStart))) {
      fragmentCache.set(node as object, {
        diagnostics: diagnostics.slice(diagnosticStart),
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
    ...compileNodeBase(node, binding),
    ...(node.valueScope === undefined ? {} : { valueScope: structuredClone(node.valueScope) }),
    slots,
  }
  if (!hasVueRuntimeErrors(diagnostics.slice(diagnosticStart))) {
    fragmentCache.set(node as object, {
      diagnostics: diagnostics.slice(diagnosticStart),
      node: compiled,
    })
  }
  return compiled
}

function pageRuntimePlan(page: CanonicalRuntimePage): ConfigFormPageRuntimePlan {
  const optionBindings: ConfigFormPageRuntimeOptionBinding[] = Object.values(page.nodesById)
    .flatMap(node => node.kind === 'field' && node.optionSource
      ? [{ nodeId: node.id, source: structuredClone(node.optionSource) as ConfigFormPageRuntimeOptionBinding['source'] }]
      : [])
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
  return Object.freeze({
    optionBindings: Object.freeze(optionBindings),
    runtime: Object.freeze(structuredClone(page.runtime ?? { dataSources: [], variables: [] })),
    valueSchema: Object.freeze({
      scopedFields: Object.freeze(structuredClone(page.scopedFields)),
      valueScopes: Object.freeze(structuredClone(page.valueScopes)),
    }),
  })
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
    plan: pageRuntimePlan(page),
    ...(form.readonly === undefined ? {} : { readonly: form.readonly }),
    ...(form.inline === undefined ? {} : { inline: form.inline }),
    ...(form.columns === undefined ? {} : { columns: form.columns }),
    ...(form.gap === undefined ? {} : { gap: form.gap }),
    ...(form.fieldSpan === undefined ? {} : { fieldSpan: form.fieldSpan }),
    ...(form.labelPosition === undefined ? {} : { labelPosition: form.labelPosition }),
    ...(form.labelWidth === undefined ? {} : { labelWidth: form.labelWidth }),
    ...(form.responsive === undefined
      ? {}
      : { responsive: structuredClone(form.responsive) as ConfigFormResponsiveLayout }),
  }
}

/** Bind framework-neutral Canonical IR to the shared Vue renderer contract. */
export function compileCanonicalPageRuntime(
  input: CompileCanonicalPageRuntimeInput,
  resolver: VueRuntimeBindingResolver,
): VueRuntimeCompileResult {
  const { compilation } = input
  const contractDiagnostics = compilationContractDiagnostics(compilation)
  if (contractDiagnostics.length > 0)
    return { success: false, diagnostics: contractDiagnostics }

  const pageScoped = 'page' in compilation
  const pageId = pageScoped ? compilation.key.pageId : input.pageId
  if (!pageId) {
    return {
      success: false,
      diagnostics: [createVueRuntimeDiagnostic(
        'VUE_RUNTIME_PAGE_ID_REQUIRED',
        'ProjectCompilation runtime input requires a page id.',
        ['pageId'],
      )],
    }
  }
  const page = (pageScoped ? compilation.page : compilation.ir.pagesById[pageId]) as CanonicalRuntimePage | undefined
  if (!page) {
    return {
      success: false,
      diagnostics: [createVueRuntimeDiagnostic(
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
  if (hasVueRuntimeErrors(diagnostics))
    return { success: false, diagnostics }

  const compilationKey = Object.freeze({ ...compilation.key })
  const renderer = Object.freeze(rendererConfig(page, fields, resolver))
  return {
    success: true,
    artifact: Object.freeze({ compilationKey, pageId: page.id, renderer }),
    diagnostics,
  }
}
