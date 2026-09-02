/** Vite transform 阶段注入到 defineField(...) 调用里的源码位置。 */
export interface FieldSourceMeta {
  readonly id: string
  readonly file: string
  readonly line: number
  readonly column: number
}

export type FormDevtoolsNodeKind = 'component' | 'field' | 'render'

export interface FormDevtoolsNode {
  id: string
  formId: string
  formLabel?: string
  kind: FormDevtoolsNodeKind
  order?: number
  field?: string
  component?: string
  parentId?: string
  label?: string
  slotName?: string
  source?: FieldSourceMeta
}

export type FormNodeRenderPhase = 'mount' | 'update'

export interface FormNodeTimingMetric {
  id: string
  duration: number
  timestamp: number
}

export interface FormNodeRenderMetric extends FormNodeTimingMetric {
  phase: FormNodeRenderPhase
}

export type FormNodeSyncMetric = FormNodeTimingMetric

export interface FormDevtoolsBridge {
  registerField: (node: FormDevtoolsNode, element: HTMLElement | null) => void
  updateField: (node: FormDevtoolsNode, element: HTMLElement | null) => void
  recordRender: (metric: FormNodeRenderMetric) => void
  recordSync: (metric: FormNodeSyncMetric) => void
  unregisterField: (id: string) => void
}
