import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { InjectionKey } from 'vue'
import type { DesignerController } from '../../../composables'
import type {
  CreateDesignerDragControllerOptions,
  DesignerDesignSession,
  DesignerOverlayMode,
  DesignerRuntimeGeometrySnapshot,
} from '../types'
import { shallowRef } from 'vue'
import { createDesignerDragController } from './designer-drag'

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
