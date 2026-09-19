import type {
  ConfigFormScopedFieldDefinition,
  ConfigFormValueReferenceScope,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  FieldNode,
  NodeId,
  SurfaceGraph,
  SurfaceValueSchema,
  SurfaceValueScopeAnalysis,
  SurfaceValueScopeIssue,
} from '../types'

const MAX_SCOPE_DEPTH = 32
type ScopeId = NodeId | undefined

/** Derives runtime scope metadata from graph containment; parentId is never read from a node. */
export function deriveSurfaceValueSchema(graph: SurfaceGraph): SurfaceValueSchema {
  const scopedFields: ConfigFormScopedFieldDefinition[] = []
  for (const node of Object.values(graph.nodesById)) {
    if (node.kind === 'layout' && node.valueScope !== undefined) {
      const analysis = analyzeSurfaceValueScopes(graph)
      return {
        valueScopes: structuredClone(analysis.valueScopes),
        scopedFields: structuredClone(analysis.scopedFields),
      }
    }
    if (node.kind === 'field') {
      scopedFields.push({
        nodeId: node.id,
        field: node.field,
        ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
      })
    }
  }
  return { valueScopes: [], scopedFields }
}

export function analyzeSurfaceValueScopes(graph: SurfaceGraph): SurfaceValueScopeAnalysis {
  const hasExplicitScope = Object.values(graph.nodesById).some(node => node.kind === 'layout' && node.valueScope !== undefined)
  if (!hasExplicitScope)
    return analyzeFlatSurfaceValueScopes(graph)

  const valueScopes: ConfigFormValueScopeDefinition[] = []
  const scopedFields: ConfigFormScopedFieldDefinition[] = []
  const issues: SurfaceValueScopeIssue[] = []
  const ownerScopeByNodeId = new Map<NodeId, ScopeId>()
  const parentScopeByScopeId = new Map<NodeId, ScopeId>()
  const fieldsByScopeMutable = new Map<ScopeId, Map<string, FieldNode>>()
  const occupiedByScope = new Map<ScopeId, Map<string, Array<string | number>>>()
  const visited = new Set<NodeId>()

  const registerKey = (owner: ScopeId, field: string, path: Array<string | number>): void => {
    const occupied = occupiedByScope.get(owner) ?? new Map<string, Array<string | number>>()
    if (occupied.has(field))
      issues.push({ message: `Duplicate value key in the same scope: ${field}`, path })
    else
      occupied.set(field, path)
    occupiedByScope.set(owner, occupied)
  }

  const visit = (nodeId: NodeId, owner: ScopeId, depth: number): void => {
    if (visited.has(nodeId))
      return
    visited.add(nodeId)
    const node = graph.nodesById[nodeId]
    if (!node)
      return
    ownerScopeByNodeId.set(node.id, owner)
    if (node.kind === 'field') {
      const definition: ConfigFormScopedFieldDefinition = {
        nodeId: node.id,
        field: node.field,
        ...(owner === undefined ? {} : { scopeId: owner }),
        ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
      }
      scopedFields.push(definition)
      const fields = fieldsByScopeMutable.get(owner) ?? new Map<string, FieldNode>()
      if (!fields.has(node.field))
        fields.set(node.field, node)
      fieldsByScopeMutable.set(owner, fields)
      registerKey(owner, node.field, ['nodesById', node.id, 'field'])
      return
    }
    if (node.kind === 'element')
      return

    let childOwner = owner
    let childDepth = depth
    if (node.valueScope) {
      const definition: ConfigFormValueScopeDefinition = {
        nodeId: node.id,
        field: node.valueScope.field,
        kind: node.valueScope.kind,
        ...(owner === undefined ? {} : { parentId: owner }),
        ...(node.valueScope.itemKey === undefined ? {} : { itemKey: node.valueScope.itemKey }),
        ...(node.valueScope.minItems === undefined ? {} : { minItems: node.valueScope.minItems }),
        ...(node.valueScope.maxItems === undefined ? {} : { maxItems: node.valueScope.maxItems }),
      }
      valueScopes.push(definition)
      parentScopeByScopeId.set(node.id, owner)
      registerKey(owner, definition.field, ['nodesById', node.id, 'valueScope', 'field'])
      childOwner = node.id
      childDepth += 1
      if (childDepth > MAX_SCOPE_DEPTH)
        issues.push({ message: `Value scope nesting cannot exceed ${MAX_SCOPE_DEPTH} levels.`, path: ['nodesById', node.id, 'valueScope'] })
    }
    Object.values(node.slots).forEach(items => items.forEach(item => visit(item.nodeId, childOwner, childDepth)))
  }

  graph.root.forEach(item => visit(item.nodeId, undefined, 0))
  Object.keys(graph.nodesById).forEach(nodeId => visit(nodeId, undefined, 0))
  const fieldsByScope = new Map<ScopeId, ReadonlyMap<string, FieldNode>>()
  fieldsByScopeMutable.forEach((fields, owner) => fieldsByScope.set(owner, fields))
  return { fieldsByScope, issues, ownerScopeByNodeId, parentScopeByScopeId, scopedFields, valueScopes }
}

