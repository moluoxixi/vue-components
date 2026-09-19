import type { SourceFile } from '../../generator'

export type SourceTextFile = Extract<SourceFile, { kind: 'text' }>

export interface MonacoViewerOptions {
  file: SourceTextFile
  theme: 'dark' | 'light'
}

export interface MonacoViewerSession {
  dispose: () => void
  update: (options: MonacoViewerOptions) => void
}

export interface MonacoViewerRuntime {
  mount: (container: HTMLElement, options: MonacoViewerOptions) => MonacoViewerSession
}
