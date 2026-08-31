import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { InjectionKey, ShallowRef } from 'vue'
import type { DesignerController } from '../composables'
import type {
  CreateDesignerDragControllerOptions,
  DesignerDragController,
} from './designer-drag'
import type { DesignerRuntimeGeometrySnapshot } from './types'
import { shallowRef } from 'vue'
import { createDesignerDragController } from './designer-drag'

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

export const DESIGNER_SESSION_KEY: InjectionKey<DesignerDesignSession>
  = Symbol('config-form-designer-session')

export function createDesignerDesignSession(
  controller: DesignerController,
  dragOptions: CreateDesignerDragControllerOptions,
): DesignerDesignSession {
  const drag = createDesignerDragController(dragOptions)
  const candidateCommand = shallowRef<ProjectCommand>()
  const runtimeGeometry = shallowRef<DesignerRuntimeGeometrySnapshot>()
  const overlayMode = shallowRef<DesignerOverlayMode>('idle')
  let disposed = false

  return {
    candidateCommand,
    controller,
    drag,
    overlayMode,
    runtimeGeometry,
    publishCandidate(command) {
      if (!disposed)
        candidateCommand.value = command
    },
    publishGeometry(geometry) {
      if (!disposed)
        runtimeGeometry.value = geometry
    },
    publishOverlayMode(mode) {
      if (!disposed)
        overlayMode.value = mode
    },
    dispose() {
      if (disposed)
        return
      disposed = true
      drag.cancel()
      candidateCommand.value = undefined
      runtimeGeometry.value = undefined
      overlayMode.value = 'idle'
    },
  }
}
