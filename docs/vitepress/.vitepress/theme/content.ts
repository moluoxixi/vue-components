import type { ComponentApiContract } from '@moluoxixi/ai-doc-assistant/api-contract'
import type { Component } from 'vue'
import type { ComponentIconName } from '../component-manifest'
import type { DocsLocale } from '../docs-site'
import {
  Blocks,
  CalendarRange,
  Copy,
  FilePenLine,
  FormInput,
  GitBranch,
  ListFilter,
  PanelTopOpen,
  Rows3,
  ScanText,
  TableProperties,
  TextCursorInput,
  TreePine,
} from '@lucide/vue'
import {
  createElementPlusDocsContent,
  createElementPlusDocsSfcCompiler,
} from '@moluoxixi/vitepress-theme-element-plus'
import { getLocalizedComponentGroups } from '../docs-i18n'
import {
  componentSourcePath,
  docsRoutePath,
  docsSite,
  getDocsLocaleConfig,
} from '../docs-site'
import { getComponentGithubMetadata, githubMetadata } from '../github-metadata'
import { useDocsLocale } from './composables/use-docs-locale'

const iconByName: Record<ComponentIconName, Component> = {
  'blocks': Blocks,
  'calendar-range': CalendarRange,
  'copy': Copy,
  'file-pen-line': FilePenLine,
  'form-input': FormInput,
  'git-branch': GitBranch,
  'list-filter': ListFilter,
  'panel-top-open': PanelTopOpen,
  'rows-3': Rows3,
  'scan-text': ScanText,
  'table-properties': TableProperties,
  'text-cursor-input': TextCursorInput,
  'tree-pine': TreePine,
}

const apiModules = import.meta.glob<ComponentApiContract>('../api/*.json', {
  eager: true,
  import: 'default',
})
const apiByName = Object.fromEntries(
  Object.values(apiModules).map(api => [api.name, api]),
) as Record<string, ComponentApiContract>

export const supportedLocalSfcModules = Object.freeze([
  'vue',
  'element-plus',
  'element-plus/dist/index.css',
  docsSite.packageName,
  docsSite.packageStylesImport,
])

const compileLocalSfc = createElementPlusDocsSfcCompiler({
  async createModuleCache() {
    const [VueRuntime, ElementPlusRuntime, Components] = await Promise.all([
      import('vue'),
      import('element-plus'),
      import('@docs-components'),
    ])
    return {
      'vue': VueRuntime,
      'element-plus': ElementPlusRuntime,
      'element-plus/dist/index.css': {},
      [docsSite.packageName]: Components,
      [docsSite.packageStylesImport]: {},
    }
  },
})

const playgroundStarterSource = `<script setup lang="ts">
import { ref } from 'vue'
import { CopyText } from '${docsSite.packageName}'

const text = ref('Hello, MX Components!')
<\/script>

<template>
  <div class="playground-example">
    <input v-model="text" aria-label="Text to copy">
    <CopyText :text="text" />
  </div>
</template>

<style scoped>
.playground-example {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

input {
  width: 240px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
</style>
`

export const docsContent = createElementPlusDocsContent({
  playground: {
    compile: compileLocalSfc,
    elementPlus: {},
    external: {
      codeSandbox: {},
      project: {
        dependencies: {
          '@moluoxixi/components': 'latest',
          'element-plus': '^2.9.0',
        },
        description: 'Editable example from the MX Components documentation',
        packageName: 'mx-components-demo',
        styleImports: [
          'element-plus/dist/index.css',
          '@moluoxixi/components/styles',
        ],
        title: 'MX Components Demo',
      },
      stackBlitz: {},
    },
    path: docsRoutePath('playground'),
    starterSource: playgroundStarterSource,
  },
  overview: {
    gettingStartedPath: docsRoutePath('guide', 'getting-started.html'),
    logo: docsSite.logo,
    siteTitle: docsSite.siteTitle,
  },
  resolveCatalog({ link, locale }) {
    return getLocalizedComponentGroups(locale as DocsLocale).map(group => ({
      description: group.description,
      items: group.items.map(component => ({
        desc: component.description,
        icon: iconByName[component.icon],
        link: link(docsRoutePath('components', `${component.slug}.html`)),
        name: component.name,
      })),
      title: group.title,
    }))
  },
  resolveApi({ name }) {
    const api = apiByName[name]
    if (!api)
      throw new Error(`Missing generated API contract: ${name}`)
    return api
  },
  resolveOverviewFacts({ groups, messages }) {
    const componentCount = groups.reduce((count, group) => count + group.items.length, 0)
    return [
      { value: componentCount, label: messages.overview.componentDocs },
      { value: 'Vue 3.5', label: messages.overview.runtime },
      { value: 'TypeScript', label: messages.overview.typedContracts },
      { value: 'Element Plus', label: messages.overview.visualInteraction },
    ]
  },
  resolveComponentMeta({ hasSourceDoc, link, locale, name, slug }) {
    const metadata = getComponentGithubMetadata(name)
    const sourcePath = componentSourcePath(name)
    const repositoryUrl = docsSite.repository.url
    const branch = githubMetadata.repository.defaultBranch
    const sourceHref = `${repositoryUrl}/tree/${branch}/${sourcePath}`
    const issuePrefix = docsSite.github.issueTitlePrefix(name)

    return {
      commits: metadata.commits,
      editHref: hasSourceDoc
        ? `${repositoryUrl}/edit/${branch}/${sourcePath}/${getDocsLocaleConfig(locale as DocsLocale).sourceDoc}`
        : sourceHref,
      hasSourceDoc,
      importStatement: `import { ${name} } from '${docsSite.packageName}';`,
      name,
      newIssueHref: `${repositoryUrl}/issues/new?title=${encodeURIComponent(`${issuePrefix} `)}`,
      openIssueCount: metadata.openIssueCount,
      openIssuesHref: `${repositoryUrl}/issues?q=${encodeURIComponent(`is:issue is:open in:title "${issuePrefix}"`)}`,
      overviewHref: link(docsSite.routes.components),
      sourceHref,
      sourceLabel: `components/${slug}`,
    }
  },
  resolveContributors({ name }) {
    return getComponentGithubMetadata(name).contributors.flatMap((contribution) => {
      const profile = githubMetadata.profiles[contribution.login]
      return profile ? [{ ...profile, contributions: contribution.contributions }] : []
    })
  },
  useLocale: useDocsLocale,
})
