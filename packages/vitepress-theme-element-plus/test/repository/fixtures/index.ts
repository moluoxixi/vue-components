import type {
  GiteeMetadataSnapshot,
  GithubMetadataSnapshot,
  GitlabMetadataSnapshot,
  LocalMetadataSnapshot,
  RepositoryMetadataExpectation,
  YunxiaoMetadataSnapshot,
} from '../../../repository'

const generatedAt = '2026-08-24T00:00:00.000Z'
const headSha = 'a'.repeat(40)
const commitSha = 'b'.repeat(40)
const commitDate = '2026-08-23T00:00:00.000Z'
const components = [
  { name: 'CopyText', path: 'packages/fixture/CopyText' },
  { name: 'FixtureComponent', path: 'packages/fixture/FixtureComponent' },
]

export const fixtureExpectations = {
  github: {
    components,
    defaultBranch: 'main',
    owner: 'fixture-owner',
    repository: 'fixture-repository',
    repositoryUrl: 'https://github.com/fixture-owner/fixture-repository',
  },
  gitlab: {
    components,
    defaultBranch: 'main',
    projectPath: 'group/fixture-repository',
    repositoryUrl: 'https://gitlab.test/group/fixture-repository',
  },
  gitee: {
    components,
    defaultBranch: 'main',
    owner: 'fixture-owner',
    repository: 'fixture-repository',
    repositoryUrl: 'https://gitee.test/fixture-owner/fixture-repository',
  },
  local: {
    components,
    defaultBranch: 'main',
    repositoryUrl: 'https://example.test/fixture-repository',
  },
  yunxiao: {
    apiMode: 'central',
    components,
    defaultBranch: 'main',
    organizationId: 'fixture-organization',
    repositoryId: 'fixture-repository-id',
    repositoryPath: 'fixture-organization/fixture-repository',
    repositoryUrl: 'https://codeup.test/fixture-organization/fixture-repository',
  },
} as const satisfies Readonly<Record<string, RepositoryMetadataExpectation>>

function componentsFrom<T>(
  components: Array<{ name: string, path: string }>,
  create: (name: string, path: string) => T,
): Record<string, T> {
  return Object.fromEntries(components.map(component => [
    component.name,
    create(component.name, component.path),
  ]))
}

export function createGithubMetadataFixture(): GithubMetadataSnapshot {
  const login = 'fixture-user'
  const profile = {
    avatarUrl: 'https://avatars.githubusercontent.com/u/1',
    login,
    name: 'Fixture User',
    profileUrl: `https://github.com/${login}`,
  }
  const repository = fixtureExpectations.github
  const repositoryUrl = repository.repositoryUrl
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      defaultBranch: repository.defaultBranch,
      headSha,
      name: repository.repository,
      openIssueCount: 1,
      owner: repository.owner,
    },
    profiles: { [login]: profile },
    components: componentsFrom(repository.components, (name, path) => ({
      commits: [{
        author: { ...profile },
        date: commitDate,
        message: `docs: update ${name}`,
        sha: commitSha,
        shortSha: commitSha.slice(0, 7),
        url: `${repositoryUrl}/commit/${commitSha}`,
      }],
      contributors: [{ contributions: 1, login }],
      openIssueCount: 1,
      openIssues: [{
        number: 1,
        title: `[${name}] fixture issue`,
        url: `${repositoryUrl}/issues/1`,
      }],
      path,
    })),
  }
}

