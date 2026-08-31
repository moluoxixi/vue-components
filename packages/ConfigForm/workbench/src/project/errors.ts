export type WorkbenchProjectErrorCode
  = | 'PROJECT_EXISTS'
    | 'PROJECT_INVALID'
    | 'PROJECT_NOT_FOUND'
    | 'PROJECT_PATH_INVALID'
    | 'PROJECT_REVISION_CONFLICT'
    | 'TEMPLATE_DUPLICATE'
    | 'TEMPLATE_INVALID'
    | 'TEMPLATE_NOT_FOUND'

export class WorkbenchProjectError extends Error {
  readonly code: WorkbenchProjectErrorCode

  constructor(code: WorkbenchProjectErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WorkbenchProjectError'
    this.code = code
  }
}
