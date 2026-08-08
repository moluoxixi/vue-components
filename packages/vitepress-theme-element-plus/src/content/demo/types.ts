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
  loading: string
  openPlayground: string
  playgroundUnavailable: string
}

export interface ElementPlusDocsDemoProps {
  code: string
  compile: (
    source: string,
    options: ElementPlusDocsDemoCompileOptions,
  ) => Promise<ElementPlusDocsDemoCompileResult>
  copy?: (source: string) => Promise<void>
  demoId: string
  highlighted: string
  messages: ElementPlusDocsDemoMessages
  openPlayground?: (source: string, demoId: string) => void | Promise<void>
  title?: string
}
