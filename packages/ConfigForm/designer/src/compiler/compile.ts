import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form/renderer'
import type {
  CompiledRuleSet,
  RuleCompileContext,
  RuleCustomValidator,
  RuleDiagnostic,
  RuleSet,
} from '@moluoxixi/zod3-to-rule'
import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerFormSettings,
  DesignerNode,
} from '../document'
import type { LowCodeComponentRegistry, LowCodePageModel } from '../model'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'
import type {
  NormalizedRuntimeContainer,
  NormalizedRuntimeField,
  NormalizedRuntimeNode,
} from './normalized-node'
import type {
  ConfigModelCompileResult,
  DesignerCompileResult,
  DesignerRendererConfig,
} from './types'
import { compileRules, RuleCompileError } from '@moluoxixi/zod3-to-rule'
import { compileDesignerCondition } from '../condition'
import {
  cloneDesignerJsonValue,
  designerDiagnostic,
  hasDesignerErrors,
  parseDesignerDocument,
} from '../document'
import { analyzeConfigModel } from '../model'
import { analyzeDesignerDocument, isDesignerMaterialPlacementAllowed, resolveDesignerDesignPolicy } from '../registry'
import {
  normalizeConfigModelNode,
  normalizeDesignerNode,
  toReadonlyDesignerField,
} from './normalized-node'

type DesignerCompileMode = 'design' | 'runtime'

function resolveMaterialComponent(
  material: DesignerMaterialDefinition,
  mode: DesignerCompileMode,
): ConfigFormRendererNode['component'] {
  if (mode === 'design') {
    const policy = resolveDesignerDesignPolicy(material.designPolicy)
    if (policy.render === 'adapter' && policy.adapter)
      return policy.adapter
  }
  return material.runtime.component
}

function ruleDiagnosticToDesigner(
  diagnostic: RuleDiagnostic,
  path: (string | number)[],
  nodeId: string,
): DesignerDiagnostic {
  return designerDiagnostic(
    diagnostic.code,
    diagnostic.message,
    [...path, 'validation', ...diagnostic.path],
    diagnostic.severity,
    nodeId,
  )
}

function createRuleContext(ruleSet: RuleSet, registry: DesignerRegistry): RuleCompileContext {
  const custom: Record<string, RuleCustomValidator> = {}
  for (const rule of ruleSet.rules) {
    if (rule.kind !== 'custom')
      continue
    const validator = registry.getValidator(rule.key)
    if (validator)
      custom[rule.key] = validator
  }
  return { custom }
}

function compileValidation(
  node: NormalizedRuntimeField,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
): CompiledRuleSet | undefined {
  if (!node.validation)
    return undefined

  try {
    const compiled = compileRules(node.validation, createRuleContext(node.validation, registry))
    diagnostics.push(...compiled.diagnostics.map(diagnostic => ruleDiagnosticToDesigner(diagnostic, path, node.id)))
    return compiled
  }
  catch (error) {
    if (!(error instanceof RuleCompileError))
      throw error
    diagnostics.push(...error.diagnostics.map(diagnostic => ruleDiagnosticToDesigner(diagnostic, path, node.id)))
    return undefined
  }
}

