import type { InjectionKey } from 'vue'
import type {
  PreviewSession,
  WorkbenchDesignSession,
  WorkbenchExportService,
} from '../session'
import type { WorkbenchController, WorkbenchControllerProps } from './workbench-controller'
import type { WorkbenchUiStore } from './workbench-ui-store'
import { inject, provide } from 'vue'
import { createWorkbenchController } from './workbench-controller'
import { createWorkbenchUiStore } from './workbench-ui-store'

const WORKBENCH_CONTROLLER_KEY: InjectionKey<WorkbenchController> = Symbol('config-form-workbench-controller')
const WORKBENCH_UI_STORE_KEY: InjectionKey<WorkbenchUiStore> = Symbol('config-form-workbench-ui-store')
const WORKBENCH_DESIGN_SESSION_KEY: InjectionKey<WorkbenchDesignSession> = Symbol('config-form-workbench-design-session')
const WORKBENCH_PREVIEW_SESSION_KEY: InjectionKey<PreviewSession> = Symbol('config-form-workbench-preview-session')
const WORKBENCH_EXPORT_SERVICE_KEY: InjectionKey<WorkbenchExportService> = Symbol('config-form-workbench-export-service')

export function provideWorkbenchController(props: Readonly<WorkbenchControllerProps>): {
  controller: WorkbenchController
  ui: WorkbenchUiStore
} {
  const ui = createWorkbenchUiStore(props)
  const controller = createWorkbenchController(props, ui)
  provide(WORKBENCH_UI_STORE_KEY, ui)
  provide(WORKBENCH_DESIGN_SESSION_KEY, controller.designSession)
  provide(WORKBENCH_PREVIEW_SESSION_KEY, controller.previewSession)
  provide(WORKBENCH_EXPORT_SERVICE_KEY, controller.exportService)
  provide(WORKBENCH_CONTROLLER_KEY, controller)
  return { controller, ui }
}

export function useWorkbenchDesignSession(): WorkbenchDesignSession {
  const session = inject(WORKBENCH_DESIGN_SESSION_KEY)
  if (!session)
    throw new Error('[config-form-workbench] Design session is not available.')
  return session
}

export function useWorkbenchPreviewSession(): PreviewSession {
  const session = inject(WORKBENCH_PREVIEW_SESSION_KEY)
  if (!session)
    throw new Error('[config-form-workbench] Preview session is not available.')
  return session
}

export function useWorkbenchExportService(): WorkbenchExportService {
  const service = inject(WORKBENCH_EXPORT_SERVICE_KEY)
  if (!service)
    throw new Error('[config-form-workbench] Export service is not available.')
  return service
}

export function useWorkbenchController(): WorkbenchController {
  const controller = inject(WORKBENCH_CONTROLLER_KEY)
  if (!controller)
    throw new Error('[config-form-workbench] Workbench controller is not available.')
  return controller
}

export function useWorkbenchUiStore(): WorkbenchUiStore {
  const ui = inject(WORKBENCH_UI_STORE_KEY)
  if (!ui)
    throw new Error('[config-form-workbench] Workbench UI store is not available.')
  return ui
}
