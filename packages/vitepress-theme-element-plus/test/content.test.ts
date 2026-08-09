import type {
  ElementPlusDocsContentMessages,
  ElementPlusDocsOverviewMessages,
} from '../index'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, markRaw, ref } from 'vue'
import {
  createElementPlusDocsContent,
  ElementPlusDocsComponentOverview,
} from '../index'

const overviewMessages: ElementPlusDocsOverviewMessages = {
  brandKicker: 'Library',
  browseComponents: 'Browse',
  catalogKicker: 'Catalog',
  componentDocs: 'components',
  factsAria: 'Facts',
  gettingStarted: 'Start',
  intro: 'Introduction',
  noResults: 'No matches',
  runtime: 'runtime',
  searchAria: 'Search components',
  searchPlaceholder: 'Search',
  title: 'Components',
  typedContracts: 'types',
  visualInteraction: 'visuals',
}

const contentMessages: ElementPlusDocsContentMessages = {
  changelog: { aria: '{name} changelog', commitLink: 'Commit {sha}', empty: 'No commits' },
  contributors: { aria: '{name} contributors', contribution: '{count} commits to {name}', empty: 'No contributors' },
  meta: {
    addDocs: 'Add docs',
    aria: 'Component information',
    changelog: 'Changelog',
    componentOverview: 'Overview',
    copied: 'Copied',
    copyImport: 'Copy import',
    documentation: 'Docs',
    editPage: 'Edit',
    feedback: 'Feedback',
    openIssues: 'Open issues',
    submitIssue: 'New issue',
    usage: 'Usage',
  },
  overview: overviewMessages,
  route: { api: 'API' },
  theme: { close: 'Close' },
}

const icon = markRaw(defineComponent(() => () => h('span')))
const groups = [{
  description: 'Input and selection controls',
  items: [
    { desc: 'Copies text', icon, link: '/copy', name: 'CopyText' },
    { desc: 'Selects values', icon, link: '/select', name: 'RequestSelect' },
  ],
  title: 'Forms',
}]

describe('reusable content modules', () => {
  it('filters the package-owned component catalog by name and description', async () => {
    const wrapper = mount(ElementPlusDocsComponentOverview, {
      props: { groups, messages: overviewMessages },
    })

    expect(wrapper.text()).toContain('CopyText')
    expect(wrapper.text()).toContain('RequestSelect')

    await wrapper.get('input').setValue('copies')

    expect(wrapper.text()).toContain('CopyText')
    expect(wrapper.text()).not.toContain('RequestSelect')
  })

  it('registers the conventional Markdown components from one integration', () => {
    const plugin = createElementPlusDocsContent({
      overview: {
        gettingStartedPath: '/guide/',
        logo: { alt: 'Fixture', src: '/logo.svg' },
        siteTitle: 'Fixture',
      },
      resolveCatalog: () => groups,
      resolveComponentMeta: ({ hasSourceDoc, name }) => ({
        commits: [],
        editHref: '/edit',
        hasSourceDoc,
        importStatement: `import { ${name} } from 'fixture'`,
        name,
        newIssueHref: '/issues/new',
        openIssueCount: 0,
        openIssuesHref: '/issues',
        overviewHref: '/components/',
        sourceHref: '/source',
        sourceLabel: 'components/example',
      }),
      resolveContributors: () => [],
      resolveOverviewFacts: () => [],
      useLocale: () => ({
        asset: path => path,
        link: path => path,
        locale: ref('en-US'),
        messages: ref(contentMessages),
      }),
    })
    const app = createApp(defineComponent(() => () => null))

    app.use(plugin)

    expect(Object.keys(plugin.components)).toEqual([
      'ComponentDocMeta',
      'ComponentOverview',
      'DocContributors',
      'OverviewHome',
    ])
    expect(app.component('ComponentDocMeta')).toBe(plugin.components.ComponentDocMeta)
    expect(app.component('OverviewHome')).toBe(plugin.components.OverviewHome)
  })
})
