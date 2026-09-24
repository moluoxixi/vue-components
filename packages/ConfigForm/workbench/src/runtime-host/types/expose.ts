import type { PrototypeSessionCommand } from '@moluoxixi/config-form-prototype-runtime/session'

export interface ExperienceRuntimeHostFrameExpose {
  dispatch: (command: PrototypeSessionCommand | unknown) => void
}
