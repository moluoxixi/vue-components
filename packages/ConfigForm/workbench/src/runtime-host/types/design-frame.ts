import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  DesignerRuntimeGeometrySnapshot,
  DesignerRuntimePointerPayload,
} from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../adapters'

export interface DesignRuntimeHostFrameProps {
  adapter: WorkbenchAdapterId
  breakpoint: ConfigFormBreakpoint
  cameraScale: number
  candidateId?: string
  candidateUsesFallback?: boolean
  canvasWidth?: number
  command?: ProjectCommand
  locale: string
  modelValue: Record<string, unknown>
  namespace?: string
  reactionProps: Record<string, Record<string, unknown>>
  reactionStates: Record<string, Record<string, unknown>>
  resolveCompilation: (command?: ProjectCommand) => PageCompilation | undefined
  title: string
  variant: 'canvas' | 'drag-visual'
}

export interface DesignRuntimeHostFrameEmits {
  error: [error: Error]
  geometry: [snapshot: DesignerRuntimeGeometrySnapshot]
  pointerCancel: [payload: DesignerRuntimePointerPayload]
  pointerDown: [payload: DesignerRuntimePointerPayload]
  pointerMove: [payload: DesignerRuntimePointerPayload]
  pointerUp: [payload: DesignerRuntimePointerPayload]
}
