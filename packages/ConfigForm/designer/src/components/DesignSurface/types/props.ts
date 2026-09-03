import type { ComponentContractRegistry, PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import type { Component } from 'vue'
import type { DesignerLocaleOptions } from '../../../locale'
import type { DesignerRegistry } from '../../../registry'
import type { DesignerCommandControl, DesignerHistoryControl } from './domain'

export interface DesignSurfaceProps {
  commandHint?: Component
  commandControl: DesignerCommandControl
  componentRegistry: ComponentContractRegistry
  graph: PageGraph
  historyControl: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  pageId: string
  readonly?: boolean
  registry: DesignerRegistry
  runtimeRenderer: VueRuntimeRendererConfig
  workspaceNavigation?: 'external' | 'internal'
}
