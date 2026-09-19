import type {
  ProjectSurface,
  PrototypeInteraction,
  SafeExpression,
  SafeExpressionNode,
  SurfaceFieldNode,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import type {
  ProjectIdentityFactory,
  ProjectSurfaceReferenceMaps,
  RemappedProjectSurface,
} from '../types'
import { projectSurfaceSchema } from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../defaults'

const EMPTY_REFERENCE_MAPS: ProjectSurfaceReferenceMaps = {
  datasets: new Map(),
  resources: new Map(),
  surfaces: new Map(),
}

function requireMapped(map: ReadonlyMap<string, string>, source: string, kind: string): string {
  const value = map.get(source)
  if (!value)
    throw new TypeError(`TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED: Unknown ${kind} reference "${source}".`)
  return value
}

function remapExpressionNode(
  node: SafeExpressionNode,
  fields: ReadonlyMap<string, string>,
): SafeExpressionNode {
  switch (node.kind) {
    case 'literal':
      return structuredClone(node)
    case 'reference': {
      const path = [...node.path]
      if (node.scope === 'values' && path.length > 0)
        path[0] = requireMapped(fields, path[0]!, 'field')
      return { ...structuredClone(node), path }
    }
    case 'array':
      return { ...structuredClone(node), items: node.items.map(item => remapExpressionNode(item, fields)) }
    case 'unary':
      return { ...structuredClone(node), operand: remapExpressionNode(node.operand, fields) }
    case 'binary':
      return {
        ...structuredClone(node),
        left: remapExpressionNode(node.left, fields),
        right: remapExpressionNode(node.right, fields),
      }
    case 'conditional':
      return {
        ...structuredClone(node),
        test: remapExpressionNode(node.test, fields),
        consequent: remapExpressionNode(node.consequent, fields),
        alternate: remapExpressionNode(node.alternate, fields),
      }
    case 'call':
      return { ...structuredClone(node), args: node.args.map(argument => remapExpressionNode(argument, fields)) }
  }
}

function remapExpression(
  expression: SafeExpression,
  fields: ReadonlyMap<string, string>,
): SafeExpression {
  return {
    ...structuredClone(expression),
    ast: remapExpressionNode(expression.ast, fields),
  }
}

function remapInteraction(
  interaction: PrototypeInteraction,
  identity: { fields: ReadonlyMap<string, string>, nodes: ReadonlyMap<string, string>, interactions: ReadonlyMap<string, string> },
  references: ProjectSurfaceReferenceMaps,
): PrototypeInteraction {
  const id = requireMapped(identity.interactions, interaction.id, 'interaction')
  if (interaction.kind === 'stateProjection') {
    return {
      ...structuredClone(interaction),
      id,
      target: {
        ...structuredClone(interaction.target),
        nodeId: requireMapped(identity.nodes, interaction.target.nodeId, 'node'),
      },
      value: remapExpression(interaction.value, identity.fields),
    }
  }
  if (interaction.kind === 'valueChange') {
    const action = interaction.action.kind === 'copy'
      ? {
          ...structuredClone(interaction.action),
          sourceFieldId: requireMapped(identity.nodes, interaction.action.sourceFieldId, 'field'),
          targetFieldId: requireMapped(identity.nodes, interaction.action.targetFieldId, 'field'),
        }
      : {
          ...structuredClone(interaction.action),
          targetFieldId: requireMapped(identity.nodes, interaction.action.targetFieldId, 'field'),
          ...(interaction.action.kind === 'set' ? { value: remapExpression(interaction.action.value, identity.fields) } : {}),
        }
    return {
      ...structuredClone(interaction),
      id,
      dependencies: interaction.dependencies.map(nodeId => requireMapped(identity.nodes, nodeId, 'field')),
      ...(interaction.when ? { when: remapExpression(interaction.when, identity.fields) } : {}),
      action,
    }
  }

  const action = interaction.action
  let remappedAction: typeof action = structuredClone(action)
  if (action.kind === 'navigate' || action.kind === 'open') {
    remappedAction = {
      ...structuredClone(action),
      targetSurfaceId: requireMapped(references.surfaces, action.targetSurfaceId, 'Surface'),
      parameters: action.parameters.map(parameter => ({
        ...structuredClone(parameter),
        value: remapExpression(parameter.value, identity.fields),
      })),
      ...(action.kind === 'open' && action.onResults
        ? {
            onResults: action.onResults.map(binding => ({
              ...structuredClone(binding),
              assignments: binding.assignments.map(assignment => ({
                ...structuredClone(assignment),
                targetFieldId: requireMapped(identity.nodes, assignment.targetFieldId, 'field'),
                value: remapExpression(assignment.value, identity.fields),
              })),
            })),
          }
        : {}),
    } as typeof action
  }
  else if (action.kind === 'closeCurrent' && action.result) {
    remappedAction = {
      ...structuredClone(action),
      result: { ...structuredClone(action.result), value: remapExpression(action.result.value, identity.fields) },
    }
  }
  return {
    ...structuredClone(interaction),
    id,
    nodeId: requireMapped(identity.nodes, interaction.nodeId, 'node'),
    ...(interaction.validate?.fieldIds
      ? { validate: { ...structuredClone(interaction.validate), fieldIds: interaction.validate.fieldIds.map(nodeId => requireMapped(identity.nodes, nodeId, 'field')) } }
      : {}),
    action: remappedAction,
  }
}

function remapNode(
  node: SurfaceNode,
  nodes: ReadonlyMap<string, string>,
  fields: ReadonlyMap<string, string>,
  references: ProjectSurfaceReferenceMaps,
): SurfaceNode {
  const remapped = {
    ...structuredClone(node),
    id: requireMapped(nodes, node.id, 'node'),
    ...(node.datasetBindings
      ? {
          datasetBindings: Object.fromEntries(Object.entries(node.datasetBindings).map(([key, binding]) => [
            key,
            {
              ...structuredClone(binding),
              datasetId: requireMapped(references.datasets, binding.datasetId, 'Dataset'),
            },
          ])),
        }
      : {}),
    ...(node.resourceBindings
      ? {
          resourceBindings: Object.fromEntries(Object.entries(node.resourceBindings).map(([key, binding]) => [
            key,
            {
              ...structuredClone(binding),
              resourceId: requireMapped(references.resources, binding.resourceId, 'Resource'),
            },
          ])),
        }
      : {}),
  }
  if (node.kind === 'field') {
    const validation = node.validation
      ? {
          ...structuredClone(node.validation),
          rules: node.validation.rules.map(rule => rule.kind === 'compare'
            ? { ...structuredClone(rule), field: requireMapped(fields, rule.field, 'field') }
            : structuredClone(rule)),
        }
      : undefined
    return {
      ...remapped,
      kind: 'field',
      field: requireMapped(fields, node.field, 'field'),
      ...(validation ? { validation } : {}),
    } as SurfaceFieldNode
  }
  if (node.kind === 'layout') {
    return {
      ...remapped,
      kind: 'layout',
      ...(node.valueScope
        ? {
            valueScope: {
              ...structuredClone(node.valueScope),
              field: requireMapped(fields, node.valueScope.field, 'field'),
            },
          }
        : {}),
      slots: Object.fromEntries(Object.entries(node.slots).map(([slot, items]) => [
        slot,
        items.map(item => ({ ...structuredClone(item), nodeId: requireMapped(nodes, item.nodeId, 'node') })),
      ])),
    }
  }
  return { ...remapped, kind: 'element' }
}

function assertRemappedSurface(surface: ProjectSurface): ProjectSurface {
  const result = projectSurfaceSchema.safeParse(surface)
  if (!result.success)
    throw new TypeError(`PROJECT_SURFACE_INVALID: ${result.error.issues[0]?.message ?? 'Remapped Surface is invalid.'}`)
  return structuredClone(result.data)
}

export function remapProjectSurfaceIdentity(
  seed: ProjectSurface,
  surfaceId: string,
  factory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
  references: ProjectSurfaceReferenceMaps = EMPTY_REFERENCE_MAPS,
): RemappedProjectSurface {
  const nodes = new Map(Object.keys(seed.graph.nodesById).map(id => [id, factory.create('node', id)]))
  const fields = new Map<string, string>()
  Object.values(seed.graph.nodesById).forEach((node) => {
    const field = node.kind === 'field'
      ? node.field
      : node.kind === 'layout'
        ? node.valueScope?.field
        : undefined
    if (field && !fields.has(field))
      fields.set(field, factory.create('field', field))
  })
  const interactions = new Map(Object.values(seed.interactions).map(interaction => [interaction.id, factory.create('interaction', interaction.id)]))
  const identity = { fields, nodes, interactions }
  const surface: ProjectSurface = {
    ...structuredClone(seed),
    id: surfaceId,
    graph: {
      ...structuredClone(seed.graph),
      root: seed.graph.root.map(item => ({ ...structuredClone(item), nodeId: requireMapped(nodes, item.nodeId, 'node') })),
      nodesById: Object.fromEntries(Object.values(seed.graph.nodesById).map((node) => {
        const mapped = remapNode(node, nodes, fields, references)
        return [mapped.id, mapped]
      })),
    },
    interactions: seed.interactions.map(interaction => remapInteraction(interaction, identity, references)),
  }
  return {
    surface: assertRemappedSurface(surface),
    identityMap: identity,
  }
}