function diagnoseDefaultRules(
  node: NormalizedRuntimeField,
  path: (string | number)[],
  validation: CompiledRuleSet | undefined,
  diagnostics: DesignerDiagnostic[],
): void {
  if (node.defaultValue === undefined)
    return

  const required = node.validation?.rules.some(rule => rule.kind === 'required')
    || (node.conditions?.required?.kind === 'literal' && node.conditions.required.value)
  if (node.defaultValue === null && required) {
    diagnostics.push(designerDiagnostic(
      'DESIGNER_DEFAULT_REQUIRED_NULL',
      'A required field cannot use null as its default value',
      [...path, 'defaultValue'],
      'error',
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
    diagnostics.push(designerDiagnostic(
      'DESIGNER_DEFAULT_RULE_INVALID',
      result.error.issues[0]?.message ?? 'Default value does not satisfy the field rules',
      [...path, 'defaultValue'],
      'error',
      node.id,
    ))
  }
}

function compileNodeBase(node: NormalizedRuntimeNode, component: ConfigFormRendererNode['component']) {
  const lowCodeMetadata = {
    ...(node.events && Object.keys(node.events).length > 0 ? { events: node.events } : {}),
    ...(node.bindings && Object.keys(node.bindings).length > 0 ? { bindings: node.bindings } : {}),
  }
  const extensions = {
    ...(node.extensions ?? {}),
    ...(Object.keys(lowCodeMetadata).length > 0 ? { 'mx.low-code': lowCodeMetadata } : {}),
  }
  return {
    id: node.id,
    component,
    ...(node.props ? { props: cloneDesignerJsonValue(node.props) } : {}),
    ...(Object.keys(extensions).length > 0 ? { extensions: cloneDesignerJsonValue(extensions) } : {}),
    ...(node.reactions
      ? { reactions: cloneDesignerJsonValue(node.reactions as never) }
      : {}),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.conditions?.visible ? { visible: compileDesignerCondition(node.conditions.visible) } : {}),
    ...(node.conditions?.hidden ? { hidden: compileDesignerCondition(node.conditions.hidden) } : {}),
  }
}

function compileField(
  node: NormalizedRuntimeField,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
  mode: DesignerCompileMode,
): ConfigFormRendererField | undefined {
  const material = registry.getMaterial(node.material)
  if (!material || material.kind !== 'field')
    return undefined

  const validation = compileValidation(node, path, registry, diagnostics)
  diagnoseDefaultRules(node, path, validation, diagnostics)
  const required = node.conditions?.required
    ? compileDesignerCondition(node.conditions.required)
    : validation?.required

  return {
    ...compileNodeBase(node, resolveMaterialComponent(material, mode)),
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: cloneDesignerJsonValue(node.defaultValue) }),
    ...(node.validateOn === undefined ? {} : { validateOn: [...(Array.isArray(node.validateOn) ? node.validateOn : [node.validateOn])] }),
    ...(required === undefined ? {} : { required }),
    ...(validation?.requiredMessage === undefined ? {} : { requiredMessage: validation.requiredMessage }),
    ...(validation ? { schema: validation.schema } : {}),
    ...(validation?.validator ? { validator: validation.validator } : {}),
    ...(node.conditions?.disabled ? { disabled: compileDesignerCondition(node.conditions.disabled) } : {}),
    ...(node.conditions?.readonly ? { readonly: compileDesignerCondition(node.conditions.readonly) } : {}),
    ...(material.runtime.valueProp ? { valueProp: material.runtime.valueProp } : {}),
    ...(material.runtime.trigger ? { trigger: material.runtime.trigger } : {}),
    ...(material.runtime.blurTrigger ? { blurTrigger: material.runtime.blurTrigger } : {}),
    ...(material.runtime.readonlyRender
      ? {
          readonlyRender: ({ componentProps, model, value }: {
            componentProps: Record<string, unknown>
            model: Record<string, unknown>
            value: unknown
          }) => material.runtime.readonlyRender!({
            componentProps,
            model,
            node: toReadonlyDesignerField(node),
            value,
          }),
        }
      : {}),
    ...(material.runtime.getValueFromEvent ? { getValueFromEvent: material.runtime.getValueFromEvent } : {}),
  }
}

function compileContainer(
  node: NormalizedRuntimeContainer,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
  mode: DesignerCompileMode,
): ConfigFormRendererNode | undefined {
  const material = registry.getMaterial(node.material)
  if (!material || material.kind !== 'container')
    return undefined

  const slots = Object.fromEntries(
    Object.entries(node.slots).map(([slotName, children]) => [
      slotName,
      children
        .map((child, index) => compileNode(
          child,
          [...path, 'slots', slotName, index],
          registry,
          diagnostics,
          mode,
          node.material,
          slotName,
        ))
        .filter((child): child is ConfigFormRendererNode => child !== undefined),
    ]),
  )

  return {
    ...compileNodeBase(node, resolveMaterialComponent(material, mode)),
    slots,
  }
}

function compileNode(
  node: NormalizedRuntimeNode,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
  mode: DesignerCompileMode,
  parentMaterial?: string,
  parentSlot?: string,
): ConfigFormRendererNode | undefined {
  const material = registry.getMaterial(node.material)
  if (!material || material.kind !== node.kind)
    return undefined
  if (!isDesignerMaterialPlacementAllowed(material, parentMaterial, parentSlot))
    return undefined

  return node.kind === 'field'
    ? compileField(node, path, registry, diagnostics, mode)
    : compileContainer(node, path, registry, diagnostics, mode)
}

/** Compile one designer node through the same renderer contract used by Preview. */
export function compileDesignerNode(
  node: DesignerNode,
  registry: DesignerRegistry,
): ConfigFormRendererNode | undefined {
  const diagnostics: DesignerDiagnostic[] = []
  return compileNode(normalizeDesignerNode(node), ['candidate'], registry, diagnostics, 'design')
}

