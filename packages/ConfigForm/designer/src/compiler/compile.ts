import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
} from '@moluoxixi/config-form/renderer'
import type {
  CompiledRuleSet,
  RuleCompileContext,
  RuleCustomValidator,
  RuleDiagnostic,
  RuleSet,
} from '@moluoxixi/zod3-to-rule'
import type {
  DesignerContainerNode,
  DesignerDiagnostic,
  DesignerDocument,
  DesignerFieldNode,
  DesignerNode,
} from '../document'
import type { DesignerRegistry } from '../registry'
import type { DesignerCompileResult, DesignerRendererConfig } from './types'
import { compileRules, RuleCompileError } from '@moluoxixi/zod3-to-rule'
import { compileDesignerCondition } from '../condition'
import {
  cloneDesignerJsonValue,
  designerDiagnostic,
  hasDesignerErrors,
  parseDesignerDocument,
} from '../document'
import { analyzeDesignerDocument } from '../registry'

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
  node: DesignerFieldNode,
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

function compileNodeBase(node: DesignerNode, component: ConfigFormRendererNode['component']) {
  return {
    component,
    ...(node.props ? { props: cloneDesignerJsonValue(node.props) } : {}),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.conditions?.visible ? { visible: compileDesignerCondition(node.conditions.visible) } : {}),
    ...(node.conditions?.hidden ? { hidden: compileDesignerCondition(node.conditions.hidden) } : {}),
  }
}

function compileField(
  node: DesignerFieldNode,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
): ConfigFormRendererField | undefined {
  const material = registry.getMaterial(node.material)
  if (!material || material.kind !== 'field')
    return undefined

  const validation = compileValidation(node, path, registry, diagnostics)
  const required = node.conditions?.required
    ? compileDesignerCondition(node.conditions.required)
    : validation?.required

  return {
    ...compileNodeBase(node, material.runtime.component),
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
    ...(material.runtime.getValueFromEvent ? { getValueFromEvent: material.runtime.getValueFromEvent } : {}),
  }
}

function compileContainer(
  node: DesignerContainerNode,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
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
        ))
        .filter((child): child is ConfigFormRendererNode => child !== undefined),
    ]),
  )

  return {
    ...compileNodeBase(node, material.runtime.component),
    slots,
  }
}

function compileNode(
  node: DesignerNode,
  path: (string | number)[],
  registry: DesignerRegistry,
  diagnostics: DesignerDiagnostic[],
): ConfigFormRendererNode | undefined {
  return node.kind === 'field'
    ? compileField(node, path, registry, diagnostics)
    : compileContainer(node, path, registry, diagnostics)
}

function rendererConfig(document: DesignerDocument, fields: ConfigFormRendererNode[]): DesignerRendererConfig {
  return {
    fields,
    ...(document.form.inline === undefined ? {} : { inline: document.form.inline }),
    ...(document.form.columns === undefined ? {} : { columns: document.form.columns }),
    ...(document.form.gap === undefined ? {} : { gap: document.form.gap }),
    ...(document.form.fieldSpan === undefined ? {} : { fieldSpan: document.form.fieldSpan }),
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
    .map((node, index) => compileNode(node, ['nodes', index], registry, diagnostics))
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
    renderer: rendererConfig(parsed.data, fields),
    diagnostics,
  }
}
