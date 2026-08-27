export type WorkspaceProjectErrorCode
  = | 'PROJECT_EXISTS'
    | 'PROJECT_INVALID'
    | 'PROJECT_NOT_FOUND'
    | 'PROJECT_PATH_INVALID'
    | 'PROJECT_REVISION_CONFLICT'
    | 'TEMPLATE_DUPLICATE'
    | 'TEMPLATE_INVALID'
    | 'TEMPLATE_NOT_FOUND'

export class WorkspaceProjectError extends Error {
  readonly code: WorkspaceProjectErrorCode

  constructor(code: WorkspaceProjectErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WorkspaceProjectError'
    this.code = code
  }
}
