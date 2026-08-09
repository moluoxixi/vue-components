import type { Component } from 'vue'

export interface ElementPlusDocsOverviewCardItem {
  desc: string
  icon: Component
  link: string
  name: string
}

export interface ElementPlusDocsCatalogGroup {
  description: string
  items: readonly ElementPlusDocsOverviewCardItem[]
  title: string
}

export interface ElementPlusDocsOverviewFact {
  label: string
  value: number | string
}

export interface ElementPlusDocsOverviewData {
  facts: readonly ElementPlusDocsOverviewFact[]
  gettingStartedHref: string
  logo: {
    alt: string
    src: string
  }
  siteTitle: string
}
