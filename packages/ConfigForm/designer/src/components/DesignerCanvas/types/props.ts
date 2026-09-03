import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { PageGraph, ProjectCommand } from '@moluoxixi/config-form-model'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import type { Component } from 'vue'
import type { DesignCommandPreview } from '../../../graph'
import type { DesignerRegistry } from '../../../registry'

export interface DesignerCanvasProps {
  commandHint?: Component
  graph: PageGraph
  pageId: string
  registry: DesignerRegistry
  selectedId?: string
  selectedIds?: string[]
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  candidatePreview: (command: ProjectCommand) => DesignCommandPreview | undefined
  interactive?: boolean
  showInteractiveToggle?: boolean
  model?: Record<string, unknown>
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
  runtimeRenderer: VueRuntimeRendererConfig
}
