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
  ElementPlusDocsComponentMeta,
  ElementPlusDocsComponentOverview,
  ElementPlusDocsContributors,
} from '../index'
import ElementPlusDocsCommitTimeline from '../src/content/meta/ElementPlusDocsCommitTimeline.vue'

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

  it('renders local Git contributors without inventing GitHub profiles', () => {
    const wrapper = mount(ElementPlusDocsContributors, {
      props: {
        contributors: [{
          contributions: 3,
          id: 'git:local-author',
          name: 'Local Author',
        }],
        messages: contentMessages,
        name: 'CopyText',
      },
      global: {
        stubs: {
          ElTooltip: { template: '<div><slot /><slot name="content" /></div>' },
        },
      },
    })

    expect(wrapper.get('.doc-contributor-initials').text()).toBe('LA')
    expect(wrapper.get('.doc-contributor-link').attributes('tabindex')).toBeUndefined()
    expect(wrapper.find('.doc-contributor-link[href]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('GitHub @')
  })

  it('renders verified contributor profiles with their avatar and account link', () => {
    const wrapper = mount(ElementPlusDocsContributors, {
      props: {
        contributors: [{
          avatarUrl: 'https://gitlab.test/uploads/alice.png',
          contributions: 3,
          id: 'gitlab:alice',
          login: 'alice',
          name: 'Alice Account',
          profileUrl: 'https://gitlab.test/alice',
        }],
        messages: contentMessages,
        name: 'CopyText',
      },
      global: {
        stubs: {
          ElTooltip: { template: '<div><slot /><slot name="content" /></div>' },
        },
      },
    })

    const link = wrapper.get('.doc-contributor-link')
    expect(link.attributes()).toMatchObject({
      href: 'https://gitlab.test/alice',
      rel: 'noreferrer',
      target: '_blank',
    })
    expect(link.attributes('aria-label')).toContain('@alice')
    expect(link.get('.doc-contributor-avatar').attributes('src')).toBe('https://gitlab.test/uploads/alice.png')
    expect(wrapper.text()).toContain('@alice')
  })

  it('renders a verified contributor avatar without inventing an account link', () => {
    const wrapper = mount(ElementPlusDocsContributors, {
      props: {
        contributors: [{
          avatarUrl: 'https://codeup.test/avatar.png',
          contributions: 3,
          id: 'yunxiao:alice',
          login: 'alice',
          name: 'Alice Account',
        }],
        messages: contentMessages,
        name: 'CopyText',
      },
      global: {
        stubs: {
          ElTooltip: { template: '<div><slot /><slot name="content" /></div>' },
        },
      },
    })

    const contributor = wrapper.get('.doc-contributor-link')
    expect(contributor.element.tagName).toBe('SPAN')
    expect(contributor.attributes('href')).toBeUndefined()
    expect(contributor.get('.doc-contributor-avatar').attributes('src')).toBe('https://codeup.test/avatar.png')
    expect(wrapper.text()).toContain('@alice')
  })

  it('does not render changelog controls for an empty commit history', () => {
    const wrapper = mount(ElementPlusDocsComponentMeta, {
      props: {
        data: {
          commits: [],
          hasSourceDoc: true,
          importStatement: 'import { CopyText } from \'@moluoxixi/components\';',
          name: 'CopyText',
          overviewHref: '/components/',
          sourceLabel: 'components/copy-text',
        },
        locale: 'en-US',
        messages: contentMessages,
      },
      global: {
        stubs: {
          ClientOnly: { template: '<slot />' },
        },
      },
    })

    expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(contentMessages.meta.changelog)
  })

  it('renders a verified commit avatar without inventing an author profile link', () => {
    const wrapper = mount(ElementPlusDocsCommitTimeline, {
      props: {
        commits: [{
          author: {
            avatarUrl: 'https://codeup.test/avatar.png',
            login: 'alice',
            name: 'Alice Account',
          },
          date: '2026-08-21T00:00:00.000Z',
          message: 'docs: update example',
          sha: 'a'.repeat(40),
          shortSha: 'aaaaaaa',
          url: 'https://codeup.test/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }],
        locale: 'en-US',
        messages: contentMessages,
        name: 'CopyText',
      },
    })

    const author = wrapper.get('.component-commit-author')
    expect(author.element.tagName).toBe('SPAN')
    expect(author.attributes('href')).toBeUndefined()
    expect(author.get('img').attributes('src')).toBe('https://codeup.test/avatar.png')
  })

  it('registers and wires the conventional Markdown components from one integration', async () => {
    const plugin = createElementPlusDocsContent({
      playground: {
        compile: async () => ({ component: icon, dispose: () => undefined }),
        elementPlus: { path: '/vue-playground/' },
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
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      submittedForms.push(this.cloneNode(true) as HTMLFormElement)
    })
    const tsSource = '<script setup lang="ts">const value: number = 1</script><template>{{ value }}</template>'
    const jsSource = '<script setup>const value = 1</script><template>{{ value }}</template>'
    const resolvedTsSource = '<script setup lang="ts">import { CopyText } from \'@moluoxixi/components/CopyText\'</script><template><CopyText /></template>'
    const resolvedJsSource = '<script setup>import { CopyText } from \'@moluoxixi/components/CopyText\'</script><template><CopyText /></template>'
    const encodeProjectSource = (source: string) => btoa(JSON.stringify({
      dependencies: {
        '@moluoxixi/components': 'latest',
        'vue': '^3.5.0',
      },
      source,
      styleImports: ['@moluoxixi/components/styles'],
    }))
    const demo = mount(plugin.components.Demo, {
      attachTo: document.body,
      props: {
        code: btoa(tsSource),
        demoId: 'fixture-demo',
        externalProjectCode: encodeProjectSource(resolvedTsSource),
        externalProjectJsCode: encodeProjectSource(resolvedJsSource),
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
    await demo.get('[data-testid="demo-element-plus-playground"]').trigger('click')

    const stackBlitzForm = submittedForms.find(form => new URL(form.action).host === 'stackblitz.com')
    const codeSandboxForm = submittedForms.find(form => new URL(form.action).host === 'codesandbox.io')
    expect(stackBlitzForm).toBeDefined()
    expect(codeSandboxForm).toBeDefined()
    expect(formFields(stackBlitzForm!)['project[files][src/App.vue]']).toBe(resolvedJsSource)
    expect(formFields(stackBlitzForm!)['project[files][src/main.ts]']).toContain('@moluoxixi/components/styles')
    expect(JSON.parse(formFields(stackBlitzForm!)['project[files][package.json]']!).dependencies).toEqual({
      '@moluoxixi/components': 'latest',
      'vue': '^3.5.0',
    })
    const codeSandboxPayload = decodeCodeSandboxParameters(formFields(codeSandboxForm!).parameters!)
    expect(codeSandboxPayload.files['demo.js']?.content).toContain('export default `<script setup>')
    expect(codeSandboxPayload.files['demo.js']?.content).toContain(resolvedJsSource)
    expect(codeSandboxPayload.files['main.js']?.content).toContain('import demoSource from \'./demo.js\'')
    expect(codeSandboxPayload.files['main.js']?.content).toContain('import { mountDemo } from \'./load-module.js\'')
    expect(codeSandboxPayload.files['main.js']?.content).toContain('fetch(new URL(\'./package.json\', import.meta.url))')
    expect(codeSandboxPayload.files['load-module.js']?.content).toContain('vue3-sfc-loader@0.9.5')
    const codeSandboxPackageJson = JSON.parse(codeSandboxPayload.files['package.json']!.content)
    expect(codeSandboxPackageJson.dependencies).toEqual({
      '@moluoxixi/components': 'latest',
      'vue': '^3.5.0',
    })
    expect(codeSandboxPackageJson.elementPlusDocs.styleImports).toEqual([
      '@moluoxixi/components/styles',
    ])
    expect(codeSandboxPayload.files['index.html']?.content).toContain('id="app"')
    expect(codeSandboxPayload.files['index.html']?.content).toContain('src="./main.js"')
    expect(codeSandboxPayload.files['sandbox.config.json']?.content).toBe('{"template":"static"}')
    expect(codeSandboxPayload.files).not.toHaveProperty('src/App.vue')
    expect(codeSandboxPayload.files).not.toHaveProperty('src/main.ts')
    expect(codeSandboxPayload.files).not.toHaveProperty('vite.config.ts')
    const replUrl = new URL(String(open.mock.calls[0]?.[0]))
    expect(replUrl.pathname).toBe('/vue-playground/')
    const replState = JSON.parse(decodeURIComponent(escape(atob(replUrl.hash.slice(1)))))
    expect(replState['App.vue']).toBe(jsSource)
    demo.unmount()
  })
})
