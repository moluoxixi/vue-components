import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
  ConfigFormSurfaceRuntimePlan,
} from '@moluoxixi/config-form'
import type {
  CompiledRuleSet,
  RuleCompileContext,
  RuleDiagnostic,
  RuleSet,
} from '@moluoxixi/zod3-to-rule'
import type {
  CanonicalRuntimeElementNode,
  CanonicalRuntimeFieldNode,
  CanonicalRuntimeNode,
  CanonicalRuntimeSurface,
  CompileCanonicalSurfaceRuntimeInput,
  VueRuntimeBindingResolver,
  VueRuntimeCompileResult,
  VueRuntimeComponentBinding,
  VueRuntimeDiagnostic,
  VueRuntimeRendererConfig,
} from '../types'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
  hasOnlyCurrentCanonicalSurfaceKeys,
} from '@moluoxixi/config-form-compiler'
import {
  compileRules,
  parseRuleSet,
  RuleCompileError,
  rulesToZod,
} from '@moluoxixi/zod3-to-rule'
import { getRuntimeNodeFragmentCache } from '../state'
import { createVueRuntimeDiagnostic, hasVueRuntimeErrors } from '../utils'

function compilationContractDiagnostics(
  compilation: CompileCanonicalSurfaceRuntimeInput['compilation'],
): VueRuntimeDiagnostic[] {
  const surfaceScoped = 'surface' in compilation
  const irVersion = surfaceScoped ? compilation.key.irVersion : compilation.ir.version
  const diagnostics: VueRuntimeDiagnostic[] = []
  if (irVersion !== CANONICAL_PROJECT_IR_VERSION) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_VERSION_UNSUPPORTED',
      `Unsupported Canonical IR version: ${String(irVersion)}. Expected ${CANONICAL_PROJECT_IR_VERSION}.`,
      surfaceScoped ? ['key', 'irVersion'] : ['ir', 'version'],
    ))
  }

  const compilerVersions = [
    { path: ['key', 'compilerVersion'], value: compilation.key.compilerVersion },
    ...(!surfaceScoped
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

  const surfaces = surfaceScoped
    ? [{ surface: compilation.surface, path: ['surface'] }]
    : Object.entries(compilation.ir.surfacesById).map(([surfaceId, surface]) => ({
        surface,
        path: ['ir', 'surfacesById', surfaceId],
      }))
  for (const { surface, path } of surfaces) {
    if (!hasOnlyCurrentCanonicalSurfaceKeys(surface)) {
      diagnostics.push(createVueRuntimeDiagnostic(
        'VUE_RUNTIME_IR_SHAPE_UNSUPPORTED',
        'Canonical Surface contains fields outside the current IR contract.',
        path,
      ))
    }
  }
  return diagnostics
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

interface CompiledFieldValidation {
  compiled: CompiledRuleSet
  ruleSet: RuleSet
}

function compileValidation(
  node: CanonicalRuntimeFieldNode,
  path: Array<string | number>,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
): CompiledFieldValidation | undefined {
  if (!node.validation)
    return undefined

  const parsed = parseRuleSet(structuredClone(node.validation))
  if (!parsed.success) {
    diagnostics.push(...parsed.diagnostics.map(item => ruleDiagnostic(item, path, node.id)))
    return undefined
  }
  const ruleSet = parsed.data
  try {
    const compiled = compileRules(ruleSet, createRuleContext(ruleSet, resolver))
    diagnostics.push(...compiled.diagnostics.map(item => ruleDiagnostic(item, path, node.id)))
    return { compiled, ruleSet }
  }
  catch (error) {
    if (!(error instanceof RuleCompileError))
      throw error
    diagnostics.push(...error.diagnostics.map(item => ruleDiagnostic(item, path, node.id)))
    return undefined
  }
}

function diagnoseDefaultBase(
  node: CanonicalRuntimeFieldNode,
  path: Array<string | number>,
  validation: CompiledFieldValidation | undefined,
  diagnostics: VueRuntimeDiagnostic[],
): void {
  if (node.defaultValue === undefined || !validation)
    return

  const result = rulesToZod({
    ...validation.ruleSet,
    rules: [],
  }).safeParse(node.defaultValue)
  if (!result.success) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_DEFAULT_BASE_INVALID',
      result.error.issues[0]?.message ?? 'Default value does not satisfy the field base type.',
      [...path, 'defaultValue'],
      node.id,
    ))
  }
}

function cloneNodeMetadata(
  node: CanonicalRuntimeNode,
): Record<string, unknown> | undefined {
  if (!node.extensions)
    return undefined
  const extensions = structuredClone(node.extensions) as Record<string, unknown>
  return Object.keys(extensions).length > 0 ? extensions : undefined
}

function compileNodeBase(
  node: CanonicalRuntimeNode,
  binding: VueRuntimeComponentBinding,
): Record<string, unknown> {
  const span = node.placement.props.span
  const extensions = cloneNodeMetadata(node)
  return {
    id: node.id,
    component: binding.component,
    props: structuredClone(node.props) as Record<string, unknown>,
    ...(extensions ? { extensions } : {}),
    ...(typeof span === 'number' ? { span } : {}),
  }
}

function compileField(
  node: CanonicalRuntimeFieldNode,
  binding: VueRuntimeComponentBinding,
  path: Array<string | number>,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
): ConfigFormRendererField {
  const validationResult = compileValidation(node, path, resolver, diagnostics)
  diagnoseDefaultBase(node, path, validationResult, diagnostics)
  const validation = validationResult?.compiled
  return {
    ...compileNodeBase(node, binding),
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined
      ? {}
      : { defaultValue: structuredClone(node.defaultValue) }),
    validateOn: [...node.validateOn],
    ...(node.required === undefined ? {} : { required: node.required }),
    ...(node.requiredMessage === undefined
      ? {}
      : { requiredMessage: node.requiredMessage }),
    ...(validation ? { schema: validation.schema } : {}),
    ...(validation?.validator ? { validator: validation.validator } : {}),
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
  } as ConfigFormRendererField
}

