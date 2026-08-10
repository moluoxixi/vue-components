import type { Component } from 'vue'

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
  openElementPlusPlayground: string
  openPlayground: string
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
  highlighted: string
  jsCode?: string
  jsHighlighted?: string
  messages: ElementPlusDocsDemoMessages
  openElementPlusPlayground?: (source: string, demoId: string) => void | Promise<void>
  openPlayground?: (source: string, demoId: string) => void | Promise<void>
  sourceHref?: string
  title?: string
}
