import type { InjectionKey } from 'vue'
import type { WorkbenchController, WorkbenchControllerProps } from './workbench-controller'
import type { WorkbenchUiStore } from './workbench-ui-store'
import { inject, provide } from 'vue'
import { createWorkbenchController } from './workbench-controller'
import { createWorkbenchUiStore } from './workbench-ui-store'

const WORKBENCH_CONTROLLER_KEY: InjectionKey<WorkbenchController> = Symbol('config-form-workbench-controller')
const WORKBENCH_UI_STORE_KEY: InjectionKey<WorkbenchUiStore> = Symbol('config-form-workbench-ui-store')

export function provideWorkbenchController(props: Readonly<WorkbenchControllerProps>): WorkbenchController {
  const ui = createWorkbenchUiStore(props)
  const controller = createWorkbenchController(props, ui)
  provide(WORKBENCH_UI_STORE_KEY, ui)
  provide(WORKBENCH_CONTROLLER_KEY, controller)
  return controller
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