function compileElement(
  node: CanonicalRuntimeElementNode,
  binding: VueRuntimeComponentBinding,
): ConfigFormRendererNode {
  return compileNodeBase(node, binding) as unknown as ConfigFormRendererNode
}

function compileNode(
  surface: CanonicalRuntimeSurface,
  nodeId: string,
  resolver: VueRuntimeBindingResolver,
  diagnostics: VueRuntimeDiagnostic[],
  expected: { parentId: string | null, slot: string | null },
  ancestors: ReadonlySet<string>,
): ConfigFormRendererNode | undefined {
  const path = ['nodesById', nodeId]
  const node = surface.nodesById[nodeId]
  if (!node) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_NODE_UNKNOWN',
      `Canonical Surface references an unknown node: ${nodeId}`,
      path,
      nodeId,
    ))
    return undefined
  }
  if (ancestors.has(nodeId)) {
    diagnostics.push(createVueRuntimeDiagnostic(
      'VUE_RUNTIME_IR_CYCLE',
      `Canonical Surface contains a node cycle at ${nodeId}.`,
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

  let compiled: ConfigFormRendererNode
  if (node.kind === 'field') {
    compiled = compileField(node, binding, path, resolver, diagnostics)
  }
  else if (node.kind === 'element') {
    compiled = compileElement(node, binding)
  }
  else {
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(node.id)
    compiled = {
      ...compileNodeBase(node, binding),
      ...(node.valueScope === undefined ? {} : { valueScope: structuredClone(node.valueScope) }),
      slots: Object.fromEntries(Object.entries(node.slots).map(([slotName, childIds]) => [
        slotName,
        childIds.flatMap((childId) => {
          const child = compileNode(surface, childId, resolver, diagnostics, {
            parentId: node.id,
            slot: slotName,
          }, nextAncestors)
          return child ? [child] : []
        }),
      ])),
    } as unknown as ConfigFormRendererNode
  }

  if (!hasVueRuntimeErrors(diagnostics.slice(diagnosticStart))) {
    fragmentCache.set(node as object, {
      diagnostics: diagnostics.slice(diagnosticStart),
      node: compiled,
    })
  }
  return compiled
}

function surfaceRuntimePlan(surface: CanonicalRuntimeSurface): ConfigFormSurfaceRuntimePlan {
  return Object.freeze({
    optionBindings: Object.freeze([]),
    runtime: Object.freeze({
      dataSources: Object.freeze([]),
      variables: Object.freeze([]),
    }),
    valueSchema: Object.freeze({
      scopedFields: Object.freeze(structuredClone(surface.scopedFields)),
      valueScopes: Object.freeze(structuredClone(surface.valueScopes)),
    }),
  })
}

function rendererConfig(
  surface: CanonicalRuntimeSurface,
  fields: ConfigFormRendererNode[],
  resolver: VueRuntimeBindingResolver,
): VueRuntimeRendererConfig {
  const form = surface.form
  return {
    ...(resolver.components ? { components: resolver.components } : {}),
    fields,
    plan: surfaceRuntimePlan(surface),
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

/** Bind framework-neutral Canonical Surface IR to the shared Vue renderer contract. */
export function compileCanonicalSurfaceRuntime(
  input: CompileCanonicalSurfaceRuntimeInput,
  resolver: VueRuntimeBindingResolver,
): VueRuntimeCompileResult {
  const { compilation } = input
  const contractDiagnostics = compilationContractDiagnostics(compilation)
  if (contractDiagnostics.length > 0)
    return { success: false, diagnostics: contractDiagnostics }

  const surfaceScoped = 'surface' in compilation
  const surfaceId = surfaceScoped ? compilation.key.surfaceId : input.surfaceId
  if (!surfaceId) {
    return {
      success: false,
      diagnostics: [createVueRuntimeDiagnostic(
        'VUE_RUNTIME_SURFACE_ID_REQUIRED',
        'ProjectCompilation runtime input requires a surface id.',
        ['surfaceId'],
      )],
    }
  }

  const surface = (surfaceScoped
    ? compilation.surface
    : compilation.ir.surfacesById[surfaceId]) as unknown as CanonicalRuntimeSurface | undefined
  if (!surface) {
    return {
      success: false,
      diagnostics: [createVueRuntimeDiagnostic(
        'VUE_RUNTIME_IR_SURFACE_UNKNOWN',
        `Canonical project does not contain Surface: ${surfaceId}`,
        ['surfacesById', surfaceId],
      )],
    }
  }

  const diagnostics: VueRuntimeDiagnostic[] = []
  const fields = surface.rootIds.flatMap((nodeId) => {
    const compiled = compileNode(surface, nodeId, resolver, diagnostics, {
      parentId: null,
      slot: null,
    }, new Set())
    return compiled ? [compiled] : []
  })
  if (hasVueRuntimeErrors(diagnostics))
    return { success: false, diagnostics }

  const compilationKey = Object.freeze({ ...compilation.key })
  const renderer = Object.freeze(rendererConfig(surface, fields, resolver))
  const artifact = {
    compilationKey,
    surfaceId: surface.id,
    kind: surface.kind,
    ...(surface.kind === 'page' ? {} : { presentation: structuredClone(surface.presentation) }),
    renderer,
  }
  return {
    success: true,
    artifact: Object.freeze(artifact),
    diagnostics,
  }
}
