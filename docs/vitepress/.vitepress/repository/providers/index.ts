import type {
  RepositoryMetadataExpectation,
  RepositoryMetadataPayload,
} from '../types.ts'
import type { GiteeMetadataExpectation, GiteeMetadataSnapshot } from './gitee.ts'
import type { GithubMetadataExpectation, GithubMetadataSnapshot } from './github.ts'
import type { GitlabMetadataExpectation, GitlabMetadataSnapshot } from './gitlab.ts'
import type { LocalMetadataExpectation, LocalMetadataSnapshot } from './local.ts'
import type { YunxiaoMetadataExpectation, YunxiaoMetadataSnapshot } from './yunxiao.ts'
import {
  createGiteeRepositoryMetadataActions,
  createGithubRepositoryMetadataActions,
  createGitlabRepositoryMetadataActions,
  createYunxiaoRepositoryMetadataActions,
} from '@moluoxixi/vitepress-theme-element-plus'
import {
  createRepositoryMetadataProviderRegistry,
  defineRepositoryMetadataProvider,
} from '../types.ts'
import { assertGiteeMetadataSnapshot } from './gitee.ts'
import { assertGithubMetadataSnapshot } from './github.ts'
import { assertGitlabMetadataSnapshot } from './gitlab.ts'
import { assertLocalMetadataSnapshot } from './local.ts'
import { assertYunxiaoMetadataSnapshot } from './yunxiao.ts'

function requireExpectationValue(
  providerId: string,
  field: 'organizationId' | 'owner' | 'projectPath' | 'repository' | 'repositoryId' | 'repositoryPath' | 'repositoryUrl',
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

function giteeExpectation(expected: RepositoryMetadataExpectation): GiteeMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    owner: requireExpectationValue('gitee', 'owner', expected.owner),
    repository: requireExpectationValue('gitee', 'repository', expected.repository),
    repositoryUrl: requireExpectationValue('gitee', 'repositoryUrl', expected.repositoryUrl),
  }
}

function localExpectation(expected: RepositoryMetadataExpectation): LocalMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    repositoryUrl: requireExpectationValue('local', 'repositoryUrl', expected.repositoryUrl),
  }
}

function gitlabExpectation(expected: RepositoryMetadataExpectation): GitlabMetadataExpectation {
  return {
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    projectPath: requireExpectationValue('gitlab', 'projectPath', expected.projectPath),
    repositoryUrl: requireExpectationValue('gitlab', 'repositoryUrl', expected.repositoryUrl),
  }
}

function yunxiaoExpectation(expected: RepositoryMetadataExpectation): YunxiaoMetadataExpectation {
  if (expected.apiMode !== 'central' && expected.apiMode !== 'region')
    throw new TypeError('Repository metadata provider "yunxiao" requires configuration field "apiMode"')
  return {
    apiMode: expected.apiMode,
    components: expected.components,
    defaultBranch: expected.defaultBranch,
    organizationId: requireExpectationValue('yunxiao', 'organizationId', expected.organizationId),
    repositoryId: requireExpectationValue('yunxiao', 'repositoryId', expected.repositoryId),
    repositoryPath: requireExpectationValue('yunxiao', 'repositoryPath', expected.repositoryPath),
    repositoryUrl: requireExpectationValue('yunxiao', 'repositoryUrl', expected.repositoryUrl),
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

function normalizeGiteeMetadata(snapshot: GiteeMetadataSnapshot): RepositoryMetadataPayload {
  return {
    components: Object.fromEntries(Object.entries(snapshot.components).map(([name, component]) => [name, {
      commits: component.commits,
      contributors: component.contributors,
      ...(component.openIssueCount === undefined ? {} : { openIssueCount: component.openIssueCount }),
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

function normalizeGitlabMetadata(snapshot: GitlabMetadataSnapshot): RepositoryMetadataPayload {
  return {
    components: Object.fromEntries(Object.entries(snapshot.components).map(([name, component]) => [name, {
      commits: component.commits,
      contributors: component.contributors,
      ...(component.openIssueCount === undefined ? {} : { openIssueCount: component.openIssueCount }),
      path: component.path,
    }])),
    repository: {
      defaultBranch: snapshot.repository.defaultBranch,
      headSha: snapshot.repository.headSha,
    },
  }
}

function normalizeYunxiaoMetadata(snapshot: YunxiaoMetadataSnapshot): RepositoryMetadataPayload {
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
  actions: createGithubRepositoryMetadataActions(),
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
  snapshotFile: 'github.json',
})

export const giteeMetadataProvider = defineRepositoryMetadataProvider({
  actions: createGiteeRepositoryMetadataActions(),
  capabilities: {
    commitHistory: true,
    contributorProfiles: true,
    contributors: true,
    editLinks: true,
    issueActions: true,
    issues: true,
    sourceLinks: true,
  },
  id: 'gitee',
  platform: 'gitee',
  resolveSnapshot(snapshot, expectation) {
    assertGiteeMetadataSnapshot(snapshot, giteeExpectation(expectation))
    return {
      capabilities: {
        issueActions: snapshot.repository.issuesEnabled,
        issues: snapshot.repository.issuesEnabled,
      },
      payload: normalizeGiteeMetadata(snapshot),
    }
  },
  snapshotFile: 'gitee.json',
})

export const gitlabMetadataProvider = defineRepositoryMetadataProvider({
  actions: createGitlabRepositoryMetadataActions(),
  capabilities: {
    commitHistory: true,
    contributorProfiles: true,
    contributors: true,
    editLinks: true,
    issueActions: true,
    issues: true,
    sourceLinks: true,
  },
  id: 'gitlab',
  platform: 'gitlab',
  resolveSnapshot(snapshot, expectation) {
    assertGitlabMetadataSnapshot(snapshot, gitlabExpectation(expectation))
    return {
      capabilities: {
        issueActions: snapshot.repository.issuesEnabled,
        issues: snapshot.repository.issuesEnabled,
      },
      payload: normalizeGitlabMetadata(snapshot),
    }
  },
  snapshotFile: 'gitlab.json',
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
  snapshotFile: 'local.json',
})

export const yunxiaoMetadataProvider = defineRepositoryMetadataProvider({
  actions: createYunxiaoRepositoryMetadataActions(),
  capabilities: {
    commitHistory: true,
    contributorProfiles: true,
    contributors: true,
    editLinks: false,
    issueActions: false,
    issues: false,
    sourceLinks: true,
  },
  id: 'yunxiao',
  platform: 'yunxiao',
  resolveSnapshot(snapshot, expectation) {
    assertYunxiaoMetadataSnapshot(snapshot, yunxiaoExpectation(expectation))
    return normalizeYunxiaoMetadata(snapshot)
  },
  snapshotFile: 'yunxiao.json',
})

export const repositoryMetadataProviders = createRepositoryMetadataProviderRegistry([
  githubMetadataProvider,
  localMetadataProvider,
  gitlabMetadataProvider,
  giteeMetadataProvider,
  yunxiaoMetadataProvider,
])

export function resolveRepositoryMetadata(
  providerId: string,
  snapshot: unknown,
  expectation: RepositoryMetadataExpectation,
) {
  return repositoryMetadataProviders.resolve(providerId, snapshot, expectation)
}
