import type { languages } from 'monaco-editor'

export type MonacoWorkerEnvironment = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (moduleId: string, label: string) => Worker
  }
}

export interface TypeScriptDisplayPart {
  text: string
}

export interface TypeScriptTextSpan {
  length: number
  start: number
}

export interface TypeScriptCompletionEntry {
  kind: string
  kindModifiers?: string
  name: string
  replacementSpan?: TypeScriptTextSpan
  sortText: string
}

export interface TypeScriptCompletionInfo {
  entries: TypeScriptCompletionEntry[]
}

export interface TypeScriptCompletionDetails {
  displayParts?: TypeScriptDisplayPart[]
  documentation?: TypeScriptDisplayPart[]
  kind: string
  name: string
  tags?: Array<{ name: string, text?: string | TypeScriptDisplayPart[] }>
}

export interface TypeScriptQuickInfo {
  displayParts?: TypeScriptDisplayPart[]
  documentation?: TypeScriptDisplayPart[]
  tags?: Array<{ name: string, text?: string | TypeScriptDisplayPart[] }>
  textSpan: TypeScriptTextSpan
}

export interface VueTypeScriptCompletionItem extends languages.CompletionItem {
  typeScriptEntry?: {
    mirrorUri: string
    name: string
    offset: number
  }
}
