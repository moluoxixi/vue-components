import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { ShallowRef } from 'vue'
import type { DesignerController } from '../../../composables'
import type { DesignerDragController } from './drag'
import type { DesignerRuntimeGeometrySnapshot } from './runtime'

export type DesignerOverlayMode
  = | 'idle'
    | 'selected'
    | 'pointer-dragging'
    | 'keyboard-dragging'
    | 'resizing'

/** Transient editor state. Project data and history stay behind ProjectCommand. */
export interface DesignerDesignSession {
  candidateCommand: ShallowRef<ProjectCommand | undefined>
  controller: DesignerController
  drag: DesignerDragController
  overlayMode: ShallowRef<DesignerOverlayMode>
  runtimeGeometry: ShallowRef<DesignerRuntimeGeometrySnapshot | undefined>
  dispose: () => void
  publishCandidate: (command: ProjectCommand | undefined) => void
  publishGeometry: (geometry: DesignerRuntimeGeometrySnapshot | undefined) => void
  publishOverlayMode: (mode: DesignerOverlayMode) => void
}
