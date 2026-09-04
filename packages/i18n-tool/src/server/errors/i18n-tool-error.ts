import type { I18nToolErrorCode } from '../../shared/protocol'

export class I18nToolError extends Error {
  readonly code: I18nToolErrorCode
  readonly status: number

  constructor(code: I18nToolErrorCode, message: string, status = 500) {
    super(message)
    this.name = 'I18nToolError'
    this.code = code
    this.status = status
  }
}

export function asI18nToolError(error: unknown): I18nToolError {
  return error instanceof I18nToolError
    ? error
    : new I18nToolError('INTERNAL_ERROR', 'The local i18n service failed unexpectedly.')
}
