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
import { createElementPlusDocsContent } from '@moluoxixi/vitepress-theme-element-plus'
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

export const docsContent = createElementPlusDocsContent({
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
