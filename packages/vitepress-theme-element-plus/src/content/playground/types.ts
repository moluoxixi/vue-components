import type {
  ElementPlusDocsDemoCompileOptions,
  ElementPlusDocsDemoCompileResult,
} from '../demo/types'
import type { ElementPlusDocsCodeSandboxOptions } from './external/codesandbox'
import type { ElementPlusDocsStackBlitzOptions } from './external/stackblitz'
import type {
  ElementPlusDocsExternalProjectOptions,
  ElementPlusDocsExternalProjectSource,
} from './external/vue-project'

export const elementPlusDocsPlaygroundKinds = [
  'codesandbox',
  'stackblitz',
  'element-plus',
  'lightweight',
] as const

export type ElementPlusDocsPlaygroundKind = typeof elementPlusDocsPlaygroundKinds[number]

export interface ElementPlusDocsPlaygroundActionContext {
  demoId: string
  projectSource?: ElementPlusDocsExternalProjectSource
  source: string
}

export type ElementPlusDocsPlaygroundActionHandler = (
  context: ElementPlusDocsPlaygroundActionContext,
) => void | Promise<void>

export interface ElementPlusDocsPlaygroundAction {
  kind: ElementPlusDocsPlaygroundKind
  open: ElementPlusDocsPlaygroundActionHandler
}

export interface ElementPlusDocsPlaygroundAdapter {
  createAction: () => ElementPlusDocsPlaygroundAction
  kind: ElementPlusDocsPlaygroundKind
}

export interface ElementPlusDocsPlaygroundConfig {
  compile: ElementPlusDocsSfcCompiler
  copy?: (source: string) => Promise<void>
  elementPlus?: {
    path?: string
    url?: string
  }
  external?: {
    codeSandbox?: ElementPlusDocsCodeSandboxOptions
    project: ElementPlusDocsExternalProjectOptions
    stackBlitz?: ElementPlusDocsStackBlitzOptions
  }
  path: string
  starterSource: string
}

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
