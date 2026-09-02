import type { OpenInEditorPayload } from '../types'
import { ConfigFormDevtoolsHttpError } from '../errors'

export function parseOpenInEditorPayload(input: unknown): OpenInEditorPayload {
  if (!input || typeof input !== 'object')
    throw new ConfigFormDevtoolsHttpError(400, 'Open-in-editor payload must be an object')

  const payload = input as Partial<OpenInEditorPayload>
  if (typeof payload.file !== 'string' || payload.file.length === 0)
    throw new ConfigFormDevtoolsHttpError(400, 'file must be a non-empty string')
  if (!Number.isInteger(payload.line) || Number(payload.line) <= 0)
    throw new ConfigFormDevtoolsHttpError(400, 'line must be a positive integer')
  if (!Number.isInteger(payload.column) || Number(payload.column) <= 0)
    throw new ConfigFormDevtoolsHttpError(400, 'column must be a positive integer')

  return {
    column: Number(payload.column),
    file: payload.file,
    line: Number(payload.line),
  }
}
