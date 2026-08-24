import type {
  RepositoryComponentMetadata,
  RepositoryContributor,
  RepositoryMetadataProvider,
} from './types'
import { repositoryMetadataProviderSupports } from './registry'

type RepositoryContentProvider = Pick<RepositoryMetadataProvider, 'actions' | 'capabilities'>

export interface RepositoryComponentMetaInput {
  defaultBranch: string
  editPath: string
  issueTitlePrefix: string
  repositoryUrl: string
  sourcePath: string
}

export function resolveRepositoryComponentMeta(
  provider: RepositoryContentProvider,
  metadata: RepositoryComponentMetadata,
  input: RepositoryComponentMetaInput,
) {
  const { actions } = provider
  const sourceHref = repositoryMetadataProviderSupports(provider, 'sourceLinks')
    ? actions?.componentSourceHref?.({
        defaultBranch: input.defaultBranch,
        path: input.sourcePath,
        repositoryUrl: input.repositoryUrl,
      })
    : undefined
  const editHref = repositoryMetadataProviderSupports(provider, 'editLinks')
    ? actions?.editDocumentationHref?.({
        defaultBranch: input.defaultBranch,
        path: input.editPath,
        repositoryUrl: input.repositoryUrl,
      })
    : undefined
  const newIssueHref = repositoryMetadataProviderSupports(provider, 'issueActions')
    ? actions?.newIssueHref?.({
        issueTitlePrefix: input.issueTitlePrefix,
        repositoryUrl: input.repositoryUrl,
      })
    : undefined
  const openIssuesHref = repositoryMetadataProviderSupports(provider, 'issueActions')
    ? actions?.openIssuesHref?.({
        issueTitlePrefix: input.issueTitlePrefix,
        repositoryUrl: input.repositoryUrl,
      })
    : undefined

  return {
    commits: repositoryMetadataProviderSupports(provider, 'commitHistory')
      ? metadata.commits
      : undefined,
    editHref,
    newIssueHref,
    ...(metadata.openIssueCount === undefined || !repositoryMetadataProviderSupports(provider, 'issues')
      ? {}
      : {
          openIssueCount: metadata.openIssueCount,
          openIssuesHref,
        }),
    sourceHref,
  }
}

export function resolveRepositoryContributors(
  provider: RepositoryContentProvider,
  metadata: RepositoryComponentMetadata,
): readonly RepositoryContributor[] | undefined {
  return repositoryMetadataProviderSupports(provider, 'contributors')
    ? metadata.contributors
    : undefined
}
