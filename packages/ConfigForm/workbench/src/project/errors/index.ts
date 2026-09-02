import type { WorkbenchProjectErrorCode } from '../types'

export class WorkbenchProjectError extends Error {
  readonly code: WorkbenchProjectErrorCode

  constructor(code: WorkbenchProjectErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WorkbenchProjectError'
    this.code = code
  }
}
