import type {
  ElementPlusDocsContentMessages,
  ElementPlusDocsOverviewMessages,
} from '../index'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, markRaw, ref } from 'vue'
import {
  createElementPlusDocsContent,
  ElementPlusDocsApiDocs,
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
  api: {
    defaultValue: 'Default',
    description: 'Description',
    empty: 'No API',
    name: 'Name',
    parameters: 'Parameters',
    permanentLink: 'Permanent link to {section}',
    required: 'Required',
    scope: 'Scope',
    sections: { emits: 'Emits', expose: 'Expose', props: 'Props', slots: 'Slots' },
    tableAria: '{section} API',
    type: 'Type',
    typeDetails: 'Details for {type}',
    yes: 'Yes',
  },
  changelog: { aria: '{name} changelog', commitLink: 'Commit {sha}', empty: 'No commits' },
  contributors: { aria: '{name} contributors', contribution: '{count} commits to {name}', empty: 'No contributors' },
  demo: {
    actions: 'Actions',
    codeCopied: 'Code copied',
    collapseCode: 'Collapse',
    collapseExampleCode: 'Collapse example',
    compileError: 'Compile error',
    copied: 'Copied',
    copyCode: 'Copy',
    expandCode: 'Expand',
    expandExampleCode: 'Expand example',
    foldCodeRegion: 'Fold code region',
    foldedLine: '{lines} line folded',
    foldedLines: '{lines} lines folded',
    loading: 'Loading',
    openPlayground: 'Open playground',
    playgroundUnavailable: 'Playground unavailable',
    sourceLanguage: 'Source language',
    unfoldCodeRegion: 'Unfold code region',
    viewSource: 'View source',
  },
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
  playground: {
    copied: 'Copied',
    copy: 'Copy',
    diagnostics: 'Diagnostics',
    editor: 'Editor',
    editorAria: 'Editor source',
    preview: 'Preview',
    reset: 'Reset',
    run: 'Run',
    running: 'Running',
    title: 'Playground',
  },
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

  it('renders a normalized component API contract', () => {
    const wrapper = mount(ElementPlusDocsApiDocs, {
      props: {
        api: {
          description: 'Copies text',
          emits: [],
          expose: [],
          name: 'CopyText',
          props: [{ description: 'Text to copy', name: 'text', required: true, type: 'string' }],
          slots: [],
        },
        messages: contentMessages.api,
      },
    })

    expect(wrapper.text()).toContain('Props')
    expect(wrapper.text()).toContain('Text to copy')
    expect(wrapper.find('#CopyText-props').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Emits')
  })

  it('registers the conventional Markdown components from one integration', () => {
    const plugin = createElementPlusDocsContent({
      playground: {
        compile: async () => ({ component: icon, dispose: () => undefined }),
        path: '/playground',
        starterSource: '<template />',
      },
      overview: {
        gettingStartedPath: '/guide/',
        logo: { alt: 'Fixture', src: '/logo.svg' },
        siteTitle: 'Fixture',
      },
      resolveCatalog: () => groups,
      resolveApi: ({ name }) => ({
        description: '',
        emits: [],
        expose: [],
        name,
        props: [],
        slots: [],
      }),
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
      'ApiDocs',
      'ComponentDocMeta',
      'ComponentOverview',
      'Demo',
      'DocContributors',
      'OverviewHome',
      'Playground',
    ])
    expect(app.component('ApiDocs')).toBe(plugin.components.ApiDocs)
    expect(app.component('ComponentDocMeta')).toBe(plugin.components.ComponentDocMeta)
    expect(app.component('OverviewHome')).toBe(plugin.components.OverviewHome)
  })
})