function rendererConfig(
  form: DesignerFormSettings,
  fields: ConfigFormRendererNode[],
  registry: DesignerRegistry,
): DesignerRendererConfig {
  return {
    components: registry.components,
    fields,
    ...(form.readonly === undefined ? {} : { readonly: form.readonly }),
    ...(form.inline === undefined ? {} : { inline: form.inline }),
    ...(form.columns === undefined ? {} : { columns: form.columns }),
    ...(form.gap === undefined ? {} : { gap: form.gap }),
    ...(form.fieldSpan === undefined ? {} : { fieldSpan: form.fieldSpan }),
    ...(form.labelPosition === undefined ? {} : { labelPosition: form.labelPosition }),
    ...(form.responsive === undefined ? {} : { responsive: cloneResponsiveLayout(form.responsive) }),
  }
}

function cloneResponsiveLayout(responsive: ConfigFormResponsiveLayout): ConfigFormResponsiveLayout {
  return {
    ...(responsive.tablet ? { tablet: { ...responsive.tablet } } : {}),
    ...(responsive.mobile ? { mobile: { ...responsive.mobile } } : {}),
  }
}

/**
 * Build the live Design projection without turning unrelated diagnostics into
 * a blank canvas. Invalid or unknown nodes are omitted individually; Preview
 * and export continue to use compileDesignerDocument's strict result.
 */
export function createDesignerRuntimeProjection(
  document: DesignerDocument,
  registry: DesignerRegistry,
): DesignerRendererConfig {
  const diagnostics: DesignerDiagnostic[] = []
  const fields = document.nodes
    .map((node, index) => compileNode(normalizeDesignerNode(node), ['nodes', index], registry, diagnostics, 'design'))
    .filter((node): node is ConfigFormRendererNode => node !== undefined)
  return rendererConfig(document.form, fields, registry)
}

/** Build the live Design projection directly from the canonical model. */
export function createConfigModelRuntimeProjection(
  model: LowCodePageModel,
  registry: LowCodeComponentRegistry,
): DesignerRendererConfig {
  const diagnostics: DesignerDiagnostic[] = []
  const fields = model.nodes
    .map((node, index) => compileNode(
      normalizeConfigModelNode(node),
      ['nodes', index],
      registry.designer,
      diagnostics,
      'design',
    ))
    .filter((node): node is ConfigFormRendererNode => node !== undefined)
  return rendererConfig(model.form, fields, registry.designer)
}

/**
 * Compile the canonical Config Model directly into the shared RuntimeSurface
 * contract. Normal Preview paths should use this function instead of routing
 * through the legacy DesignerDocument projection.
 */
export function compileConfigModel(
  model: LowCodePageModel,
  registry: LowCodeComponentRegistry,
): ConfigModelCompileResult {
  const designerRegistry = registry.designer
  const diagnostics = analyzeConfigModel(model, registry).map(diagnostic => designerDiagnostic(
    diagnostic.code,
    diagnostic.message,
    [],
    'error',
    diagnostic.nodeId,
  ))
  const fields = model.nodes
    .map((node, index) => compileNode(normalizeConfigModelNode(node), ['nodes', index], designerRegistry, diagnostics, 'runtime'))
    .filter((node): node is ConfigFormRendererNode => node !== undefined)
  if (hasDesignerErrors(diagnostics))
    return { success: false, diagnostics }
  return {
    success: true,
    fields,
    renderer: rendererConfig(model.form, fields, designerRegistry),
    diagnostics,
  }
}

export function compileDesignerDocument(
  input: unknown,
  registry: DesignerRegistry,
): DesignerCompileResult {
  const parsed = parseDesignerDocument(input)
  if (!parsed.success)
    return { success: false, diagnostics: parsed.diagnostics }

  const diagnostics = analyzeDesignerDocument(parsed.data, registry)
  const fields = parsed.data.nodes
    .map((node, index) => compileNode(normalizeDesignerNode(node), ['nodes', index], registry, diagnostics, 'runtime'))
    .filter((node): node is ConfigFormRendererNode => node !== undefined)

  if (hasDesignerErrors(diagnostics)) {
    return {
      success: false,
      document: parsed.data,
      diagnostics,
    }
  }

  return {
    success: true,
    document: parsed.data,
    fields,
    renderer: rendererConfig(parsed.data.form, fields, registry),
    diagnostics,
  }
}
