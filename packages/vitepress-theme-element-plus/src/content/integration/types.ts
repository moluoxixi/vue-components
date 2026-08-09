import type { Component, Plugin, Ref } from 'vue'
import type { ElementPlusDocsCatalogGroup, ElementPlusDocsOverviewFact } from '../catalog/types'
import type { ElementPlusDocsComponentMetaData, ElementPlusDocsContributor } from '../meta/types'
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

export interface ElementPlusDocsContentIntegration {
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
  ComponentDocMeta: Component
  ComponentOverview: Component
  DocContributors: Component
  OverviewHome: Component
}

export type ElementPlusDocsContentPlugin = Plugin & {
  components: ElementPlusDocsContentComponents
}