function analyzeFlatSurfaceValueScopes(graph: SurfaceGraph): SurfaceValueScopeAnalysis {
  const fields = new Map<string, FieldNode>()
  const scopedFields: ConfigFormScopedFieldDefinition[] = []
  const issues: SurfaceValueScopeIssue[] = []
  const ownerScopeByNodeId = new Map<NodeId, ScopeId>()
  Object.values(graph.nodesById).forEach((node) => {
    ownerScopeByNodeId.set(node.id, undefined)
    if (node.kind !== 'field')
      return
    if (fields.has(node.field))
      issues.push({ message: `Field name must be unique: ${node.field}`, path: ['nodesById', node.id, 'field'] })
    else
      fields.set(node.field, node)
    scopedFields.push({
      nodeId: node.id,
      field: node.field,
      ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
    })
  })
  return {
    fieldsByScope: new Map([[undefined, fields]]),
    issues,
    ownerScopeByNodeId,
    parentScopeByScopeId: new Map(),
    scopedFields,
    valueScopes: [],
  }
}

export function resolveSurfaceNamedField(
  analysis: SurfaceValueScopeAnalysis,
  sourceNodeId: NodeId | undefined,
  field: string,
): FieldNode | undefined {
  let scope = effectiveSourceScope(analysis, sourceNodeId)
  const visited = new Set<NodeId>()
  while (true) {
    const match = analysis.fieldsByScope.get(scope)?.get(field)
    if (match)
      return match
    if (scope === undefined || visited.has(scope))
      return undefined
    visited.add(scope)
    scope = analysis.parentScopeByScopeId.get(scope)
  }
}

export function isSurfaceFieldReferenceInScope(
  analysis: SurfaceValueScopeAnalysis,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  selector: ConfigFormValueReferenceScope,
): boolean {
  const target = analysis.scopedFields.find(field => field.nodeId === targetNodeId)
  if (!target)
    return false
  const current = effectiveSourceScope(analysis, sourceNodeId)
  let expected: ScopeId
  if (selector === 'root') {
    expected = undefined
  }
  else if (selector === 'parent') {
    if (current === undefined)
      return false
    expected = analysis.parentScopeByScopeId.get(current)
  }
  else {
    expected = current
  }
  return target.scopeId === expected
}

function effectiveSourceScope(analysis: SurfaceValueScopeAnalysis, sourceNodeId: NodeId | undefined): ScopeId {
  if (sourceNodeId === undefined)
    return undefined
  return analysis.valueScopes.some(scope => scope.nodeId === sourceNodeId)
    ? sourceNodeId
    : analysis.ownerScopeByNodeId.get(sourceNodeId)
}
