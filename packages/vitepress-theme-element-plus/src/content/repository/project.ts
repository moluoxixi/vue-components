import type { ElementPlusDocsProject, ElementPlusDocsProjectInput } from '../../project'
import type { RepositoryComponentMetadata, RepositoryMetadataExpectation } from './types'
import {
  resolveElementPlusDocsProject,
  resolveElementPlusDocsProjectRepository,
} from '../../project'
import { repositoryMetadataProviders } from './providers'

export const elementPlusDocsRepositorySnapshotId = 'virtual:moluoxixi-repository-metadata-snapshot'

const repositoryProviderLabels: Readonly<Record<string, string>> = {
  gitee: 'Gitee',
  github: 'GitHub',
  gitlab: 'GitLab',
  local: 'Local',
  yunxiao: 'Yunxiao',
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(message)
  return value as Record<string, unknown>
}

function expectation(
  project: ElementPlusDocsProject,
  providerOverride: string | undefined,
  snapshot: unknown,
): { expectation: RepositoryMetadataExpectation, repositoryUrl: string } {
  const repository = resolveElementPlusDocsProjectRepository(project, providerOverride)
  const repositorySnapshot = record(
    record(snapshot, `${repository.provider} snapshot must be an object`).repository,
    `${repository.provider} snapshot repository must be an object`,
  )
  const defaultBranch = repositorySnapshot.defaultBranch ?? repositorySnapshot.default_branch
  if (typeof defaultBranch !== 'string' || !defaultBranch.trim())
    throw new TypeError(`${repository.provider} snapshot has no default branch`)
  if (repository.defaultBranch && repository.defaultBranch !== defaultBranch)
    throw new TypeError(`${repository.provider} snapshot default branch does not match the configured branch`)
  const snapshotRepositoryUrl = repositorySnapshot.url ?? repositorySnapshot.webUrl
  const repositoryUrl = repository.url
    ?? (typeof snapshotRepositoryUrl === 'string' ? snapshotRepositoryUrl : undefined)
  if (!repositoryUrl)
    throw new TypeError(`${repository.provider} repository URL could not be resolved`)

  const base: RepositoryMetadataExpectation = {
    components: project.components.flatMap(group => group.items).map(component => ({
      name: component.name,
      path: component.repositorySourcePath,
    })),
    defaultBranch,
    repositoryUrl,
  }
  switch (repository.provider) {
    case 'github':
    case 'gitee':
      return {
        expectation: { ...base, owner: repository.owner, repository: repository.repository },
        repositoryUrl,
      }
    case 'gitlab':
      return { expectation: { ...base, projectPath: repository.projectPath }, repositoryUrl }
    case 'yunxiao':
      return {
        expectation: {
          ...base,
          apiMode: repository.apiMode,
          organizationId: repository.organizationId,
          repositoryId: repository.repositoryId,
          repositoryPath: repository.repositoryPath,
        },
        repositoryUrl,
      }
    case 'local':
      return { expectation: base, repositoryUrl }
  }
}

export function resolveElementPlusDocsRepositorySnapshotFile(
  projectInput: ElementPlusDocsProjectInput,
  providerOverride?: string,
): string {
  const project = resolveElementPlusDocsProject(projectInput)
  const repository = resolveElementPlusDocsProjectRepository(project, providerOverride)
  return repositoryMetadataProviders.get(repository.provider).snapshotFile
}

export function createElementPlusDocsRepositoryRuntime(options: {
  project: ElementPlusDocsProjectInput
  providerOverride?: string
  snapshot: unknown
}) {
  const project = resolveElementPlusDocsProject(options.project)
  const repository = resolveElementPlusDocsProjectRepository(project, options.providerOverride)
  const configured = expectation(project, options.providerOverride, options.snapshot)
  const metadata = repositoryMetadataProviders.resolve(
    repository.provider,
    options.snapshot,
    configured.expectation,
  )
  const provider = repositoryMetadataProviders.get(repository.provider)
  const contentProvider = Object.freeze({
    actions: provider.actions,
    capabilities: metadata.provider.capabilities,
  })

  return Object.freeze({
    contentProvider,
    metadata,
    provider,
    providerId: provider.id,
    repository: Object.freeze({
      defaultBranch: metadata.repository.defaultBranch,
      issueTitlePrefix: repository.issueTitlePrefix,
      url: configured.repositoryUrl,
    }),
    repositoryLabel: repositoryProviderLabels[provider.id] ?? provider.platform,
    createActionInput(componentName: string) {
      return {
        defaultBranch: metadata.repository.defaultBranch,
        issueTitlePrefix: repository.issueTitlePrefix(componentName),
        repositoryUrl: configured.repositoryUrl,
      }
    },
    getComponentMetadata(componentName: string): RepositoryComponentMetadata {
      const component = metadata.components[componentName]
      if (!component)
        throw new Error(`Missing validated ${provider.id} metadata for ${componentName}`)
      return component
    },
  })
}
