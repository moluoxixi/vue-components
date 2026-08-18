import type { GithubMetadataExpectation, GithubMetadataSnapshot } from './github-metadata-types.ts'
import type { LocalMetadataExpectation, LocalMetadataSnapshot } from './local-metadata-types.ts'
import type {
  RepositoryMetadataExpectation,
  RepositoryMetadataPayload,
} from './repository-metadata-types.ts'
import { assertGithubMetadataSnapshot } from './github-metadata-types.ts'
import { assertLocalMetadataSnapshot } from './local-metadata-types.ts'
import {
  createRepositoryMetadataProviderRegistry,
  defineRepositoryMetadataProvider,
} from './repository-metadata-types.ts'

function requireExpectationValue(
  providerId: string,
  field: 'owner' | 'repository' | 'repositoryUrl',
  value: string | undefined,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `Repository metadata provider "${providerId}" requires configuration field "${field}"`,
    )
  }
  return value
}

function githubExpectation(expected: RepositoryMetadataExpectation): GithubMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    owner: requireExpectationValue('github', 'owner', expected.owner),
    repository: requireExpectationValue('github', 'repository', expected.repository),
  }
}

function localExpectation(expected: RepositoryMetadataExpectation): LocalMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    repositoryUrl: requireExpectationValue('local', 'repositoryUrl', expected.repositoryUrl),
  }
}

function normalizeGithubMetadata(snapshot: GithubMetadataSnapshot): RepositoryMetadataPayload {
  return {
    components: Object.fromEntries(Object.entries(snapshot.components).map(([name, component]) => [name, {
      commits: component.commits,
      contributors: component.contributors.map((contributor) => {
        const profile = snapshot.profiles[contributor.login]
        return {
          ...profile,
          contributions: contributor.contributions,
          id: `github:${contributor.login}`,
        }
      }),
      openIssueCount: component.openIssueCount,
      path: component.path,
    }])),
    repository: {
      defaultBranch: snapshot.repository.defaultBranch,
      headSha: snapshot.repository.headSha,
    },
  }
}

function normalizeLocalMetadata(snapshot: LocalMetadataSnapshot): RepositoryMetadataPayload {
  return {
    components: Object.fromEntries(Object.entries(snapshot.components).map(([name, component]) => [name, {
      commits: component.commits,
      contributors: component.contributors,
      path: component.path,
    }])),
    repository: {
      defaultBranch: snapshot.repository.defaultBranch,
      headSha: snapshot.repository.headSha,
    },
  }
}

export const githubMetadataProvider = defineRepositoryMetadataProvider({
  actions: {
    componentSourceHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryUrl}/tree/${defaultBranch}/${path}`,
    editDocumentationHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryUrl}/edit/${defaultBranch}/${path}`,
    newIssueHref: ({ issueTitlePrefix, repositoryUrl }) => `${repositoryUrl}/issues/new?title=${encodeURIComponent(`${issueTitlePrefix} `)}`,
    openIssuesHref: ({ issueTitlePrefix, repositoryUrl }) => `${repositoryUrl}/issues?q=${encodeURIComponent(`is:issue is:open in:title "${issueTitlePrefix}"`)}`,
    sourceLineHref: ({ defaultBranch, endLine, path, repositoryUrl, startLine }) => `${repositoryUrl}/blob/${defaultBranch}/${path}?plain=1#L${startLine}-L${endLine}`,
  },
  capabilities: {
    commitHistory: true,
    contributorProfiles: true,
    contributors: true,
    editLinks: true,
    issueActions: true,
    issues: true,
    sourceLinks: true,
  },
  id: 'github',
  platform: 'github',
  resolveSnapshot(snapshot, expectation) {
    assertGithubMetadataSnapshot(snapshot, githubExpectation(expectation))
    return normalizeGithubMetadata(snapshot)
  },
  snapshotFile: 'github-metadata.json',
})

export const localMetadataProvider = defineRepositoryMetadataProvider({
  capabilities: {
    commitHistory: true,
    contributorProfiles: false,
    contributors: true,
    editLinks: false,
    issueActions: false,
    issues: false,
    sourceLinks: false,
  },
  id: 'local',
  platform: 'local',
  resolveSnapshot(snapshot, expectation) {
    assertLocalMetadataSnapshot(snapshot, localExpectation(expectation))
    return normalizeLocalMetadata(snapshot)
  },
  snapshotFile: 'local-metadata.json',
})

export const repositoryMetadataProviders = createRepositoryMetadataProviderRegistry([
  githubMetadataProvider,
  localMetadataProvider,
])

export function resolveRepositoryMetadata(
  providerId: string,
  snapshot: unknown,
  expectation: RepositoryMetadataExpectation,
) {
  return repositoryMetadataProviders.resolve(providerId, snapshot, expectation)
}
