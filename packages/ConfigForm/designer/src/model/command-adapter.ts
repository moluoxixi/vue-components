import type { DesignerDocument, DesignerNode } from '../document'
import type { DesignerCommand } from '../history'
import type { ModelNodePatch, ModelOperation } from './types'
import { modelJsonObjectSchema } from '@moluoxixi/config-form-model'
import { findDesignerNode } from '../history'
import { designerNodeToConfigModelNode } from './transform'

const NODE_PATCH_KEYS = [
  'conditions',
  'defaultValue',
  'extensions',
  'field',
  'label',
  'reactions',
  'validateOn',
  'validation',
] as const satisfies readonly (keyof ModelNodePatch)[]

function nextNode(document: DesignerDocument, nodeId: string): DesignerNode {
  const node = findDesignerNode(document, nodeId)?.node
  if (!node)
    throw new Error(`Designer command result does not contain node: ${nodeId}`)
  return node
}

function nodePatch(node: DesignerNode, keys: readonly (keyof ModelNodePatch)[]): ModelNodePatch {
  const record = node as unknown as Record<string, unknown>
  return Object.fromEntries(keys.map(key => [key, structuredClone(record[key])])) as ModelNodePatch
}

function updateOperation(
  command: Extract<DesignerCommand, { type: 'updateNode' | 'updateNodePath' }>,
  document: DesignerDocument,
): ModelOperation {
  const node = nextNode(document, command.nodeId)
  const roots = command.type === 'updateNode'
    ? Object.keys(command.changes)
    : [command.path[0]]
  if (roots.includes('material'))
    throw new Error('Changing a registered component type in place is not supported.')

  const operations: ModelOperation[] = []
  if (roots.includes('props'))
    operations.push({ type: 'updateProps', nodeId: command.nodeId, props: structuredClone(node.props ?? {}) })
  if (roots.includes('span'))
    operations.push({ type: 'resize', nodeId: command.nodeId, span: node.span ?? null })
  const patchKeys = NODE_PATCH_KEYS.filter(key => roots.includes(key))
  if (patchKeys.length > 0)
    operations.push({ type: 'updateNode', nodeId: command.nodeId, patch: nodePatch(node, patchKeys) })
  if (operations.length === 0)
    throw new Error(`Unsupported designer update path: ${roots.join('.')}`)
  return operations.length === 1 ? operations[0]! : { type: 'batch', operations }
}

export function designerCommandToModelOperation(
  command: DesignerCommand,
  document: DesignerDocument,
  pageProps: unknown = {},
): ModelOperation {
  switch (command.type) {
    case 'addNode':
      return { type: 'insert', node: designerNodeToConfigModelNode(command.node), target: command.target }
    case 'moveNode':
      return { type: 'move', nodeId: command.nodeId, target: command.target }
    case 'copyNode':
      return {
        type: 'duplicate',
        nodeId: command.nodeId,
        target: command.target,
        idMap: command.newIds,
        fieldMap: command.newFields,
      }
    case 'removeNode':
      return { type: 'remove', nodeId: command.nodeId }
    case 'updateNode':
    case 'updateNodePath':
      return updateOperation(command, document)
    case 'updateForm':
      return {
        type: 'updatePage',
        form: structuredClone(document.form),
        props: modelJsonObjectSchema.parse(pageProps),
      }
    case 'batch':
      return {
        type: 'batch',
        operations: command.commands.map(item => designerCommandToModelOperation(item, document, pageProps)),
      }
    case 'replaceDocument':
      throw new Error('Document replacement is only available through the legacy migration boundary.')
  }
}
