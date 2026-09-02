import type { ComponentApiContract } from '@moluoxixi/ai-doc-assistant/api-contract'
import type { ElementPlusDocsComponentResolverInput } from '@moluoxixi/vitepress-theme-element-plus'
import type { Component } from 'vue'
import type { ComponentIconName } from '../../catalog/manifests'
import type { DocsLocale } from '../../site/config'
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
  resolveRepositoryComponentMeta,
  resolveRepositoryContributors,
} from '@moluoxixi/vitepress-theme-element-plus'
import { getLocalizedComponentGroups } from '../../catalog/i18n'
import { docsProject, getDocumentedComponent } from '../../catalog/manifests'
import {
  docsRoutePath,
  docsSite,
  getDocsLocaleConfig,
} from '../../site/config'
import { docsRepositoryRuntime } from '../../site/repository'
import { useDocsLocale } from '../composables'

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

const apiModules = import.meta.glob<ComponentApiContract>('../../../.generated/api/*.json', {
  eager: true,
  import: 'default',
})
const apiByName = Object.fromEntries(
  Object.values(apiModules).map(api => [api.name, api]),
) as Record<string, ComponentApiContract>
const componentPackages = Object.values(docsProject.packages)

export const supportedLocalSfcModules = Object.freeze([
  'vue',
  'element-plus',
  'element-plus/dist/index.css',
  ...componentPackages.flatMap(profile => [profile.name, ...profile.styles]),
])

const compileLocalSfc = createElementPlusDocsSfcCompiler({
  async createModuleCache() {
    const [VueRuntime, ElementPlusRuntime, ...packageModules] = await Promise.all([
      import('vue'),
      import('element-plus'),
      ...componentPackages.map(profile => profile.load()),
    ])
    return {
      'vue': VueRuntime,
      'element-plus': ElementPlusRuntime,
      'element-plus/dist/index.css': {},
      ...Object.fromEntries(componentPackages.map((profile, index) => [
        profile.name,
        packageModules[index],
      ])),
      ...Object.fromEntries(componentPackages.flatMap(profile => (
        profile.styles.map(style => [style, {}])
      ))),
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

export function resolveDocsComponentMeta({
  hasSourceDoc,
  link,
  locale,
  name,
  slug,
}: ElementPlusDocsComponentResolverInput) {
  const metadata = docsRepositoryRuntime.getComponentMetadata(name)
  const component = getDocumentedComponent(name)
  const docsSourcePath = component.docsSourcePath
  const sourcePath = docsSourcePath
  const actionInput = docsRepositoryRuntime.createActionInput(name)
  const repositoryContent = resolveRepositoryComponentMeta(
    docsRepositoryRuntime.contentProvider,
    metadata,
    {
      ...actionInput,
      editPath: hasSourceDoc
        ? `${docsSourcePath}/${getDocsLocaleConfig(locale as DocsLocale).sourceDoc}`
        : sourcePath,
      sourcePath,
    },
  )

  return {
    hasSourceDoc,
    importStatement: `import { ${name} } from '${component.packageName}';`,
    name,
    overviewHref: link(docsSite.routes.components),
    ...repositoryContent,
    sourceLabel: `components/${slug}`,
  }
}

export const docsContent = createElementPlusDocsContent({
  playground: {
    compile: compileLocalSfc,
    elementPlus: {
      path: '/vue-playground/',
    },
    external: {
      codeSandbox: {},
      project: {
        description: 'Editable example from the MX Components documentation',
        packageName: 'mx-components-demo',
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
  resolveComponentMeta: resolveDocsComponentMeta,
  resolveContributors({ name }) {
    return resolveRepositoryContributors(
      docsRepositoryRuntime.contentProvider,
      docsRepositoryRuntime.getComponentMetadata(name),
    )
  },
  useLocale: useDocsLocale,
})
