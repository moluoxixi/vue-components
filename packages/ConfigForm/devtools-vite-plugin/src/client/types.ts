import type {
  FormDevtoolsBridge,
  FormDevtoolsNode,
  FormNodeRenderMetric,
} from '../types'

/** devtools 节点加浏览器 overlay store 独有的状态。 */
export interface StoredNode extends FormDevtoolsNode {
  avgRenderMs?: number
  avgSyncMs?: number
  element: HTMLElement | null
  lastRenderMs?: number
  lastRenderPhase?: FormNodeRenderMetric['phase']
  lastSyncMs?: number
  maxRenderMs?: number
  maxSyncMs?: number
  order: number
  registrationOrder: number
  renderSamples: number
  syncSamples: number
}

/** 多表单导航中单个 ConfigForm 实例的聚合状态。 */
export interface RootGroup {
  element?: HTMLElement
  formId: string
  formLabel?: string
  hasEnabledElement: boolean
  hasInspectableElement: boolean
  registrationOrder: number
  nodes: StoredNode[]
  viewportScore: number
}

/** 跨渲染保存的可变状态，用来区分用户手动选择和自动选中。 */
export interface DevtoolsRenderState {
  activeFormId?: string
  activeFormSelectedByUser?: boolean
  pickingNode?: boolean
  selectedNodeId?: string
  sourceSearchQuery?: string
}

export interface DevtoolsStore {
  nodes: Map<string, StoredNode>
  registerField: FormDevtoolsBridge['registerField']
  updateField: FormDevtoolsBridge['updateField']
  recordRender: FormDevtoolsBridge['recordRender']
  recordSync: FormDevtoolsBridge['recordSync']
  unregisterField: FormDevtoolsBridge['unregisterField']
}

export type ChildNodesByParentId = Map<string, StoredNode[]>
export type HighlightElement = (element: HTMLElement | null) => void
export type RenderDevtools = () => void
export type SetDevtoolsMessage = (message: string) => void

export interface BubblePosition {
  left: number
  top: number
  edge: 'left' | 'right'
}
