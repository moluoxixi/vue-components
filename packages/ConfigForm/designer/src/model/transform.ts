import type {
  DesignerContainerNode,
  DesignerDocument,
  DesignerFieldNode,
  DesignerJsonValue,
  DesignerNode,
} from '../document'
import type { LowCodeNode, LowCodePageModel } from './types'
import { cloneDesignerJsonValue } from '../document'
import { LOW_CODE_PAGE_MODEL_VERSION } from './types'

function cloneJson<T>(value: T): T {
  return cloneDesignerJsonValue(value as unknown as DesignerJsonValue) as unknown as T
}

export function cloneConfigModel(model: LowCodePageModel): LowCodePageModel {
  return cloneJson(model)
}

export function designerNodeToConfigModelNode(node: DesignerNode): LowCodeNode {
  const children = node.kind === 'container'
    ? (node.slots.default ?? []).map(designerNodeToConfigModelNode)
    : []
  const slots = node.kind === 'container'
    ? Object.fromEntries(Object.entries(node.slots)
        .filter(([slot]) => slot !== 'default')
        .map(([slot, nodes]) => [slot, nodes.map(designerNodeToConfigModelNode)]))
    : {}

  const common: LowCodeNode = {
    id: node.id,
    component: node.material,
    props: cloneJson(node.props ?? {}),
    events: cloneJson(node.events ?? {}),
    bindings: cloneJson(node.bindings ?? {}),
    children,
    slots,
    kind: node.kind,
    ...(node.extensions ? { extensions: cloneJson(node.extensions) } : {}),
    ...(node.span !== undefined ? { span: node.span } : {}),
    ...(node.conditions ? { conditions: cloneJson(node.conditions) } : {}),
    ...(node.reactions ? { reactions: cloneJson(node.reactions) } : {}),
  }

  if (node.kind === 'field') {
    return {
      ...common,
      field: node.field,
      ...(node.label !== undefined ? { label: node.label } : {}),
      ...(node.defaultValue !== undefined ? { defaultValue: cloneJson(node.defaultValue) } : {}),
      ...(node.validation !== undefined ? { validation: cloneJson(node.validation) } : {}),
      ...(node.validateOn !== undefined ? { validateOn: cloneJson(node.validateOn) } : {}),
    }
  }
  return common
}

export function designerDocumentToConfigModel(
  document: DesignerDocument,
  options: { id?: string, name?: string, flows?: LowCodePageModel['flows'] } = {},
): LowCodePageModel {
  return {
    id: options.id ?? 'page',
    name: options.name ?? 'Untitled page',
    version: LOW_CODE_PAGE_MODEL_VERSION,
    props: {},
    form: cloneJson(document.form),
    nodes: document.nodes.map(designerNodeToConfigModelNode),
    ...(options.flows ? { flows: cloneJson(options.flows) } : {}),
  }
}

function toDesignerNode(node: LowCodeNode): DesignerNode {
  const common = {
    id: node.id,
    material: node.component,
    ...(Object.keys(node.props).length > 0 ? { props: cloneJson(node.props) } : {}),
    ...(Object.keys(node.events).length > 0 ? { events: cloneJson(node.events) } : {}),
    ...(Object.keys(node.bindings).length > 0 ? { bindings: cloneJson(node.bindings) } : {}),
    ...(node.extensions ? { extensions: cloneJson(node.extensions) } : {}),
    ...(node.span !== undefined ? { span: node.span } : {}),
    ...(node.conditions ? { conditions: cloneJson(node.conditions) } : {}),
    ...(node.reactions ? { reactions: cloneJson(node.reactions) } : {}),
  }

  if (node.kind === 'container') {
    return {
      ...common,
      kind: 'container',
      slots: {
        default: node.children.map(toDesignerNode),
        ...Object.fromEntries(Object.entries(node.slots)
          .map(([slot, nodes]) => [slot, nodes.map(toDesignerNode)])),
      },
    } satisfies DesignerContainerNode
  }

  return {
    ...common,
    kind: 'field',
    field: node.field ?? node.id,
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.defaultValue !== undefined ? { defaultValue: cloneJson(node.defaultValue) } : {}),
    ...(node.validation !== undefined ? { validation: cloneJson(node.validation) } : {}),
    ...(node.validateOn !== undefined ? { validateOn: cloneJson(node.validateOn) } : {}),
  } satisfies DesignerFieldNode
}

export function configModelToDesignerDocument(model: LowCodePageModel): DesignerDocument {
  return {
    version: 1,
    form: cloneJson(model.form),
    nodes: model.nodes.map(toDesignerNode),
  }
}
