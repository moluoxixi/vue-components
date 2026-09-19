import type { ModelJsonObject, ProjectCommand, SurfaceGraph } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignCommandPreview } from '../../../graph'
import type { DesignerRegistry } from '../../../registry'
import type { ConfigFormBreakpoint } from './runtime'

export interface DesignerCanvasProps {
  commandHint?: Component
  graph: SurfaceGraph
  surfaceId: string
  registry: DesignerRegistry
  selectedId?: string
  selectedIds?: string[]
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  candidatePreview: (command: ProjectCommand) => DesignCommandPreview | undefined
  interactive?: boolean
  pasteAvailable?: boolean
  showInteractiveToggle?: boolean
  model?: ModelJsonObject
}
