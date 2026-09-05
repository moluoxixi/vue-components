import type { ProjectCommand } from '@moluoxixi/config-form-model'

export interface FlowWorkspaceEmits {
  close: []
  command: [command: ProjectCommand]
}
