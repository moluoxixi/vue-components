import type { ReplStore } from '@vue/repl/core'

export type ElementPlusDocsReplCdn = 'jsdelivr' | 'jsdelivr-fastly' | 'unpkg'
export type ElementPlusDocsReplVersionKey = 'elementPlus' | 'typescript' | 'vue'

export interface ElementPlusDocsReplPackage {
  declarations?: string
  moduleUrl: string
  name: string
  styleUrls?: readonly string[]
  version?: string
}

export interface ElementPlusDocsReplSerializedState extends Record<string, unknown> {
  _o?: {
    elementPlusVersion?: string
    typescriptVersion?: string
    vueVersion?: string
  }
}

export interface ElementPlusDocsReplStoreOptions {
  cdn?: ElementPlusDocsReplCdn
  componentPackage: ElementPlusDocsReplPackage
  elementPlusVersion?: string
  initialized?: () => void
  serializedState?: string
  starterSource: string
  typescriptVersion?: string
  vueVersion?: string
}

export interface ElementPlusDocsReplStore extends ReplStore {
  componentPackage: ElementPlusDocsReplPackage
  resetFiles: () => void
  serialize: () => string
  setVersion: (key: ElementPlusDocsReplVersionKey, version: string) => Promise<void>
  versions: Record<ElementPlusDocsReplVersionKey, string>
}

export interface ElementPlusDocsReplProps {
  componentPackage: ElementPlusDocsReplPackage
  elementPlusVersion?: string
  repositoryUrl?: string
  serializedState?: string
  starterSource: string
  title: string
  typescriptVersion?: string
  vueVersion?: string
}
