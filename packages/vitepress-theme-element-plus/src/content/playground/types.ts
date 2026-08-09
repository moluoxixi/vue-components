import type {
  ElementPlusDocsDemoCompileOptions,
  ElementPlusDocsDemoCompileResult,
} from '../demo/types'

export interface ElementPlusDocsPlaygroundMessages {
  copied: string
  copy: string
  diagnostics: string
  editor: string
  editorAria: string
  preview: string
  reset: string
  run: string
  running: string
  title: string
}

export type ElementPlusDocsSfcCompiler = (
  source: string,
  options: ElementPlusDocsDemoCompileOptions,
) => Promise<ElementPlusDocsDemoCompileResult>

export interface ElementPlusDocsPlaygroundProps {
  compile: ElementPlusDocsSfcCompiler
  copy?: (source: string) => Promise<void>
  messages: ElementPlusDocsPlaygroundMessages
  sessionQuery?: string
  starterSource: string
}

export interface ElementPlusDocsSfcCompilerOptions {
  createModuleCache: () => Promise<Record<string, unknown>> | Record<string, unknown>
  virtualPathPrefix?: string
}
