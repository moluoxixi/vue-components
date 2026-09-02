import type { EditorCommand, OpenInEditorOptions, SpawnEditorProcess } from '../types'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { ConfigFormDevtoolsHttpError } from '../errors'
import { parseOpenInEditorPayload } from '../schemas'
import { createEditorCommand, formatEditorCommand, resolveAllowedFile } from '../utils'

export function launchEditor(
  command: EditorCommand,
  spawnEditor: SpawnEditorProcess = spawn,
): Promise<void> {
  return new Promise((resolveLaunch, rejectLaunch) => {
    let settled = false
    const child = spawnEditor(command.command, command.args, {
      detached: true,
      ...(command.shell ? { shell: true } : {}),
      stdio: 'ignore',
    })

    function settle(error?: Error) {
      if (settled)
        return
      settled = true
      if (error) {
        rejectLaunch(error)
        return
      }
      child.unref()
      resolveLaunch()
    }

    child.once('error', (error) => {
      const message = error instanceof Error ? error.message : String(error)
      settle(new Error(`Failed to start editor command "${formatEditorCommand(command)}": ${message}`))
    })

    if (command.shell) {
      child.once('exit', (code, signal) => {
        if (typeof code === 'number' && code !== 0) {
          settle(new Error(`Editor command "${formatEditorCommand(command)}" exited with code ${code}`))
          return
        }
        if (signal) {
          settle(new Error(`Editor command "${formatEditorCommand(command)}" exited with signal ${signal}`))
          return
        }
        settle()
      })
      return
    }

    child.once('spawn', () => settle())
  })
}

export async function openInEditor(payload: unknown, options: OpenInEditorOptions): Promise<void> {
  const parsed = parseOpenInEditorPayload(payload)
  const file = resolveAllowedFile({
    allowRoots: options.allowRoots,
    file: parsed.file,
    root: options.root,
  })

  if (!existsSync(file))
    throw new ConfigFormDevtoolsHttpError(404, `File does not exist: ${file}`)

  const command = createEditorCommand({
    ...parsed,
    editor: options.editor,
    file,
  })
  await launchEditor(command, options.spawn)
}
