// @vitest-environment node

import type { RepositoryMetadataProvider } from '../../repository'
import { describe, expect, it } from 'vitest'
import {
  defineComponentPackage,
  defineElementPlusDocsProject,
  resolveElementPlusDocsRepositoryProvider,
} from '../../index'
import {
  assertGiteeMetadataSnapshot,
  assertGitlabMetadataSnapshot,
  assertLocalMetadataSnapshot,
  assertYunxiaoMetadataSnapshot,
  createElementPlusDocsRepositoryRuntime,
  createRepositoryMetadataProviderRegistry,
  defineRepositoryMetadataProvider,
  repositoryMetadataProviders,
  repositoryMetadataProviderSupports,
} from '../../repository'
import {
  createGiteeMetadataFixture,
  createGithubMetadataFixture,
  createGitlabMetadataFixture,
  createLocalMetadataFixture,
  createYunxiaoMetadataFixture,
  fixtureExpectations as repositoryMetadataExpectations,
} from './fixtures'

const giteeSnapshot = createGiteeMetadataFixture()
const githubSnapshot = createGithubMetadataFixture()
const gitlabSnapshot = createGitlabMetadataFixture()
const localSnapshot = createLocalMetadataFixture()
const yunxiaoSnapshot = createYunxiaoMetadataFixture()

