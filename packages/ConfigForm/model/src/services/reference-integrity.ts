import type { ConfigFormExpressionNode, ConfigFormReaction, ConfigFormReactionCondition, ConfigFormReactionEffect, ConfigFormReactionOperand, ConfigFormValueInput, ConfigFormValueReference } from '@moluoxixi/config-form-core'
import type { NodeId, PageNode, ProjectPage } from '../types'
import {
  parseConfigFormExpression,
  remapConfigFormValueReferences,
} from '@moluoxixi/config-form-core'
import { analyzeProjectPageValueScopes, resolveProjectPageNamedField } from './value-scope'

export class ProjectReferenceRewriteError extends Error {
  readonly code = 'PROJECT_REFERENCE_REWRITE_UNSUPPORTED'
  constructor(message: string) {
    super(message)
    this.name = 'ProjectReferenceRewriteError'
  }
}

export function collectConfigFormExpressionFieldNames(source: string): string[] {
  let expression: ConfigFormExpressionNode
  try {
    expression = parseConfigFormExpression(source)
  }
  catch {
    return []
  }
  const names: string[] = []
  const visit = (node: ConfigFormExpressionNode): void => {
    switch (node.kind) {
      case 'literal':
        return
      case 'identifier':
        if (!node.name.startsWith('$'))
          names.push(node.name)
        return
      case 'member':
        visit(node.object)
        return
      case 'index':
        visit(node.object)
        visit(node.index)
        return
      case 'array':
        node.items.forEach(visit)
        return
      case 'unary':
        visit(node.operand)
        return
      case 'binary':
        visit(node.left)
        visit(node.right)
        return
      case 'conditional':
        visit(node.test)
        visit(node.consequent)
        visit(node.alternate)
        return
      case 'call':
        node.args.forEach(visit)
    }
  }
  visit(expression)
  return [...new Set(names)]
}