export function createGitlabMetadataFixture(): GitlabMetadataSnapshot {
  const login = 'fixture-user'
  const profile = {
    avatarUrl: 'https://gitlab.test/uploads/-/system/user/avatar/1/avatar.png',
    login,
    name: 'Fixture User',
    profileUrl: `https://gitlab.test/${login}`,
  }
  const repository = fixtureExpectations.gitlab
  const repositoryUrl = repository.repositoryUrl
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      defaultBranch: repository.defaultBranch,
      headSha,
      issuesEnabled: true,
      projectPath: repository.projectPath,
      webUrl: repositoryUrl,
    },
    components: componentsFrom(repository.components, (name, path) => ({
      commits: [{
        author: { ...profile },
        date: commitDate,
        message: `docs: update ${name}`,
        sha: commitSha,
        shortSha: commitSha.slice(0, 7),
        url: `${repositoryUrl}/-/commit/${commitSha}`,
      }],
      contributors: [{
        ...profile,
        contributions: 1,
        id: `gitlab:${'c'.repeat(64)}`,
      }],
      openIssueCount: 1,
      openIssues: [{
        iid: 1,
        title: `[${name}] fixture issue`,
        url: `${repositoryUrl}/-/work_items/1`,
      }],
      path,
    })),
  }
}

export function createGiteeMetadataFixture(): GiteeMetadataSnapshot {
  const login = 'fixture-user'
  const profile = {
    avatarUrl: 'https://gitee.test/assets/no_portrait.png',
    login,
    name: 'Fixture User',
    profileUrl: `https://gitee.test/${login}`,
  }
  const repository = fixtureExpectations.gitee
  const repositoryUrl = repository.repositoryUrl
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      defaultBranch: repository.defaultBranch,
      fullName: `${repository.owner}/${repository.repository}`,
      headSha,
      issuesEnabled: true,
      webUrl: repositoryUrl,
    },
    components: componentsFrom(repository.components, (name, path) => ({
      commits: [{
        author: { ...profile },
        date: commitDate,
        message: `docs: update ${name}`,
        sha: commitSha,
        shortSha: commitSha.slice(0, 7),
        url: `${repositoryUrl}/commit/${commitSha}`,
      }],
      contributors: [{
        ...profile,
        contributions: 1,
        id: 'gitee:1001',
      }],
      openIssueCount: 1,
      openIssues: [{
        number: 'I1',
        title: `[${name}] fixture issue`,
        url: `${repositoryUrl}/issues/I1`,
      }],
      path,
    })),
  }
}

export function createYunxiaoMetadataFixture(): YunxiaoMetadataSnapshot {
  const login = 'aliyun:fixture-user'
  const profile = {
    avatarUrl: 'https://tcs-devops.aliyuncs.com/thumbnail/fixture-avatar.png',
    login,
    name: 'Fixture User',
  }
  const repository = fixtureExpectations.yunxiao
  const repositoryUrl = repository.repositoryUrl
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      apiMode: repository.apiMode,
      defaultBranch: repository.defaultBranch,
      headSha,
      organizationId: repository.organizationId,
      repositoryId: repository.repositoryId,
      repositoryPath: repository.repositoryPath,
      webUrl: repositoryUrl,
    },
    components: componentsFrom(repository.components, (name, path) => ({
      commits: [{
        author: { ...profile },
        date: commitDate,
        message: `docs: update ${name}`,
        sha: commitSha,
        shortSha: commitSha.slice(0, 7),
        url: `${repositoryUrl}/commit/${commitSha}`,
      }],
      contributors: [{
        ...profile,
        contributions: 1,
        id: 'yunxiao:ba1c128b9e33fede5b41988a22197e615bd4f6e4ce76efc02d72595aa0c8338e',
      }],
      path,
    })),
  }
}

export function createLocalMetadataFixture(): LocalMetadataSnapshot {
  const repository = fixtureExpectations.local
  const repositoryUrl = repository.repositoryUrl
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      defaultBranch: repository.defaultBranch,
      headSha,
      url: repositoryUrl,
    },
    components: componentsFrom(repository.components, (name, path) => ({
      commits: [{
        author: { name: 'Fixture User' },
        date: commitDate,
        message: `docs: update ${name}`,
        sha: commitSha,
        shortSha: commitSha.slice(0, 7),
        url: `${repositoryUrl}/commit/${commitSha}`,
      }],
      contributors: [{
        contributions: 1,
        id: 'git:fixture-user',
        name: 'Fixture User',
      }],
      path,
    })),
  }
}
