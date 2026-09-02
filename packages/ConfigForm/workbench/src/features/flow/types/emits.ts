import type { ProjectCommand } from '@moluoxixi/config-form-model'

export interface FlowDialogEmits {
  close: []
  command: [command: ProjectCommand]
}