export function remapStableConfigFormExpression(
  source: string,
  fields: ReadonlyMap<string, string>,
): string {
  if (!/\$(?:fields|variables)\s*(?:\.|\[)/.test(source) || fields.size === 0)
    return source
  const remapped = remapConfigFormValueReferences(
    { $ref: { kind: 'expression', source } },
    { fields },
  )
  if (!remapped || typeof remapped !== 'object' || Array.isArray(remapped) || !Object.hasOwn(remapped, '$ref'))
    throw new ProjectReferenceRewriteError('Expression reference remapping returned an unexpected value.')
  const reference = (remapped as { $ref: ConfigFormValueReference }).$ref
  if (reference.kind !== 'expression')
    throw new ProjectReferenceRewriteError('Expression reference remapping returned an unexpected value.')
  return reference.source
}

interface RewriteContext {
  sourceNodeId: NodeId | undefined
  referenceSourceNodeId?: NodeId
  targetNodeId?: NodeId
  analysis: ReturnType<typeof analyzeProjectPageValueScopes>
  oldName?: string
  newName?: string
  fieldIdMap?: ReadonlyMap<string, string>
  fieldNameMap?: ReadonlyMap<string, string>
}

export function rewritePageFieldReferences(
  page: ProjectPage,
  sourceNodeId: NodeId,
  oldName: string,
  newName: string,
  replacementNode?: PageNode,
): Set<NodeId> {
  const analysis = analyzeProjectPageValueScopes(page.graph)
  const changedNodes = new Set<NodeId>([sourceNodeId])
  const contextBase: RewriteContext = { analysis, newName, oldName, sourceNodeId, targetNodeId: sourceNodeId }
  Object.values(page.graph.nodesById).forEach((node) => {
    const target = replacementNode?.id === node.id ? replacementNode : node
    const before = JSON.stringify(node)
    rewriteNodeReferences(target, { ...contextBase, sourceNodeId: node.id })
    if (before !== JSON.stringify(target))
      changedNodes.add(node.id)
  })
  return changedNodes
}

export function rewriteDuplicatedNodeReferences(
  page: ProjectPage,
  sourceIds: ReadonlySet<NodeId>,
  idMap: ReadonlyMap<NodeId, NodeId>,
  fieldMap: ReadonlyMap<string, string>,
  duplicatedNodes: ReadonlyMap<NodeId, PageNode>,
): void {
  const analysis = analyzeProjectPageValueScopes(page.graph)
  const fieldIdMap = new Map<string, string>()
  sourceIds.forEach((sourceId) => {
    const source = page.graph.nodesById[sourceId]
    const target = idMap.get(sourceId)
    if (source?.kind === 'field' && target)
      fieldIdMap.set(sourceId, target)
  })
  duplicatedNodes.forEach((node, sourceId) => {
    const source = page.graph.nodesById[sourceId]
    if (!source)
      return
    if (node.kind === 'field' && source.kind === 'field')
      node.field = fieldMap.get(source.field) ?? node.field
    if (node.kind === 'layout' && source.kind === 'layout' && node.valueScope && source.valueScope)
      node.valueScope.field = fieldMap.get(source.valueScope.field) ?? node.valueScope.field
    rewriteNodeReferences(node, {
      analysis,
      fieldIdMap,
      fieldNameMap: fieldMap,
      referenceSourceNodeId: sourceId,
      sourceNodeId: sourceId,
    })
  })
}

function rewriteNodeReferences(node: PageNode, context: RewriteContext): void {
  const referenceSourceNodeId = context.referenceSourceNodeId ?? node.id
  Object.entries(node.conditions ?? {}).forEach(([key, condition]) => {
    if (condition)
      rewriteCondition(condition, { ...context, sourceNodeId: node.id, referenceSourceNodeId }, `${node.id}.conditions.${key}`)
  })
  node.reactions?.forEach((reaction, index) => rewriteReaction(
    reaction,
    { ...context, sourceNodeId: node.id, referenceSourceNodeId },
    `${node.id}.reactions.${index}`,
  ))
  if (node.kind === 'field') {
    node.validation?.rules.forEach((rule, index) => {
      if (rule.kind === 'compare')
        rule.field = rewriteNamedField(rule.field, context, `${node.id}.validation.rules.${index}.field`)
    })
  }
  if (node.kind === 'field' && node.optionSource?.params)
    node.optionSource.params = remapInputRecord(node.optionSource.params, context)
}

function rewriteCondition(condition: ConfigFormReactionCondition, context: RewriteContext, path: string): void {
  switch (condition.kind) {
    case 'literal':
      return
    case 'compare':
      rewriteOperand(condition.left, context, `${path}.left`)
      rewriteOperand(condition.right, context, `${path}.right`)
      return
    case 'and':
    case 'or':
      condition.expressions.forEach((item, index) => rewriteCondition(item, context, `${path}.expressions.${index}`))
      return
    case 'not':
      rewriteCondition(condition.expression, context, `${path}.expression`)
      return
    case 'expression':
      condition.expression = rewriteExpression(condition.expression, context, path)
  }
}

function rewriteReaction(reaction: ConfigFormReaction, context: RewriteContext, path: string): void {
  rewriteCondition(reaction.when, context, `${path}.when`)
  rewriteEffects(reaction.then, context, `${path}.then`)
  rewriteEffects(reaction.else ?? [], context, `${path}.else`)
}

function rewriteEffects(effects: ConfigFormReactionEffect[], context: RewriteContext, path: string): void {
  effects.forEach((effect, index) => {
    const effectPath = `${path}.${index}`
    effect.target = rewriteNamedField(effect.target, context, `${effectPath}.target`)
    if (effect.kind === 'setValue')
      rewriteOperand(effect.value, context, `${effectPath}.value`)
    if (effect.kind === 'setProps')
      Object.entries(effect.props).forEach(([key, operand]) => rewriteOperand(operand, context, `${effectPath}.props.${key}`))
  })
}

function rewriteOperand(operand: ConfigFormReactionOperand, context: RewriteContext, path: string): void {
  if (operand.kind === 'field')
    operand.field = rewriteNamedField(operand.field, context, `${path}.field`)
  else if (operand.kind === 'expression')
    operand.expression = rewriteExpression(operand.expression, context, path)
}

function sourceForReference(context: RewriteContext): NodeId | undefined {
  return context.referenceSourceNodeId ?? context.sourceNodeId
}

function rewriteNamedField(name: string, context: RewriteContext, _path: string): string {
  const resolved = resolveProjectPageNamedField(context.analysis, sourceForReference(context), name)
  if (!resolved)
    return name
  if (context.oldName !== undefined && context.newName !== undefined
    && resolved.field === context.oldName && resolved.id === context.targetNodeId) {
    return context.newName
  }
  if (context.fieldIdMap?.has(resolved.id))
    return context.fieldNameMap?.get(resolved.field) ?? name
  return name
}

function rewriteExpression(source: string, context: RewriteContext, path: string): string {
  const names = collectConfigFormExpressionFieldNames(source)
  if (context.oldName !== undefined && context.newName !== undefined && names.includes(context.oldName)) {
    const resolved = resolveProjectPageNamedField(context.analysis, sourceForReference(context), context.oldName)
    if (resolved?.id === context.targetNodeId)
      throw new ProjectReferenceRewriteError(`Cannot structurally rewrite field expression at ${path}.`)
  }
  if (context.fieldIdMap) {
    for (const name of names) {
      const resolved = resolveProjectPageNamedField(context.analysis, sourceForReference(context), name)
      if (resolved && context.fieldIdMap.has(resolved.id) && context.fieldNameMap?.has(name))
        throw new ProjectReferenceRewriteError(`Cannot structurally rewrite field expression at ${path}.`)
    }
  }
  return context.fieldIdMap
    ? remapStableConfigFormExpression(source, context.fieldIdMap)
    : source
}

function rewriteLegacyInput(input: unknown, context: RewriteContext, path: string): unknown {
  if (Array.isArray(input))
    return input.map((value, index) => rewriteLegacyInput(value, context, `${path}.${index}`))
  if (!input || typeof input !== 'object')
    return input
  const record = input as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.includes('$ref')) {
    try {
      return remapConfigFormValueReferences(
        record as ConfigFormValueInput,
        { fields: context.fieldIdMap },
      )
    }
    catch {
      throw new ProjectReferenceRewriteError(`Cannot structurally rewrite value reference at ${path}.`)
    }
  }
  if (keys.length === 1 && keys[0] === '$field' && typeof record.$field === 'string')
    return { $field: rewriteNamedField(record.$field, context, `${path}.$field`) }
  if (keys.length === 1 && keys[0] === '$expression' && typeof record.$expression === 'string')
    return { $expression: rewriteExpression(record.$expression, context, `${path}.$expression`) }
  const rewritten: Record<string, unknown> = Object.create(null)
  Object.entries(record).forEach(([key, value]) => {
    rewritten[key] = rewriteLegacyInput(value, context, `${path}.${key}`)
  })
  return rewritten
}

function remapInputRecord(
  input: Record<string, ConfigFormValueInput>,
  context: RewriteContext,
): Record<string, ConfigFormValueInput> {
  const result: Record<string, ConfigFormValueInput> = Object.create(null)
  Object.entries(input).forEach(([key, value]) => {
    result[key] = rewriteLegacyInput(value, context, key) as ConfigFormValueInput
  })
  return result
}
