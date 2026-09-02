export interface ModuleSpecifierContext {
  endOffset: number
  startOffset: number
  typed: string
}

export type MonacoWorkerKind = 'editor' | 'html' | 'json' | 'typescript'

export interface NamedImportContext {
  endOffset: number
  moduleName: string
  startOffset: number
}

export interface VueScriptRange {
  endOffset: number
  startOffset: number
}
