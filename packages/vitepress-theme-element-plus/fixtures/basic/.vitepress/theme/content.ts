import type { ElementPlusDocsContentMessages } from '@moluoxixi/vitepress-theme-element-plus'
import { normalizeComponentApiContract } from '@moluoxixi/ai-doc-assistant/api-contract'
import {
  createElementPlusDocsContent,
  createElementPlusDocsSfcCompiler,
} from '@moluoxixi/vitepress-theme-element-plus'
import { ref } from 'vue'

const messages = ref<ElementPlusDocsContentMessages>({
  api: {
    defaultValue: 'Default',
    description: 'Description',
    empty: 'No public API is documented.',
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
    actions: 'Example actions',
    codeCopied: 'Code copied',
    collapseCode: 'Collapse code',
    collapseExampleCode: 'Collapse example code',
    compileError: 'Compile error',
    copied: 'Copied',
    copyCode: 'Copy code',
    expandCode: 'Expand code',
    expandExampleCode: 'Expand example code',
    foldCodeRegion: 'Fold code region',
    foldedLine: '{lines} line folded',
    foldedLines: '{lines} lines folded',
    loading: 'Loading example',
    openCodeSandbox: 'Edit in CodeSandbox',
    openElementPlusPlayground: 'Edit in Vue Playground',
    openPlayground: 'Edit in lightweight playground',
    openStackBlitz: 'Edit in StackBlitz',
    playgroundUnavailable: 'Playground unavailable',
    sourceLanguage: 'Example source language',
    unfoldCodeRegion: 'Unfold code region',
    viewSource: 'View example source',
  },
  meta: {
    addDocs: 'Add docs',
    aria: 'Component information',
    changelog: 'Changelog',
    componentOverview: 'Overview',
    copied: 'Copied',
    copyImport: 'Copy import',
    documentation: 'Documentation',
    editPage: 'Edit page',
    feedback: 'Feedback',
    openIssues: 'Open issues',
    submitIssue: 'Submit issue',
    usage: 'Usage',
  },
  overview: {
    brandKicker: 'Fixture library',
    browseComponents: 'Browse components',
    catalogKicker: 'Catalog',
    componentDocs: 'components',
    factsAria: 'Library facts',
    gettingStarted: 'Get started',
    intro: 'Reusable documentation content',
    noResults: 'No components found',
    runtime: 'runtime',
    searchAria: 'Search components',
    searchPlaceholder: 'Search components',
    title: 'Components',
    typedContracts: 'typed contracts',
    visualInteraction: 'visual interaction',
  },
  playground: {
    copied: 'Copied',
    copy: 'Copy',
    diagnostics: 'Diagnostics',
    editor: 'Editor',
    editorAria: 'Playground source',
    preview: 'Preview',
    reset: 'Reset',
    run: 'Run',
    running: 'Running',
    title: 'Component playground',
  },
  route: { api: 'API' },
  theme: { close: 'Close' },
})

const fixtureApi = normalizeComponentApiContract({
  name: 'FixtureButton',
  packageName: '@fixture/components',
  description: 'A small contract used to verify reusable API documentation.',
  props: [{
    name: 'label',
    type: 'string',
    required: true,
    defaultValue: null,
    description: 'Text rendered inside the button.',
    typeRefs: [],
  }],
  emits: [{
    name: 'click',
    payloadType: 'MouseEvent',
    description: 'Emitted when the button is activated.',
    typeRefs: [],
  }],
  exposed: [],
  slots: [{
    name: 'default',
    scopeType: 'never',
    description: 'Custom button content.',
    typeRefs: [],
  }],
  models: [],
  sourceFile: 'src/FixtureButton.vue',
  typeDefs: [],
})

const compileFixtureSfc = createElementPlusDocsSfcCompiler({
  async createModuleCache() {
    return { vue: await import('vue') }
  },
})

const starterSource = `<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
<\/script>

<template>
  <button data-testid="fixture-starter-button" type="button" @click="count += 1">
    Starter count: {{ count }}
  </button>
</template>
`

export const fixtureContent = createElementPlusDocsContent({
  playground: {
    compile: compileFixtureSfc,
    path: '/playground.html',
    starterSource,
  },
  overview: {
    gettingStartedPath: '/guide/',
    logo: { alt: 'Fixture library', src: '' },
    siteTitle: 'Fixture library',
  },
  resolveCatalog: () => [],
  resolveApi({ name }) {
    if (name !== fixtureApi.name)
      throw new Error(`Unknown fixture API contract: ${name}`)
    return fixtureApi
  },
  resolveComponentMeta: ({ hasSourceDoc, name }) => ({
    commits: [],
    editHref: '/edit',
    hasSourceDoc,
    importStatement: `import { ${name} } from '@fixture/components';`,
    name,
    newIssueHref: '/issues/new',
    openIssueCount: 0,
    openIssuesHref: '/issues',
    overviewHref: '/content.html',
    sourceHref: '/source',
    sourceLabel: 'src/FixtureButton.vue',
  }),
  resolveContributors: () => [],
  resolveOverviewFacts: () => [],
  useLocale: () => ({
    asset: path => path,
    link: path => path,
    locale: ref('en-US'),
    messages,
  }),
})
