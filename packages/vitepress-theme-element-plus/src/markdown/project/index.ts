import type MarkdownIt from 'markdown-it'
import type { ElementPlusDocsProjectInput } from '../../project/types'
import process from 'node:process'
import { repositoryMetadataProviders } from '../../content/repository/providers'
import { repositoryMetadataProviderSupports } from '../../content/repository/registry'
import { readElementPlusDocsPlaygroundManifests } from '../../node/playground'
import {
  resolveElementPlusDocsProject,
  resolveElementPlusDocsProjectRepository,
} from '../../project/config'
import { elementPlusDocsDemoPlugin } from '../demo'
import { createElementPlusDocsExternalProjectSourceResolver } from '../playground'
import { createElementPlusDocsDemoSourceHrefResolver } from '../source'

export interface ElementPlusDocsProjectMarkdownPluginOptions {
  dependencyRoot?: string
  project: ElementPlusDocsProjectInput
  projectRoot?: string
  providerOverride?: string
  playgroundManifestsPath?: string
}

export function elementPlusDocsProjectMarkdownPlugin(
  md: MarkdownIt,
  options: ElementPlusDocsProjectMarkdownPluginOptions,
): void {
  const project = resolveElementPlusDocsProject(options.project)
  const projectRoot = options.projectRoot
    ?? process.env.ELEMENT_PLUS_DOCS_PROJECT_ROOT
    ?? process.cwd()
  const dependencyRoot = options.dependencyRoot
    ?? process.env.ELEMENT_PLUS_DOCS_DOCS_ROOT
    ?? projectRoot
  const providerOverride = options.providerOverride
    ?? process.env.VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  const repository = resolveElementPlusDocsProjectRepository(project, providerOverride)
  const provider = repositoryMetadataProviders.get(repository.provider)
  const playgroundManifestsPath = options.playgroundManifestsPath
    ?? process.env.ELEMENT_PLUS_DOCS_PLAYGROUND_MANIFESTS_PATH
  const requiresPlaygroundManifests = Object.values(project.packages)
    .some(profile => Boolean(profile.loadPlaygroundManifest))
  if (requiresPlaygroundManifests && !playgroundManifestsPath) {
    throw new TypeError(
      'Playground manifests were not prepared. Run the documentation through element-plus-docs.',
    )
  }
  const playgroundManifests = playgroundManifestsPath
    ? readElementPlusDocsPlaygroundManifests(project, playgroundManifestsPath)
    : {}
  const resolveExternalProjectSource = createElementPlusDocsExternalProjectSourceResolver({
    dependencyRoot,
    playgroundManifests,
    project,
  })
  const sourceLinksSupported = repositoryMetadataProviderSupports(provider, 'sourceLinks')
  const defaultBranch = repository.defaultBranch
    ?? process.env.VITE_DOCS_REPOSITORY_DEFAULT_BRANCH
  if (sourceLinksSupported && !defaultBranch)
    throw new TypeError(`Repository provider "${provider.id}" requires a resolved default branch for Demo source links`)
  if (sourceLinksSupported && !repository.url)
    throw new TypeError(`Repository provider "${provider.id}" requires a repository URL for Demo source links`)
  const resolveSourceHref = sourceLinksSupported
    ? createElementPlusDocsDemoSourceHrefResolver(md, {
        defaultBranch: defaultBranch!,
        project,
        projectRoot,
        provider,
        repositoryUrl: repository.url!,
      })
    : undefined

  elementPlusDocsDemoPlugin(md, {
    resolveExternalProjectSource,
    resolveSourceHref,
  })
}
