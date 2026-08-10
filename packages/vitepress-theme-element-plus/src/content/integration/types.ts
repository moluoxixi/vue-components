import type { Component, Plugin, Ref } from 'vue'
import type { ElementPlusDocsComponentApiContract } from '../api/types'
import type { ElementPlusDocsCatalogGroup, ElementPlusDocsOverviewFact } from '../catalog/types'
import type { ElementPlusDocsComponentMetaData, ElementPlusDocsContributor } from '../meta/types'
import type { ElementPlusDocsCodeSandboxOptions } from '../playground/external/codesandbox'
import type { ElementPlusDocsStackBlitzOptions } from '../playground/external/stackblitz'
import type { ElementPlusDocsExternalProjectOptions } from '../playground/external/vue-project'
import type { ElementPlusDocsSfcCompiler } from '../playground/types'
import type { ElementPlusDocsContentMessages } from '../types'

export interface ElementPlusDocsContentRuntime {
  asset: (path: string) => string
  link: (path: string) => string
  locale: Readonly<Ref<string>>
  messages: Readonly<Ref<ElementPlusDocsContentMessages>>
}

export interface ElementPlusDocsContentResolverContext {
  link: (path: string) => string
  locale: string
  messages: ElementPlusDocsContentMessages
}

export interface ElementPlusDocsComponentResolverInput extends ElementPlusDocsContentResolverContext {
  hasSourceDoc: boolean
  name: string
  slug: string
}

export interface ElementPlusDocsApiResolverInput extends ElementPlusDocsContentResolverContext {
  name: string
}

export interface ElementPlusDocsContentIntegration {
  playground: {
    compile: ElementPlusDocsSfcCompiler
    copy?: (source: string) => Promise<void>
    path: string
    elementPlus?: {
      path?: string
      url?: string
    }
    external?: {
      codeSandbox?: ElementPlusDocsCodeSandboxOptions
      project: ElementPlusDocsExternalProjectOptions
      stackBlitz?: ElementPlusDocsStackBlitzOptions
    }
    starterSource: string
  }
  overview: {
    gettingStartedPath: string
    logo: {
      alt: string
      src: string
    }
    siteTitle: string
  }
  resolveCatalog: (
    context: ElementPlusDocsContentResolverContext,
  ) => readonly ElementPlusDocsCatalogGroup[]
  resolveApi: (
    input: ElementPlusDocsApiResolverInput,
  ) => ElementPlusDocsComponentApiContract
  resolveComponentMeta: (
    input: ElementPlusDocsComponentResolverInput,
  ) => ElementPlusDocsComponentMetaData
  resolveContributors: (
    input: Pick<ElementPlusDocsComponentResolverInput, 'link' | 'locale' | 'messages' | 'name'>,
  ) => readonly ElementPlusDocsContributor[]
  resolveOverviewFacts: (
    context: ElementPlusDocsContentResolverContext & {
      groups: readonly ElementPlusDocsCatalogGroup[]
    },
  ) => readonly ElementPlusDocsOverviewFact[]
  useLocale: () => ElementPlusDocsContentRuntime
}

export interface ElementPlusDocsContentComponents {
  ApiDocs: Component
  ComponentDocMeta: Component
  ComponentOverview: Component
  Demo: Component
  DocContributors: Component
  OverviewHome: Component
  Playground: Component
}

export type ElementPlusDocsContentPlugin = Plugin & {
  components: ElementPlusDocsContentComponents
}
