import type { ProjectCommandAction, ProjectTheme } from '@moluoxixi/config-form-model'
import { cloneWorkbenchJson } from '../../utils'

export function createWorkbenchThemeCommands(options: {
  executeProjectActions: (label: string, actions: ProjectCommandAction[]) => boolean
}) {
  function updateProjectTheme(theme: ProjectTheme): boolean {
    return options.executeProjectActions('Update project theme', [{
      type: 'operation.apply',
      operations: [{ type: 'project.theme', theme: cloneWorkbenchJson(theme) }],
    }])
  }

  return { updateProjectTheme }
}
