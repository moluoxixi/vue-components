import type { InjectionKey } from 'vue'
import type { WorkbenchController, WorkbenchControllerProps } from './workbench-controller'
import { inject, provide } from 'vue'
import { createWorkbenchController } from './workbench-controller'

const WORKBENCH_CONTROLLER_KEY: InjectionKey<WorkbenchController> = Symbol('config-form-workbench-controller')

export function provideWorkbenchController(props: Readonly<WorkbenchControllerProps>): WorkbenchController {
  const controller = createWorkbenchController(props)
  provide(WORKBENCH_CONTROLLER_KEY, controller)
  return controller
}

export function useWorkbenchController(): WorkbenchController {
  const controller = inject(WORKBENCH_CONTROLLER_KEY)
  if (!controller)
    throw new Error('[config-form-workbench] Workbench controller is not available.')
  return controller
}
