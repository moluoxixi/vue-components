import type {
  EditorCommand,
  EditorCommandInput,
  LaunchEditorArgumentResolver,
  LaunchEditorCommandResolver,
} from '../types'
import { createRequire } from 'node:module'
import { basename, win32 } from 'node:path'
import process from 'node:process'
import { ConfigFormDevtoolsHttpError } from '../errors'

const ALLOWED_EDITOR_COMMANDS = new Set([
  'atom',
  'code',
  'code-insiders',
  'codium',
  'cursor',
  'idea',
  'idea64',
  'nvim',
  'phpstorm',
  'phpstorm64',
  'subl',
  'sublime',
  'vim',
  'webstorm',
  'webstorm64',
])

const require = createRequire(import.meta.url)
const getArgumentsForPosition = require('launch-editor/get-args') as LaunchEditorArgumentResolver
const guessEditorCommand = require('launch-editor/guess') as LaunchEditorCommandResolver

function isEditorLauncher(editor: string): boolean {
  return editor.includes('\\')
    || editor.includes('/')
    || /\.(?:exe|cmd|bat)$/i.test(basename(editor))
}

function shouldUseShell(command: string): boolean {
  if (process.platform !== 'win32')
    return false
  return !basename(command).toLowerCase().endsWith('.exe')
}

function getEditorArgumentResolverName(command: string): string {
  return win32.basename(command).replace(/\.(?:exe|cmd|bat)$/i, '')
}

function getEditorCommandName(command: string): string {
  return getEditorArgumentResolverName(command).toLowerCase()
}

function assertAllowedEditorCommand(command: string): void {
  const editorName = getEditorCommandName(command)
  if (!ALLOWED_EDITOR_COMMANDS.has(editorName)) {
    throw new ConfigFormDevtoolsHttpError(
      403,
      `Editor command is not allowed: ${editorName}`,
    )
  }
}

function resolveEditorExecutable(editor?: string): Pick<EditorCommand, 'args' | 'command' | 'shell'> {
  const [command, ...args] = editor && isEditorLauncher(editor)
    ? [editor]
    : guessEditorCommand(editor)

  if (!command) {
    throw new ConfigFormDevtoolsHttpError(
      500,
      'Unable to resolve editor command. Configure configFormDevtools({ editor: "code" | "cursor" | "webstorm" }) or set LAUNCH_EDITOR.',
    )
  }

  return {
    args,
    command,
    ...(shouldUseShell(command) ? { shell: true } : {}),
  }
}

export function formatEditorCommand(command: EditorCommand): string {
  return [command.command, ...command.args].join(' ')
}

export function createEditorCommand(input: EditorCommandInput): EditorCommand {
  if (input.editor && typeof input.editor === 'object') {
    assertAllowedEditorCommand(input.editor.command)
    if (input.editor.shell) {
      throw new ConfigFormDevtoolsHttpError(
        403,
        'Custom editor commands cannot enable shell execution',
      )
    }
    return input.editor
  }

  const executable = resolveEditorExecutable(input.editor)
  assertAllowedEditorCommand(executable.command)
  const locationArgs = getArgumentsForPosition(
    getEditorArgumentResolverName(executable.command),
    input.file,
    String(input.line),
    String(input.column),
  )

  return {
    ...executable,
    args: [...executable.args, ...locationArgs],
  }
}
