import type {
  ConfigFormFlowConditionNodeConfig,
  ConfigFormFlowNode,
  ConfigFormFlowReactionNodeConfig,
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
} from '@moluoxixi/config-form-core'
import type { FieldNode, PageNode, ProjectPage } from '@moluoxixi/config-form-model'
import { assertProjectDocument, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'

export type ProjectIdentityKind
  = | 'field'
    | 'flow'
    | 'flow-edge'
    | 'flow-node'
    | 'node'
    | 'page'
    | 'project'
    | 'reaction'

export interface ProjectIdentityFactory {
  create: (kind: ProjectIdentityKind, source: string) => string
}

export interface ProjectPageIdentityMap {
  fields: ReadonlyMap<string, string>
  flowEdges: ReadonlyMap<string, string>
  flowNodes: ReadonlyMap<string, string>
  flows: ReadonlyMap<string, string>
  nodes: ReadonlyMap<string, string>
  reactions: ReadonlyMap<string, string>
}

export interface RemappedProjectPage {
  identityMap: ProjectPageIdentityMap
  page: ProjectPage
}

let identitySequence = 0

function randomIdentity(kind: ProjectIdentityKind, source: string): string {
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const nonce = `${random}-${(++identitySequence).toString(36)}`
  const prefix = (source.trim() || kind).slice(0, Math.max(1, 127 - nonce.length))
  return `${prefix}-${nonce}`
}

export const DEFAULT_PROJECT_IDENTITY_FACTORY: ProjectIdentityFactory = Object.freeze({
  create: (kind: ProjectIdentityKind, source: string) => randomIdentity(kind, source),
})

function scopedIdentityKey(...parts: string[]): string {
  return JSON.stringify(parts)
}

function requireMapped(map: ReadonlyMap<string, string>, source: string, kind: string): string {
  const value = map.get(source)
  if (!value)
    throw new TypeError(`TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED: Unknown ${kind} reference "${source}".`)
  return value
}

function remapOperand(
  operand: ConfigFormReactionOperand,
  fields: ReadonlyMap<string, string>,
): ConfigFormReactionOperand {
  return operand.kind === 'field'
    ? { ...operand, field: requireMapped(fields, operand.field, 'field') }
    : structuredClone(operand)
}

function remapCondition(
  condition: ConfigFormReactionCondition,
  fields: ReadonlyMap<string, string>,
): ConfigFormReactionCondition {
  switch (condition.kind) {
    case 'literal': return structuredClone(condition)
    case 'compare': return {
      ...condition,
      left: remapOperand(condition.left, fields),
      right: remapOperand(condition.right, fields),
    }
    case 'and': return { ...condition, expressions: condition.expressions.map(item => remapCondition(item, fields)) }
    case 'or': return { ...condition, expressions: condition.expressions.map(item => remapCondition(item, fields)) }
    case 'not': return { ...condition, expression: remapCondition(condition.expression, fields) }
  }
}

function remapEffect(
  effect: ConfigFormReactionEffect,
  fields: ReadonlyMap<string, string>,
): ConfigFormReactionEffect {
  const target = requireMapped(fields, effect.target, 'field')
  switch (effect.kind) {
    case 'clearValue': return { ...effect, target }
    case 'setState': return { ...effect, target, state: { ...effect.state } }
    case 'validate': return { ...effect, target }
    case 'setValue': return { ...effect, target, value: remapOperand(effect.value, fields) }
    case 'setProps': return {
      ...effect,
      target,
      props: Object.fromEntries(Object.entries(effect.props).map(([key, value]) => [key, remapOperand(value, fields)])),
    }
  }
}

function remapReaction(
  reaction: ConfigFormReaction,
  fields: ReadonlyMap<string, string>,
  id: string,
): ConfigFormReaction {
  return {
    ...reaction,
    id,
    when: remapCondition(reaction.when, fields),
    then: reaction.then.map(effect => remapEffect(effect, fields)),
    ...(reaction.else ? { else: reaction.else.map(effect => remapEffect(effect, fields)) } : {}),
  }
}

function remapFlowNode(
  node: ConfigFormFlowNode,
  identity: {
    fields: ReadonlyMap<string, string>
    flowId: string
    flowNodes: ReadonlyMap<string, string>
    reactions: ReadonlyMap<string, string>
  },
): ConfigFormFlowNode {
  const id = requireMapped(identity.flowNodes, node.id, 'flow node')
  if (node.type === 'condition' && node.config) {
    const config = node.config as unknown as ConfigFormFlowConditionNodeConfig
    if (!config.condition)
      throw new TypeError(`TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED: Flow condition node "${node.id}" has no typed condition config.`)
    return { ...structuredClone(node), id, config: { condition: remapCondition(config.condition, identity.fields) } }
  }
  if (node.type === 'reaction' && node.config) {
    const config = node.config as unknown as ConfigFormFlowReactionNodeConfig
    if (!Array.isArray(config.reactions))
      throw new TypeError(`TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED: Flow reaction node "${node.id}" has no typed reaction config.`)
    return {
      ...structuredClone(node),
      id,
      config: structuredClone({
        reactions: config.reactions.map(reaction => remapReaction(
          reaction,
          identity.fields,
          requireMapped(
            identity.reactions,
            scopedIdentityKey('flow', identity.flowId, node.id, reaction.id),
            'reaction',
          ),
        )),
      }) as unknown as ConfigFormFlowNode['config'],
    }
  }
  // Action config is Registry-owned JSON. It is cloned but never guessed at.
  return { ...structuredClone(node), id }
}

function remapNode(
  node: PageNode,
  identity: {
    fields: ReadonlyMap<string, string>
    nodes: ReadonlyMap<string, string>
    reactions: ReadonlyMap<string, string>
  },
): PageNode {
  const clone = structuredClone(node)
  const base = {
    ...clone,
    id: requireMapped(identity.nodes, node.id, 'node'),
    ...(node.conditions
      ? { conditions: Object.fromEntries(Object.entries(node.conditions).map(([key, condition]) => [
          key,
          condition ? remapCondition(condition, identity.fields) : condition,
        ])) }
      : {}),
    ...(node.reactions
      ? {
          reactions: node.reactions.map(reaction => remapReaction(
            reaction,
            identity.fields,
            requireMapped(
              identity.reactions,
              scopedIdentityKey('graph', node.id, reaction.id),
              'reaction',
            ),
          )),
        }
      : {}),
  }
  if (node.kind === 'layout') {
    return {
      ...base,
      kind: 'layout',
      slots: Object.fromEntries(Object.entries(node.slots).map(([slot, items]) => [
        slot,
        items.map(item => ({ ...structuredClone(item), nodeId: requireMapped(identity.nodes, item.nodeId, 'node') })),
      ])),
    }
  }
  const fieldNode = base as FieldNode
  return {
    ...fieldNode,
    kind: 'field',
    field: requireMapped(identity.fields, node.field, 'field'),
    ...(node.validation
      ? {
          validation: {
            ...structuredClone(node.validation),
            rules: node.validation.rules.map(rule => rule.kind === 'compare'
              ? { ...rule, field: requireMapped(identity.fields, rule.field, 'field') }
              : structuredClone(rule)),
          },
        }
      : {}),
  }
}

function assertRemappedPage(page: ProjectPage): ProjectPage {
  const document = assertProjectDocument({
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: 'template-remap-validation',
    name: 'Template remap validation',
    homePageId: page.id,
    pageOrder: [page.id],
    pagesById: { [page.id]: page },
    registryLock: { adapter: 'template', version: '1', fingerprint: 'template', components: {} },
    settings: {},
    resources: {},
  })
  return structuredClone(document.pagesById[page.id]!)
}

export function remapProjectPageIdentity(
  seed: ProjectPage,
  pageId: string,
  factory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
): RemappedProjectPage {
  const nodes = new Map(Object.keys(seed.graph.nodesById).map(id => [id, factory.create('node', id)]))
  const fields = new Map(Object.values(seed.graph.nodesById)
    .filter((node): node is FieldNode => node.kind === 'field')
    .map(node => [node.field, factory.create('field', node.field)]))
  const reactions = new Map<string, string>()
  Object.values(seed.graph.nodesById).forEach(node => node.reactions?.forEach((reaction) => {
    reactions.set(
      scopedIdentityKey('graph', node.id, reaction.id),
      factory.create('reaction', `${node.id}-${reaction.id}`),
    )
  }))
  seed.flows?.forEach(flow => flow.nodes.forEach((node) => {
    if (node.type !== 'reaction' || !node.config)
      return
    const config = node.config as unknown as Partial<ConfigFormFlowReactionNodeConfig>
    config.reactions?.forEach((reaction) => {
      reactions.set(
        scopedIdentityKey('flow', flow.id, node.id, reaction.id),
        factory.create('reaction', `${flow.id}-${node.id}-${reaction.id}`),
      )
    })
  }))
  const flows = new Map((seed.flows ?? []).map(flow => [flow.id, factory.create('flow', flow.id)]))
  const flowNodes = new Map((seed.flows ?? []).flatMap(flow => flow.nodes.map(node => [
    scopedIdentityKey(flow.id, node.id),
    factory.create('flow-node', `${flow.id}-${node.id}`),
  ] as const)))
  const flowEdges = new Map((seed.flows ?? []).flatMap(flow => flow.edges.map(edge => [
    scopedIdentityKey(flow.id, edge.id),
    factory.create('flow-edge', `${flow.id}-${edge.id}`),
  ] as const)))

  const page: ProjectPage = {
    ...structuredClone(seed),
    id: pageId,
    graph: {
      ...structuredClone(seed.graph),
      root: seed.graph.root.map(item => ({ ...structuredClone(item), nodeId: requireMapped(nodes, item.nodeId, 'node') })),
      nodesById: Object.fromEntries(Object.values(seed.graph.nodesById).map((node) => {
        const mapped = remapNode(node, { fields, nodes, reactions })
        return [mapped.id, mapped]
      })),
    },
    ...(seed.flows
      ? {
          flows: seed.flows.map((flow) => {
            const scopedFlowNodes = new Map(flow.nodes.map(node => [
              node.id,
              requireMapped(flowNodes, scopedIdentityKey(flow.id, node.id), 'flow node'),
            ]))
            const scopedFlowEdges = new Map(flow.edges.map(edge => [
              edge.id,
              requireMapped(flowEdges, scopedIdentityKey(flow.id, edge.id), 'flow edge'),
            ]))
            return {
              ...structuredClone(flow),
              id: requireMapped(flows, flow.id, 'flow'),
              trigger: {
                ...structuredClone(flow.trigger),
                ...(flow.trigger.field ? { field: requireMapped(fields, flow.trigger.field, 'field') } : {}),
                ...(flow.trigger.nodeId ? { nodeId: requireMapped(nodes, flow.trigger.nodeId, 'node') } : {}),
              },
              nodes: flow.nodes.map(node => remapFlowNode(node, {
                fields,
                flowId: flow.id,
                flowNodes: scopedFlowNodes,
                reactions,
              })),
              edges: flow.edges.map(edge => ({
                ...structuredClone(edge),
                id: requireMapped(scopedFlowEdges, edge.id, 'flow edge'),
                source: requireMapped(scopedFlowNodes, edge.source, 'flow node'),
                target: requireMapped(scopedFlowNodes, edge.target, 'flow node'),
              })),
            }
          }),
        }
      : {}),
  }

  return {
    page: assertRemappedPage(page),
    identityMap: { fields, flowEdges, flowNodes, flows, nodes, reactions },
  }
}

/** @deprecated Use the project-scoped names for new creation sources. */
export const DEFAULT_TEMPLATE_IDENTITY_FACTORY = DEFAULT_PROJECT_IDENTITY_FACTORY
/** @deprecated Use remapProjectPageIdentity for new creation sources. */
export const remapTemplatePageIdentity = remapProjectPageIdentity
