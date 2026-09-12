export interface SourceActionBindingDiagnostic {
  code: string
  message: string
  pageId: string
  flowId: string
  nodeId: string
  path: Array<string | number>
}

export interface SourceActionBindings {
  files: Record<string, string>
  dependencies: Record<string, string>
  module: string
  refs: string[]
}
