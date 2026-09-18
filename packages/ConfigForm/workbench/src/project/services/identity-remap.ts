import type {
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
} from '@moluoxixi/config-form-core'
import type { FieldNode, PageNode, ProjectPage } from '@moluoxixi/config-form-model'
import type {
  ProjectIdentityFactory,
  RemappedProjectPage,
} from '../types'
import { assertProjectDocument, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../defaults'

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
    // Expression sources reference fields as free-form identifiers, so
    // identity remapping keeps them verbatim; templates that need remapping
    // should stick to structured operands.
    case 'expression': return structuredClone(condition)
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
    version: PROJECT_DOCUMENT_VERSION,
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
  }

  return {
    page: assertRemappedPage(page),
    identityMap: { fields, nodes, reactions },
  }
}
