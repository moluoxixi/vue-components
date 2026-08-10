import type {
  ElementPlusDocsContentMessages,
  ElementPlusDocsOverviewMessages,
} from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { decompressFromBase64 } from 'lz-string'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    openCodeSandbox: 'Edit in CodeSandbox',
    openElementPlusPlayground: 'Edit in Vue Playground',
    openPlayground: 'Edit in lightweight playground',
    openStackBlitz: 'Edit in StackBlitz',
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

function formFields(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...form.querySelectorAll<HTMLInputElement>('input')].map(input => [input.name, input.value]),
  )
}

function decodeCodeSandboxParameters(parameters: string) {
  const base64 = parameters.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return JSON.parse(decompressFromBase64(padded)) as {
    files: Record<string, { content: string }>
  }
}

describe('reusable content modules', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('registers and wires the conventional Markdown components from one integration', async () => {
    const plugin = createElementPlusDocsContent({
      playground: {
        compile: async () => ({ component: icon, dispose: () => undefined }),
        external: {
          codeSandbox: {},
          project: { title: 'Fixture demo' },
          stackBlitz: {},
        },
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

    const submittedForms: HTMLFormElement[] = []
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      submittedForms.push(this.cloneNode(true) as HTMLFormElement)
    })
    const tsSource = '<script setup lang="ts">const value: number = 1</script><template>{{ value }}</template>'
    const jsSource = '<script setup>const value = 1</script><template>{{ value }}</template>'
    const demo = mount(plugin.components.Demo, {
      attachTo: document.body,
      props: {
        code: btoa(tsSource),
        demoId: 'fixture-demo',
        highlighted: btoa('<pre>TS</pre>'),
        jsCode: btoa(jsSource),
        jsHighlighted: btoa('<pre>JS</pre>'),
      },
      global: {
        stubs: { ClientOnly: { template: '<slot />' } },
      },
    })
    await flushPromises()
    const languageOptions = demo.get('[data-testid="demo-source-language"]').findAll('.el-segmented__item')
    await languageOptions.find(option => option.text() === 'JS')!.trigger('click')
    await flushPromises()
    await demo.get('[data-testid="demo-stackblitz"]').trigger('click')
    await demo.get('[data-testid="demo-codesandbox"]').trigger('click')

    const stackBlitzForm = submittedForms.find(form => new URL(form.action).host === 'stackblitz.com')
    const codeSandboxForm = submittedForms.find(form => new URL(form.action).host === 'codesandbox.io')
    expect(stackBlitzForm).toBeDefined()
    expect(codeSandboxForm).toBeDefined()
    expect(formFields(stackBlitzForm!)['project[files][src/App.vue]']).toBe(jsSource)
    const codeSandboxPayload = decodeCodeSandboxParameters(formFields(codeSandboxForm!).parameters!)
    expect(codeSandboxPayload.files['src/App.vue']?.content).toBe(jsSource)
    demo.unmount()
  })
})
