import type { RepositoryMetadataSource } from './docs-site'
import type { GitLocalMetadataExpectation, GitLocalMetadataSnapshot } from './git-local-metadata-types'
import type { GithubMetadataExpectation, GithubMetadataSnapshot } from './github-metadata-types'
import { assertGitLocalMetadataSnapshot } from './git-local-metadata-types.ts'
import { assertGithubMetadataSnapshot } from './github-metadata-types.ts'

export interface RepositoryCommit {
  author: {
    avatarUrl?: string
    login?: string
    name: string
    profileUrl?: string
  }
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface RepositoryContributor {
  avatarUrl?: string
  contributions: number
  id: string
  login?: string
  name: string
  profileUrl?: string
}

export interface RepositoryComponentMetadata {
  commits: RepositoryCommit[]
  contributors: RepositoryContributor[]
  openIssueCount?: number
  path: string
}

export interface RepositoryMetadata {
  components: Record<string, RepositoryComponentMetadata>
  repository: {
    defaultBranch: string
    headSha: string
  }
  source: RepositoryMetadataSource
}

export interface RepositoryMetadataExpectation {
  components: Array<{
    name: string
    path: string
  }>
  defaultBranch: string
  owner: string
  repository: string
  repositoryUrl: string
}

export interface ResolveRepositoryMetadataOptions {
  expectation: RepositoryMetadataExpectation
  githubSnapshot?: unknown
  gitLocalSnapshot?: unknown
  source: RepositoryMetadataSource
}

function githubExpectation(expected: RepositoryMetadataExpectation): GithubMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    owner: expected.owner,
    repository: expected.repository,
  }
}

function localExpectation(expected: RepositoryMetadataExpectation): GitLocalMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    repositoryUrl: expected.repositoryUrl,
  }
}

function normalizeGithubMetadata(
  snapshot: GithubMetadataSnapshot,
): RepositoryMetadata {
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
    source: 'github',
  }
}

function normalizeGitLocalMetadata(
  snapshot: GitLocalMetadataSnapshot,
): RepositoryMetadata {
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
    source: 'git-local',
  }
}

export function resolveRepositoryMetadata(options: ResolveRepositoryMetadataOptions): RepositoryMetadata {
  if (options.source === 'github') {
    assertGithubMetadataSnapshot(options.githubSnapshot, githubExpectation(options.expectation))
    return normalizeGithubMetadata(options.githubSnapshot)
  }

  if (options.source !== 'git-local')
    throw new TypeError(`Unsupported repository metadata source: ${String(options.source)}`)

  assertGitLocalMetadataSnapshot(options.gitLocalSnapshot, localExpectation(options.expectation))
  return normalizeGitLocalMetadata(options.gitLocalSnapshot)
}
