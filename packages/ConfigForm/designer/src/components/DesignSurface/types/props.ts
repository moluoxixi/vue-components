import type { ComponentContractRegistry, SurfaceGraph } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignerLocaleOptions } from '../../../locale'
import type { DesignerRegistry } from '../../../registry'
import type { DesignerCommandControl, DesignerHistoryControl } from './domain'

export interface DesignSurfaceProps {
  commandHint?: Component
  commandControl: DesignerCommandControl
  componentRegistry: ComponentContractRegistry
  graph: SurfaceGraph
  historyControl: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  surfaceId: string
  readonly?: boolean
  registry: DesignerRegistry
  renderer: Component
  workspaceNavigation?: 'external' | 'internal'
}
