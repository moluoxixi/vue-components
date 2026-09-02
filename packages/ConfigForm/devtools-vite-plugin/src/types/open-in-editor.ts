import type { ChildProcess } from 'node:child_process'

export interface EditorCommand {
  command: string
  args: string[]
  shell?: boolean
}

export interface OpenInEditorPayload {
  file: string
  line: number
  column: number
}

export interface EditorCommandInput extends OpenInEditorPayload {
  editor?: string | EditorCommand
}

export type SpawnEditorProcess = (
  command: string,
  args: string[],
  options: { detached: boolean, shell?: boolean, stdio: 'ignore' },
) => ChildProcess

export interface OpenInEditorOptions {
  root: string
  allowRoots?: string[]
  editor?: string | EditorCommand
  spawn?: SpawnEditorProcess
}

export interface ResolveAllowedFileInput {
  file: string
  root: string
  allowRoots?: string[]
}

export type LaunchEditorArgumentResolver = (
  editor: string,
  fileName: string,
  lineNumber: string,
  columnNumber: string,
) => string[]

export type LaunchEditorCommandResolver = (specifiedEditor?: string) => [string | null, ...string[]]
