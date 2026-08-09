import type { ElementPlusDocsApiDocsMessages } from './api/types'
import type { ElementPlusDocsDemoMessages } from './demo/types'
import type { ElementPlusDocsPlaygroundMessages } from './playground/types'

export interface ElementPlusDocsOverviewMessages {
  brandKicker: string
  browseComponents: string
  catalogKicker: string
  componentDocs: string
  factsAria: string
  gettingStarted: string
  intro: string
  noResults: string
  runtime: string
  searchAria: string
  searchPlaceholder: string
  title: string
  typedContracts: string
  visualInteraction: string
}

export interface ElementPlusDocsMetaMessages {
  addDocs: string
  aria: string
  changelog: string
  componentOverview: string
  copied: string
  copyImport: string
  documentation: string
  editPage: string
  feedback: string
  openIssues: string
  submitIssue: string
  usage: string
}

export interface ElementPlusDocsContributorsMessages {
  aria: string
  contribution: string
  empty: string
}

export interface ElementPlusDocsChangelogMessages {
  aria: string
  commitLink: string
  empty: string
}

export interface ElementPlusDocsContentMessages {
  api: ElementPlusDocsApiDocsMessages
  changelog: ElementPlusDocsChangelogMessages
  contributors: ElementPlusDocsContributorsMessages
  demo: ElementPlusDocsDemoMessages
  meta: ElementPlusDocsMetaMessages
  overview: ElementPlusDocsOverviewMessages
  playground: ElementPlusDocsPlaygroundMessages
  route: {
    api: string
  }
  theme: {
    close: string
  }
}
