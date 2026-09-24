import type { ProjectCommandAction } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createWorkbenchThemeCommands } from '../services/controller-theme-commands'

describe('workbench project theme commands', () => {
  it('commits one project.theme operation for the complete structured theme', () => {
    let committedActions: ProjectCommandAction[] = []
    const executeProjectActions = vi.fn((_label: string, actions: ProjectCommandAction[]) => {
      committedActions = actions
      return true
    })
    const commands = createWorkbenchThemeCommands({ executeProjectActions })
    const theme = reactive({
      version: 1 as const,
      colors: { primary: '#336699' },
      border: { width: 2, style: 'dashed' as const },
    })
    expect(commands.updateProjectTheme(theme)).toBe(true)
    expect(executeProjectActions).toHaveBeenCalledWith('Update project theme', [{
      type: 'operation.apply',
      operations: [{ type: 'project.theme', theme: {
        version: 1,
        colors: { primary: '#336699' },
        border: { width: 2, style: 'dashed' },
      } }],
    }])
    const action = committedActions[0]
    const committed = action?.type === 'operation.apply' ? action.operations[0] : undefined
    expect(committed && 'theme' in committed ? committed.theme : undefined).not.toBe(theme)
  })
})
