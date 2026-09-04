import type { Component } from 'vue'
import type { ElementPlusDocsExternalProjectSource } from '../../playground/external/vue-project'
import type { ElementPlusDocsPlaygroundAction } from '../../playground/types'

export interface ElementPlusDocsDemoCompileResult {
  component: Component
  dispose: () => void
}

export interface ElementPlusDocsDemoCompileOptions {
  id: string
  onError?: (error: unknown) => void
}

export interface ElementPlusDocsDemoMessages {
  actions: string
  codeCopied: string
  collapseCode: string
  collapseExampleCode: string
  compileError: string
  copied: string
  copyCode: string
  expandCode: string
  expandExampleCode: string
  foldCodeRegion: string
  foldedLine: string
  foldedLines: string
  loading: string
  openCodeSandbox: string
  openElementPlusPlayground: string
  openPlayground: string
  openStackBlitz: string
  playgroundUnavailable: string
  sourceLanguage: string
  unfoldCodeRegion: string
  viewSource: string
}

export type ElementPlusDocsDemoSourceLanguage = 'JS' | 'TS'

export interface ElementPlusDocsDemoProps {
  code: string
  compile: (
    source: string,
    options: ElementPlusDocsDemoCompileOptions,
  ) => Promise<ElementPlusDocsDemoCompileResult>
  copy?: (source: string) => Promise<void>
  demoId: string
  externalProjectCode?: string
  externalProjectJsCode?: string
  highlighted: string
  jsCode?: string
  jsHighlighted?: string
  messages: ElementPlusDocsDemoMessages
  playgroundActions?: readonly ElementPlusDocsPlaygroundAction[]
  openCodeSandbox?: (
    source: string,
    demoId: string,
    projectSource?: ElementPlusDocsExternalProjectSource,
  ) => void | Promise<void>
  openElementPlusPlayground?: (source: string, demoId: string) => void | Promise<void>
  openPlayground?: (source: string, demoId: string) => void | Promise<void>
  openStackBlitz?: (
    source: string,
    demoId: string,
    projectSource?: ElementPlusDocsExternalProjectSource,
  ) => void | Promise<void>
  sourceHref?: string
  title?: string
}
