import type {
  DesignerFieldNode,
  DesignerJsonObject,
  DesignerNode,
  DesignerNodeKind,
} from '../document'
import type { LowCodeNode } from '../model'
import { cloneDesignerJsonValue } from '../document'

interface NormalizedRuntimeNodeBase {
  id: string
  material: string
  kind: DesignerNodeKind
  props?: DesignerJsonObject
  events?: DesignerNode['events']
  bindings?: DesignerNode['bindings']
  extensions?: DesignerNode['extensions']
  span?: DesignerNode['span']
  conditions?: DesignerNode['conditions']
  reactions?: DesignerNode['reactions']
  slots: Record<string, NormalizedRuntimeNode[]>
}

export type NormalizedRuntimeField = NormalizedRuntimeNodeBase & {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: DesignerFieldNode['defaultValue']
  validation?: DesignerFieldNode['validation']
  validateOn?: DesignerFieldNode['validateOn']
}

export type NormalizedRuntimeContainer = NormalizedRuntimeNodeBase & { kind: 'container' }
export type NormalizedRuntimeNode = NormalizedRuntimeField | NormalizedRuntimeContainer

export function normalizeDesignerNode(node: DesignerNode): NormalizedRuntimeNode {
  const common = {
    id: node.id,
    material: node.material,
    ...(node.props ? { props: node.props } : {}),
    ...(node.events ? { events: node.events } : {}),
    ...(node.bindings ? { bindings: node.bindings } : {}),
    ...(node.extensions ? { extensions: node.extensions } : {}),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.conditions ? { conditions: node.conditions } : {}),
    ...(node.reactions ? { reactions: node.reactions } : {}),
    slots: node.kind === 'container'
      ? Object.fromEntries(Object.entries(node.slots).map(([slot, nodes]) => [
          slot,
          nodes.map(normalizeDesignerNode),
        ]))
      : {},
  }
  return node.kind === 'field'
    ? {
        ...common,
        kind: 'field' as const,
        field: node.field,
        ...(node.label === undefined ? {} : { label: node.label }),
        ...(node.defaultValue === undefined ? {} : { defaultValue: node.defaultValue }),
        ...(node.validation === undefined ? {} : { validation: node.validation }),
        ...(node.validateOn === undefined ? {} : { validateOn: node.validateOn }),
      }
    : { ...common, kind: 'container' as const }
}

export function normalizeConfigModelNode(node: LowCodeNode): NormalizedRuntimeNode {
  const common = {
    id: node.id,
    material: node.component,
    ...(Object.keys(node.props).length > 0 ? { props: node.props } : {}),
    ...(Object.keys(node.events).length > 0 ? { events: node.events } : {}),
    ...(Object.keys(node.bindings).length > 0 ? { bindings: node.bindings } : {}),
    ...(node.extensions ? { extensions: node.extensions } : {}),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.conditions ? { conditions: node.conditions } : {}),
    ...(node.reactions ? { reactions: node.reactions } : {}),
    slots: node.kind === 'container'
      ? {
          default: node.children.map(normalizeConfigModelNode),
          ...Object.fromEntries(Object.entries(node.slots)
            .filter(([slot]) => slot !== 'default')
            .map(([slot, nodes]) => [slot, nodes.map(normalizeConfigModelNode)])),
        }
      : {},
  }
  return node.kind === 'field'
    ? {
        ...common,
        kind: 'field' as const,
        field: node.field ?? node.id,
        ...(node.label === undefined ? {} : { label: node.label }),
        ...(node.defaultValue === undefined ? {} : { defaultValue: node.defaultValue }),
        ...(node.validation === undefined ? {} : { validation: node.validation }),
        ...(node.validateOn === undefined ? {} : { validateOn: node.validateOn }),
      }
    : { ...common, kind: 'container' as const }
}

export function toReadonlyDesignerField(node: NormalizedRuntimeField): DesignerFieldNode {
  return {
    id: node.id,
    material: node.material,
    kind: 'field',
    field: node.field,
    ...(node.props ? { props: cloneDesignerJsonValue(node.props) } : {}),
    ...(node.events ? { events: cloneDesignerJsonValue(node.events as never) } : {}),
    ...(node.bindings ? { bindings: cloneDesignerJsonValue(node.bindings as never) } : {}),
    ...(node.extensions ? { extensions: cloneDesignerJsonValue(node.extensions) } : {}),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.conditions ? { conditions: cloneDesignerJsonValue(node.conditions as never) } : {}),
    ...(node.reactions ? { reactions: cloneDesignerJsonValue(node.reactions as never) } : {}),
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: cloneDesignerJsonValue(node.defaultValue) }),
    ...(node.validation === undefined ? {} : { validation: cloneDesignerJsonValue(node.validation as never) }),
    ...(node.validateOn === undefined ? {} : { validateOn: cloneDesignerJsonValue(node.validateOn as never) }),
  }
}