describe('repository metadata providers', () => {
  it('selects configured providers strictly and creates a provider-scoped runtime', () => {
    expect(resolveElementPlusDocsRepositoryProvider(undefined, 'github')).toBe('github')
    expect(resolveElementPlusDocsRepositoryProvider('gitlab', 'github')).toBe('gitlab')
    expect(() => resolveElementPlusDocsRepositoryProvider('auto', 'github')).toThrow(
      'Unsupported repository metadata provider: auto',
    )

    const project = defineElementPlusDocsProject({
      documentation: {
        componentsRoute: 'components',
        defaultLocale: 'en-US',
        locales: {
          'en-US': {
            label: 'English',
            sourceDirectory: '',
            sourceDoc: 'docs/index.md',
          },
        },
      },
      repository: {
        provider: 'gitlab',
        url: repositoryMetadataExpectations.gitlab.repositoryUrl,
        defaultBranch: 'main',
        projectPath: repositoryMetadataExpectations.gitlab.projectPath,
        webBaseUrl: 'https://gitlab.test',
      },
      packages: {
        components: defineComponentPackage({
          name: '@fixture/components',
          root: 'packages/fixture',
          componentSource: name => `packages/fixture/${name}`,
          load: async () => ({}),
        }),
      },
      components: [{
        id: 'fixture',
        title: 'Fixture',
        description: 'Fixture components',
        items: repositoryMetadataExpectations.gitlab.components.map(component => ({
          name: component.name,
          sidebarText: component.name,
          description: component.name,
          icon: 'fixture',
        })),
      }],
    })
    const selection = createElementPlusDocsRepositoryRuntime({ project, snapshot: gitlabSnapshot })
    const actionInput = selection.createActionInput('CopyText')
    const documentationPath = 'packages/components/src/CopyText/docs/index.md'
    const componentPath = 'packages/components/src/CopyText'
    const sourceHref = selection.provider.actions?.sourceLineHref?.({
      ...actionInput,
      endLine: 8,
      path: documentationPath,
      startLine: 3,
    })

    expect(selection.providerId).toBe('gitlab')
    expect(selection.repositoryLabel).toBe('GitLab')
    expect(selection.provider.snapshotFile).toBe('gitlab.json')
    expect(actionInput).toEqual({
      defaultBranch: 'main',
      issueTitlePrefix: '[CopyText]',
      repositoryUrl: 'https://gitlab.test/group/fixture-repository',
    })
    expect(sourceHref).toBe(
      'https://gitlab.test/group/fixture-repository/-/blob/main/packages/components/src/CopyText/docs/index.md#L3-8',
    )
    expect(selection.provider.actions?.componentSourceHref?.({
      ...actionInput,
      path: componentPath,
    })).toBe(
      'https://gitlab.test/group/fixture-repository/-/tree/main/packages/components/src/CopyText',
    )
    expect(selection.provider.actions?.editDocumentationHref?.({
      ...actionInput,
      path: documentationPath,
    })).toBe(
      'https://gitlab.test/group/fixture-repository/-/edit/main/packages/components/src/CopyText/docs/index.md',
    )
    expect(selection.provider.actions?.newIssueHref?.(actionInput)).toBe(
      'https://gitlab.test/group/fixture-repository/-/issues/new?issue%5Btitle%5D=%5BCopyText%5D+',
    )
    expect(selection.provider.actions?.openIssuesHref?.(actionInput)).toBe(
      'https://gitlab.test/group/fixture-repository/-/issues?search=%5BCopyText%5D&state=opened',
    )
    expect(sourceHref).not.toContain('github.com')
  })

  it('normalizes GitHub capabilities and provider-owned links', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'github',
      githubSnapshot,
      repositoryMetadataExpectations.github,
    )
    const provider = repositoryMetadataProviders.get('github')

    expect(metadata.components.CopyText?.openIssueCount).toBeTypeOf('number')
    expect(metadata.components.CopyText?.contributors[0]?.id).toMatch(/^github:/)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(true)
    expect(provider.actions?.newIssueHref?.({
      issueTitlePrefix: '[CopyText]',
      repositoryUrl: repositoryMetadataExpectations.github.repositoryUrl,
    })).toContain('/issues/new?title=')
  })

  it('normalizes local Git with history and contributors only', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'local',
      localSnapshot,
      repositoryMetadataExpectations.local,
    )

    expect(metadata.provider.platform).toBe('local')
    expect(metadata.components.CopyText?.openIssueCount).toBeUndefined()
    expect(metadata.components.CopyText?.contributors[0]?.id).toMatch(/^git:/)
    expect(metadata.components.CopyText?.contributors[0]).not.toHaveProperty('profileUrl')
    expect(repositoryMetadataProviderSupports(metadata.provider, 'commitHistory')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributors')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(repositoryMetadataProviders.get('local').actions).toBeUndefined()
  })

  it('registers GitLab with an isolated snapshot and capability contract', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'gitlab',
      gitlabSnapshot,
      repositoryMetadataExpectations.gitlab,
    )

    expect(repositoryMetadataProviders.ids).toEqual(['github', 'local', 'gitlab', 'gitee', 'yunxiao'])
    expect(repositoryMetadataProviders.get('gitlab').snapshotFile).toBe('gitlab.json')
    expect(metadata.provider.platform).toBe('gitlab')
    expect(metadata.components.CopyText?.contributors.every(contributor => contributor.id.startsWith('gitlab:'))).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'sourceLinks')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributorProfiles')).toBe(true)
    expect(metadata.components.CopyText?.contributors[0]).toMatchObject({
      avatarUrl: 'https://gitlab.test/uploads/-/system/user/avatar/1/avatar.png',
      login: 'fixture-user',
      name: 'Fixture User',
      profileUrl: 'https://gitlab.test/fixture-user',
    })
  })

  it('registers Gitee with an isolated snapshot and project-owned links', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'gitee',
      giteeSnapshot,
      repositoryMetadataExpectations.gitee,
    )
    const provider = repositoryMetadataProviders.get('gitee')

    expect(repositoryMetadataProviders.get('gitee').snapshotFile).toBe('gitee.json')
    expect(metadata.provider.platform).toBe('gitee')
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(true)
    expect(metadata.components.CopyText?.commits.length).toBeGreaterThan(0)
    expect(metadata.components.CopyText?.contributors[0]).toEqual({
      avatarUrl: 'https://gitee.test/assets/no_portrait.png',
      contributions: 1,
      id: 'gitee:1001',
      login: 'fixture-user',
      name: 'Fixture User',
      profileUrl: 'https://gitee.test/fixture-user',
    })
    expect(metadata.components.CopyText?.commits[0]?.author).toEqual({
      avatarUrl: 'https://gitee.test/assets/no_portrait.png',
      login: 'fixture-user',
      name: 'Fixture User',
      profileUrl: 'https://gitee.test/fixture-user',
    })
    expect(metadata.components.CopyText?.openIssueCount).toBe(1)
    expect(Object.values(metadata.components).every(component => (
      component.commits.length > 0 && component.contributors.length > 0
    ))).toBe(true)
    expect(provider.actions?.sourceLineHref?.({
      defaultBranch: 'main',
      endLine: 8,
      path: 'README.md',
      repositoryUrl: repositoryMetadataExpectations.gitee.repositoryUrl,
      startLine: 3,
    })).toBe(`${repositoryMetadataExpectations.gitee.repositoryUrl}/blame/main/README.md#L3`)
  })

  it('registers Yunxiao with verified contributor profiles and source links', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'yunxiao',
      yunxiaoSnapshot,
      repositoryMetadataExpectations.yunxiao,
    )
    const provider = repositoryMetadataProviders.get('yunxiao')

    expect(repositoryMetadataProviders.get('yunxiao').snapshotFile).toBe('yunxiao.json')
    expect(metadata.provider.platform).toBe('yunxiao')
    expect(repositoryMetadataProviderSupports(metadata.provider, 'commitHistory')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributorProfiles')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributors')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'sourceLinks')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'editLinks')).toBe(false)
    expect(metadata.components.CopyText?.contributors[0]).toMatchObject({
      avatarUrl: expect.stringContaining('tcs-devops.aliyuncs.com/thumbnail/'),
      login: 'aliyun:fixture-user',
    })
    expect(provider.actions?.componentSourceHref?.({
      defaultBranch: 'master',
      path: 'packages/components/src/CopyText',
      repositoryUrl: repositoryMetadataExpectations.yunxiao.repositoryUrl,
    })).toBe(`${repositoryMetadataExpectations.yunxiao.repositoryUrl}/tree/master/packages/components/src/CopyText`)
    expect(provider.actions?.sourceLineHref?.({
      defaultBranch: 'master',
      endLine: 21,
      path: 'packages/components/src/CopyText/docs/index.md',
      repositoryUrl: repositoryMetadataExpectations.yunxiao.repositoryUrl,
      startLine: 9,
    })).toBe(`${repositoryMetadataExpectations.yunxiao.repositoryUrl}/blob/master/packages/components/src/CopyText/docs/index.md?README.md#L9`)
  })

  it('does not fall back to another provider snapshot', () => {
    expect(() => repositoryMetadataProviders.resolve(
      'github',
      localSnapshot,
      repositoryMetadataExpectations.github,
    )).toThrow('Invalid GitHub metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'local',
      githubSnapshot,
      repositoryMetadataExpectations.local,
    )).toThrow('Invalid local Git metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'gitlab',
      githubSnapshot,
      repositoryMetadataExpectations.gitlab,
    )).toThrow('Invalid GitLab metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'github',
      gitlabSnapshot,
      repositoryMetadataExpectations.github,
    )).toThrow('Invalid GitHub metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'gitee',
      gitlabSnapshot,
      repositoryMetadataExpectations.gitee,
    )).toThrow('Invalid Gitee metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'yunxiao',
      giteeSnapshot,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('Invalid Yunxiao metadata snapshot')
  })

  it('validates provider-required configuration before parsing snapshots', () => {
    expect(() => repositoryMetadataProviders.resolve('github', null, {
      ...repositoryMetadataExpectations.github,
      owner: undefined,
    })).toThrow('Repository metadata provider "github" requires configuration field "owner"')
    expect(() => repositoryMetadataProviders.resolve('github', null, {
      ...repositoryMetadataExpectations.github,
      repository: undefined,
    })).toThrow('Repository metadata provider "github" requires configuration field "repository"')
    expect(() => repositoryMetadataProviders.resolve('local', null, {
      ...repositoryMetadataExpectations.local,
      repositoryUrl: undefined,
    })).toThrow('Repository metadata provider "local" requires configuration field "repositoryUrl"')
    expect(() => repositoryMetadataProviders.resolve('gitlab', null, {
      ...repositoryMetadataExpectations.gitlab,
      projectPath: undefined,
    })).toThrow('Repository metadata provider "gitlab" requires configuration field "projectPath"')
    expect(() => repositoryMetadataProviders.resolve('gitlab', null, {
      ...repositoryMetadataExpectations.gitlab,
      repositoryUrl: undefined,
    })).toThrow('Repository metadata provider "gitlab" requires configuration field "repositoryUrl"')
    expect(() => repositoryMetadataProviders.resolve('gitee', null, {
      ...repositoryMetadataExpectations.gitee,
      owner: undefined,
    })).toThrow('Repository metadata provider "gitee" requires configuration field "owner"')
    expect(() => repositoryMetadataProviders.resolve('yunxiao', null, {
      ...repositoryMetadataExpectations.yunxiao,
      organizationId: undefined,
    })).toThrow('Repository metadata provider "yunxiao" requires configuration field "organizationId"')
  })

  it('rejects Gitee metadata from another repository and leaked email fields', () => {
    const wrongRepository = structuredClone(giteeSnapshot)
    wrongRepository.repository.fullName = 'other/repository'
    expect(() => assertGiteeMetadataSnapshot(
      wrongRepository,
      repositoryMetadataExpectations.gitee,
    )).toThrow('repository fullName must be fixture-owner/fixture-repository')

    const leakedContributor = structuredClone(giteeSnapshot)
    leakedContributor.components.CopyText!.contributors.push({
      contributions: 1,
      id: 'gitee:test',
      name: 'Test',
      email: 'private@example.test',
    } as never)
    expect(() => assertGiteeMetadataSnapshot(
      leakedContributor,
      repositoryMetadataExpectations.gitee,
    )).toThrow('CopyText contributor contains unsupported or missing fields')
  })

  it('rejects Yunxiao cross-tenant snapshots and leaked contributor fields', () => {
    const wrongOrganization = structuredClone(yunxiaoSnapshot)
    wrongOrganization.repository.organizationId = 'another-organization'
    expect(() => assertYunxiaoMetadataSnapshot(
      wrongOrganization,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow(`organizationId must be ${repositoryMetadataExpectations.yunxiao.organizationId}`)

    const leakedContributor = structuredClone(yunxiaoSnapshot)
    Object.assign(leakedContributor.components.CopyText!.contributors[0]!, {
      email: 'private@example.test',
    })
    expect(() => assertYunxiaoMetadataSnapshot(
      leakedContributor,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('CopyText contributor contains unsupported or missing fields')

    const malformedContributorId = structuredClone(yunxiaoSnapshot)
    malformedContributorId.components.CopyText!.contributors[0]!.id = 'yunxiao:not-a-stable-hash'
    expect(() => assertYunxiaoMetadataSnapshot(
      malformedContributorId,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('CopyText contributor id is invalid')

    const incompleteProfile = structuredClone(yunxiaoSnapshot)
    Reflect.deleteProperty(incompleteProfile.components.CopyText!.contributors[0]!, 'login')
    expect(() => assertYunxiaoMetadataSnapshot(
      incompleteProfile,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('CopyText contributor login is required')

    const credentialBearingAvatar = structuredClone(yunxiaoSnapshot)
    credentialBearingAvatar.components.CopyText!.commits[0]!.author.avatarUrl += '?token=secret'
    expect(() => assertYunxiaoMetadataSnapshot(
      credentialBearingAvatar,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('CopyText commit author avatar URL must belong to Yunxiao and cannot contain credentials, query, or fragment')
  })

  it('rejects provider profiles that change across components', () => {
    const cases = [
      {
        label: 'GitLab',
        snapshot: gitlabSnapshot,
        validate: (value: unknown) => assertGitlabMetadataSnapshot(value, repositoryMetadataExpectations.gitlab),
      },
      {
        label: 'Gitee',
        snapshot: giteeSnapshot,
        validate: (value: unknown) => assertGiteeMetadataSnapshot(value, repositoryMetadataExpectations.gitee),
      },
      {
        label: 'Yunxiao',
        snapshot: yunxiaoSnapshot,
        validate: (value: unknown) => assertYunxiaoMetadataSnapshot(value, repositoryMetadataExpectations.yunxiao),
      },
    ]

    for (const providerCase of cases) {
      const invalid = structuredClone(providerCase.snapshot) as Record<string, any>
      const sourceComponent = invalid.components.CopyText
      const sourceContributor = sourceComponent.contributors[0]
      const targetComponent = Object.values(invalid.components).find((component: any) => (
        component !== sourceComponent
        && component.contributors.some((contributor: any) => contributor.login === sourceContributor.login)
      )) as Record<string, any> | undefined
      expect(targetComponent, `${providerCase.label} fixture must repeat the CopyText contributor`).toBeDefined()

      const targetContributor = targetComponent!.contributors.find(
        (contributor: any) => contributor.login === sourceContributor.login,
      )
      targetContributor.name = `${targetContributor.name} changed`
      for (const commit of targetComponent!.commits) {
        if (commit.author.login === sourceContributor.login)
          commit.author.name = targetContributor.name
      }

      expect(() => providerCase.validate(invalid)).toThrow(
        `${providerCase.label} contributor profile must remain consistent across components`,
      )
    }
  })

  it('rejects a GitLab contributor ID rebound to another account across components', () => {
    const invalid = structuredClone(gitlabSnapshot)
    const sourceComponent = invalid.components.CopyText!
    const sourceContributor = sourceComponent.contributors[0]!
    const targetComponent = Object.values(invalid.components).find(component => (
      component !== sourceComponent
      && component.contributors.some(contributor => contributor.id === sourceContributor.id)
    ))!
    const targetContributor = targetComponent.contributors.find(
      contributor => contributor.id === sourceContributor.id,
    )!
    const originalLogin = targetContributor.login
    const reboundProfile = {
      avatarUrl: 'https://jihulab.com/uploads/-/system/user/avatar/999999/avatar.png',
      login: 'different-user',
      name: 'Different User',
      profileUrl: 'https://jihulab.com/different-user',
    }
    Object.assign(targetContributor, reboundProfile)
    for (const commit of targetComponent.commits) {
      if (commit.author.login === originalLogin)
        Object.assign(commit.author, reboundProfile)
    }

    expect(() => assertGitlabMetadataSnapshot(
      invalid,
      repositoryMetadataExpectations.gitlab,
    )).toThrow(
      `GitLab contributor ${sourceContributor.id} must remain bound to login ${sourceContributor.login} across components`,
    )
  })

  it('downgrades GitLab Issues capabilities when the project disables Issues', () => {
    const snapshot = structuredClone(gitlabSnapshot)
    snapshot.repository.issuesEnabled = false
    for (const component of Object.values(snapshot.components)) {
      Reflect.deleteProperty(component, 'openIssueCount')
      Reflect.deleteProperty(component, 'openIssues')
    }

    const metadata = repositoryMetadataProviders.resolve(
      'gitlab',
      snapshot,
      repositoryMetadataExpectations.gitlab,
    )

    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(metadata.components.CopyText?.openIssueCount).toBeUndefined()
  })

  it('downgrades Gitee Issues capabilities when the repository disables Issues', () => {
    const snapshot = structuredClone(giteeSnapshot)
    snapshot.repository.issuesEnabled = false
    for (const component of Object.values(snapshot.components)) {
      Reflect.deleteProperty(component, 'openIssueCount')
      Reflect.deleteProperty(component, 'openIssues')
    }

    const metadata = repositoryMetadataProviders.resolve(
      'gitee',
      snapshot,
      repositoryMetadataExpectations.gitee,
    )

    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(metadata.components.CopyText?.openIssueCount).toBeUndefined()
  })

  it('rejects malformed GitLab identity and leaked contributor fields', () => {
    const wrongProject = structuredClone(gitlabSnapshot)
    wrongProject.repository.projectPath = 'other/project'
    expect(() => assertGitlabMetadataSnapshot(
      wrongProject,
      repositoryMetadataExpectations.gitlab,
    )).toThrow(`projectPath must be ${repositoryMetadataExpectations.gitlab.projectPath}`)

    const leakedContributor = structuredClone(gitlabSnapshot)
    const contributor = leakedContributor.components.CopyText?.contributors[0]
    if (contributor)
      Object.assign(contributor, { email: 'private@example.test' })
    else
      leakedContributor.components.CopyText!.contributors.push({ contributions: 1, id: 'gitlab:test', name: 'Test', email: 'private@example.test' } as never)
    expect(() => assertGitlabMetadataSnapshot(
      leakedContributor,
      repositoryMetadataExpectations.gitlab,
    )).toThrow('CopyText contributor contains unsupported or missing fields')
  })

  it('requires complete trusted GitLab contributor profiles', () => {
    const incompleteProfile = structuredClone(gitlabSnapshot)
    Reflect.deleteProperty(incompleteProfile.components.CopyText!.contributors[0]!, 'avatarUrl')
    Object.assign(incompleteProfile.components.CopyText!.contributors[0]!, {
      login: 'moluoxixi',
      profileUrl: 'https://jihulab.com/moluoxixi',
    })
    expect(() => assertGitlabMetadataSnapshot(
      incompleteProfile,
      repositoryMetadataExpectations.gitlab,
    )).toThrow('CopyText contributor contains unsupported or missing fields')

    for (const fields of [
      {
        avatarUrl: 'https://example.test/avatar.png',
        login: 'moluoxixi',
        profileUrl: 'https://jihulab.com/moluoxixi',
      },
      {
        avatarUrl: 'https://jihulab.com/uploads/avatar.png?private_token=secret',
        login: 'moluoxixi',
        profileUrl: 'https://jihulab.com/moluoxixi',
      },
      {
        avatarUrl: 'https://jihulab.com/uploads/avatar.png',
        login: 'moluoxixi',
        profileUrl: 'https://jihulab.com/another-user',
      },
    ]) {
      const invalidProfile = structuredClone(gitlabSnapshot)
      Object.assign(invalidProfile.components.CopyText!.contributors[0]!, fields)
      expect(() => assertGitlabMetadataSnapshot(
        invalidProfile,
        repositoryMetadataExpectations.gitlab,
      )).toThrow(/contributor (avatar|profile) URL/)
    }
  })

  it('validates contributor profiles for self-managed GitLab relative paths', () => {
    const expectation = {
      ...repositoryMetadataExpectations.gitlab,
      projectPath: 'group/subgroup/project',
      repositoryUrl: 'https://gitlab.test/gitlab/group/subgroup/project',
    }
    const snapshot = structuredClone(gitlabSnapshot)
    Object.assign(snapshot.repository, {
      projectPath: expectation.projectPath,
      webUrl: expectation.repositoryUrl,
    })
    for (const component of Object.values(snapshot.components)) {
      for (const contributor of component.contributors) {
        Object.assign(contributor, {
          avatarUrl: 'https://gitlab.test/gitlab/uploads/avatar.png',
          login: 'alice',
          profileUrl: 'https://gitlab.test/gitlab/alice',
        })
      }
    }
    for (const component of Object.values(snapshot.components)) {
      for (const commit of component.commits) {
        Object.assign(commit.author, {
          avatarUrl: 'https://gitlab.test/gitlab/uploads/avatar.png',
          login: 'alice',
          profileUrl: 'https://gitlab.test/gitlab/alice',
        })
        commit.url = `${expectation.repositoryUrl}/-/commit/${commit.sha}`
      }
      for (const issue of component.openIssues!)
        issue.url = `${expectation.repositoryUrl}/-/work_items/${issue.iid}`
    }

    expect(() => assertGitlabMetadataSnapshot(snapshot, expectation)).not.toThrow()
  })

  it('accepts exact GitLab Issue detail routes and rejects route identity drift', () => {
    const workItemSnapshot = structuredClone(gitlabSnapshot)
    expect(workItemSnapshot.components.CopyText?.openIssues?.[0]?.url).toContain('/-/work_items/1')
    expect(() => assertGitlabMetadataSnapshot(
      workItemSnapshot,
      repositoryMetadataExpectations.gitlab,
    )).not.toThrow()

    const issueRouteSnapshot = structuredClone(gitlabSnapshot)
    issueRouteSnapshot.components.CopyText!.openIssues![0]!.url
      = `${issueRouteSnapshot.repository.webUrl}/-/issues/1`
    expect(() => assertGitlabMetadataSnapshot(
      issueRouteSnapshot,
      repositoryMetadataExpectations.gitlab,
    )).not.toThrow()

    for (const invalidUrl of [
      'https://jihulab.com/another/project/-/work_items/1',
      `${gitlabSnapshot.repository.webUrl}/-/work_items/2`,
      `${gitlabSnapshot.repository.webUrl}/-/issues/new`,
      `${gitlabSnapshot.repository.webUrl}/-/work_items/1/`,
      `${gitlabSnapshot.repository.webUrl}/-/work_items/1?from=fixture`,
      `${gitlabSnapshot.repository.webUrl}/-/work_items/1#notes`,
    ]) {
      const invalidSnapshot = structuredClone(gitlabSnapshot)
      invalidSnapshot.components.CopyText!.openIssues![0]!.url = invalidUrl
      expect(() => assertGitlabMetadataSnapshot(
        invalidSnapshot,
        repositoryMetadataExpectations.gitlab,
      )).toThrow('CopyText issue URL must be an Issue detail URL for the configured project and iid')
    }
  })

  it('rejects GitLab commit URLs that do not match the configured project and SHA', () => {
    const commit = gitlabSnapshot.components.CopyText!.commits[0]!

    for (const invalidUrl of [
      `https://jihulab.com/another/project/-/commit/${commit.sha}`,
      `${gitlabSnapshot.repository.webUrl}/-/commit/${'a'.repeat(40)}`,
      `${commit.url}?from=fixture`,
      `${commit.url}#diff-content`,
    ]) {
      const invalidSnapshot = structuredClone(gitlabSnapshot)
      invalidSnapshot.components.CopyText!.commits[0]!.url = invalidUrl
      expect(() => assertGitlabMetadataSnapshot(
        invalidSnapshot,
        repositoryMetadataExpectations.gitlab,
      )).toThrow('CopyText commit URL must be a commit detail URL for the configured project and SHA')
    }
  })

  it('rejects unsupported nested fields in local Git metadata', () => {
    const leakedSnapshot = structuredClone(localSnapshot)
    Object.assign(leakedSnapshot.components.CopyText!.commits[0]!.author, {
      emailAddress: 'private@example.test',
    })

    expect(() => assertLocalMetadataSnapshot(
      leakedSnapshot,
      repositoryMetadataExpectations.local,
    )).toThrow('CopyText commit author contains unsupported or missing fields')
  })

  it('rejects local Git metadata from the wrong default branch', () => {
    const wrongBranchSnapshot = structuredClone(localSnapshot)
    wrongBranchSnapshot.repository.defaultBranch = 'feature/docs'

    expect(() => assertLocalMetadataSnapshot(
      wrongBranchSnapshot,
      repositoryMetadataExpectations.local,
    )).toThrow(`repository default branch must be ${repositoryMetadataExpectations.local.defaultBranch}`)
  })

  it('allows a future provider to be registered with an explicit capability contract', () => {
    const futureProvider = defineRepositoryMetadataProvider({
      capabilities: {
        commitHistory: false,
        contributorProfiles: false,
        contributors: false,
        editLinks: false,
        issueActions: false,
        issues: false,
        sourceLinks: false,
      },
      id: 'fixture',
      platform: 'fixture',
      resolveSnapshot: () => ({
        components: {},
        repository: { defaultBranch: 'main', headSha: 'a'.repeat(40) },
      }),
      snapshotFile: 'fixture-metadata.json',
    } satisfies RepositoryMetadataProvider)
    const registry = createRepositoryMetadataProviderRegistry([futureProvider])

    expect(registry.ids).toEqual(['fixture'])
    expect(registry.get('fixture').platform).toBe('fixture')
    expect(registry.resolve('fixture', {}, repositoryMetadataExpectations.github).components).toEqual({})
  })
})
