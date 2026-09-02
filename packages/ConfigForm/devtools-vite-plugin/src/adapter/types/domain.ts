import type { FieldSourceMeta, FormNodeRenderPhase } from '../../types'

export type ExposedConfigForm = Record<string, unknown>
export type ExposedHook = (...args: unknown[]) => void

export interface RenderMetric {
  duration: number
  id: string
  phase: FormNodeRenderPhase
  timestamp: number
}

export interface DevtoolsFieldConfig {
  component: unknown
  field: string
  label?: unknown
  __source?: FieldSourceMeta
}

export interface DevtoolsFormNodeConfig {
  component?: unknown
  field?: unknown
  id?: string
  label?: unknown
  props?: Record<string, unknown>
  slots?: Record<string, unknown>
  __source?: FieldSourceMeta
}

export interface DevtoolsRenderFunction {
  __source?: FieldSourceMeta
  name?: string
}

export interface DevtoolsCollectedFields {
  byReference: WeakSet<object>
}
