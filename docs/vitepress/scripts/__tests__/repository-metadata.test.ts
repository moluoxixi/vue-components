// @vitest-environment node

import type { RepositoryMetadataProvider } from '../../.vitepress/repository-metadata-types'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  docsRepositoryMetadataProviderIds,
  docsSite,
  resolveDocsRepositoryMetadataProvider,
} from '../../.vitepress/docs-site'
import { assertGiteeMetadataSnapshot } from '../../.vitepress/gitee-metadata-types'
import giteeSnapshot from '../../.vitepress/gitee-metadata.json'
import githubSnapshot from '../../.vitepress/github-metadata.json'
import { assertGitlabMetadataSnapshot } from '../../.vitepress/gitlab-metadata-types'
import gitlabSnapshot from '../../.vitepress/gitlab-metadata.json'
import { assertLocalMetadataSnapshot } from '../../.vitepress/local-metadata-types'
import localSnapshot from '../../.vitepress/local-metadata.json'
import { repositoryMetadataSnapshotPath } from '../../.vitepress/repository-metadata-alias'
import { repositoryMetadataExpectations } from '../../.vitepress/repository-metadata-expectation'
import { repositoryMetadataProviders } from '../../.vitepress/repository-metadata-providers'
import {
  createRepositoryMetadataActionInput,
  selectRepositoryMetadataConfiguration,
} from '../../.vitepress/repository-metadata-selection'
import {
  createRepositoryMetadataProviderRegistry,
  defineRepositoryMetadataProvider,
  repositoryMetadataProviderSupports,
} from '../../.vitepress/repository-metadata-types'
import {
  resolveDocsRepositoryComponentMeta,
  resolveDocsRepositoryContributors,
} from '../../.vitepress/theme/repository-content'
import { assertYunxiaoMetadataSnapshot } from '../../.vitepress/yunxiao-metadata-types'
import yunxiaoSnapshot from '../../.vitepress/yunxiao-metadata.json'

const docsDirectory = fileURLToPath(new URL('../..', import.meta.url))

function validateSelectedMetadata(providerId?: string) {
  const environment = { ...process.env }
  if (providerId === undefined)
    delete environment.VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  else
    environment.VITE_DOCS_REPOSITORY_METADATA_PROVIDER = providerId

  return spawnSync(process.execPath, ['scripts/validate-selected-metadata.mts'], {
    cwd: docsDirectory,
    encoding: 'utf8',
    env: environment,
  })
}

describe('repository metadata providers', () => {
  it('resolves the build-time provider override strictly', () => {
    expect(resolveDocsRepositoryMetadataProvider(undefined)).toBe('github')
    expect(resolveDocsRepositoryMetadataProvider('  ')).toBe('github')
    for (const providerId of docsRepositoryMetadataProviderIds)
      expect(resolveDocsRepositoryMetadataProvider(providerId)).toBe(providerId)
    expect(() => resolveDocsRepositoryMetadataProvider('auto')).toThrow(
      'Unsupported VITE_DOCS_REPOSITORY_METADATA_PROVIDER: auto',
    )
  })

  it('applies the provider environment to the complete metadata selection', () => {
    const defaultSelection = validateSelectedMetadata()
    expect(defaultSelection.status).toBe(0)
    expect(defaultSelection.stdout).toContain(
      `Validated selected github metadata at ${githubSnapshot.repository.headSha.slice(0, 7)}`,
    )

    const gitlabSelection = validateSelectedMetadata('gitlab')
    expect(gitlabSelection.status).toBe(0)
    expect(gitlabSelection.stdout).toContain(
      `Validated selected gitlab metadata at ${gitlabSnapshot.repository.headSha.slice(0, 7)}`,
    )

    const invalidSelection = validateSelectedMetadata('invalid-provider')
    expect(invalidSelection.status).not.toBe(0)
    expect(`${invalidSelection.stdout}\n${invalidSelection.stderr}`).toContain(
      'Unsupported VITE_DOCS_REPOSITORY_METADATA_PROVIDER: invalid-provider',
    )
  })

  it('switches repository, snapshot, and action inputs as one provider-scoped selection', () => {
    const selection = selectRepositoryMetadataConfiguration(
      'gitlab',
      docsSite.repositories,
      repositoryMetadataExpectations,
      repositoryMetadataProviders,
    )
    const actionInput = createRepositoryMetadataActionInput(selection, 'CopyText')
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
    expect(selection.repository).toBe(docsSite.repositories.gitlab)
    expect(selection.expectation).toBe(repositoryMetadataExpectations.gitlab)
    expect(selection.snapshotFile).toBe('gitlab-metadata.json')
    expect(actionInput).toEqual({
      defaultBranch: 'main',
      issueTitlePrefix: '[CopyText]',
      repositoryUrl: 'https://jihulab.com/moluoxixi/vue-components-provider-fixture',
    })
    expect(sourceHref).toBe(
      'https://jihulab.com/moluoxixi/vue-components-provider-fixture/-/blob/main/packages/components/src/CopyText/docs/index.md#L3-8',
    )
    expect(selection.provider.actions?.componentSourceHref?.({
      ...actionInput,
      path: componentPath,
    })).toBe(
      'https://jihulab.com/moluoxixi/vue-components-provider-fixture/-/tree/main/packages/components/src/CopyText',
    )
    expect(selection.provider.actions?.editDocumentationHref?.({
      ...actionInput,
      path: documentationPath,
    })).toBe(
      'https://jihulab.com/moluoxixi/vue-components-provider-fixture/-/edit/main/packages/components/src/CopyText/docs/index.md',
    )
    expect(selection.provider.actions?.newIssueHref?.(actionInput)).toBe(
      'https://jihulab.com/moluoxixi/vue-components-provider-fixture/-/issues/new?issue%5Btitle%5D=%5BCopyText%5D+',
    )
    expect(selection.provider.actions?.openIssuesHref?.(actionInput)).toBe(
      'https://jihulab.com/moluoxixi/vue-components-provider-fixture/-/issues?search=%5BCopyText%5D&state=opened',
    )
    expect(sourceHref).not.toContain('github.com')
    expect(() => selectRepositoryMetadataConfiguration(
      'auto',
      docsSite.repositories,
      repositoryMetadataExpectations,
      repositoryMetadataProviders,
    )).toThrow('Unsupported repository metadata provider: auto')
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
      repositoryUrl: docsSite.repositories.github.url,
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

  it('maps provider capabilities to the documentation content surface', () => {
    const githubMetadata = repositoryMetadataProviders.resolve(
      'github',
      githubSnapshot,
      repositoryMetadataExpectations.github,
    )
    const localMetadata = repositoryMetadataProviders.resolve(
      'local',
      localSnapshot,
      repositoryMetadataExpectations.local,
    )
    const input = {
      defaultBranch: docsSite.repositories.github.defaultBranch,
      editPath: 'packages/components/src/CopyText/docs/index.md',
      issueTitlePrefix: docsSite.repositories.github.issueTitlePrefix('CopyText'),
      repositoryUrl: docsSite.repositories.github.url,
      sourcePath: 'packages/components/src/CopyText',
    }
    const githubContent = resolveDocsRepositoryComponentMeta(
      repositoryMetadataProviders.get('github'),
      githubMetadata.components.CopyText!,
      input,
    )
    const localContent = resolveDocsRepositoryComponentMeta(
      repositoryMetadataProviders.get('local'),
      localMetadata.components.CopyText!,
      input,
    )
    const localContributors = resolveDocsRepositoryContributors(
      repositoryMetadataProviders.get('local'),
      localMetadata.components.CopyText!,
    )

    expect(githubContent.sourceHref).toContain('/tree/main/')
    expect(githubContent.editHref).toContain('/edit/main/')
    expect(githubContent.newIssueHref).toContain('/issues/new?title=')
    expect(githubContent.openIssuesHref).toContain('/issues?q=')
    expect(githubContent.openIssueCount).toBeTypeOf('number')
    expect(localContent.commits?.length).toBeGreaterThan(0)
    expect(localContent).not.toHaveProperty('openIssueCount')
    expect(localContent.sourceHref).toBeUndefined()
    expect(localContent.editHref).toBeUndefined()
    expect(localContent.newIssueHref).toBeUndefined()
    expect(localContent.openIssuesHref).toBeUndefined()
    expect(localContributors?.length).toBeGreaterThan(0)
    expect(localContributors?.[0]).not.toHaveProperty('profileUrl')
  })

  it('registers GitLab with an isolated snapshot and capability contract', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'gitlab',
      gitlabSnapshot,
      repositoryMetadataExpectations.gitlab,
    )

    expect(repositoryMetadataProviders.ids).toEqual(['github', 'local', 'gitlab', 'gitee', 'yunxiao'])
    expect(repositoryMetadataSnapshotPath('gitlab')).toMatch(/gitlab-metadata\.json$/)
    expect(metadata.provider.platform).toBe('gitlab')
    expect(metadata.components.CopyText?.contributors.every(contributor => contributor.id.startsWith('gitlab:'))).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'sourceLinks')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributorProfiles')).toBe(true)
    expect(metadata.components.CopyText?.contributors.find(contributor => (
      contributor.id === 'gitlab:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b'
    ))).toMatchObject({
      avatarUrl: 'https://jihulab.com/uploads/-/system/user/avatar/268527/avatar.png',
      login: 'moluoxixi',
      name: 'moluoxixi',
      profileUrl: 'https://jihulab.com/moluoxixi',
    })
  })

  it('registers Gitee with an isolated snapshot and project-owned links', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'gitee',
      giteeSnapshot,
      repositoryMetadataExpectations.gitee,
    )
    const provider = repositoryMetadataProviders.get('gitee')

    expect(repositoryMetadataSnapshotPath('gitee')).toMatch(/gitee-metadata\.json$/)
    expect(metadata.provider.platform).toBe('gitee')
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(provider.actions?.sourceLineHref?.({
      defaultBranch: 'main',
      endLine: 8,
      path: 'README.md',
      repositoryUrl: docsSite.repositories.gitee.url,
      startLine: 3,
    })).toBe('https://gitee.com/mirrors/vue/blob/main/README.md#L3-L8')
  })

  it('registers Yunxiao with commit-only capabilities and no repository Issues or guessed links', () => {
    const metadata = repositoryMetadataProviders.resolve(
      'yunxiao',
      yunxiaoSnapshot,
      repositoryMetadataExpectations.yunxiao,
    )
    const provider = repositoryMetadataProviders.get('yunxiao')

    expect(repositoryMetadataSnapshotPath('yunxiao')).toMatch(/yunxiao-metadata\.json$/)
    expect(metadata.provider.platform).toBe('yunxiao')
    expect(repositoryMetadataProviderSupports(metadata.provider, 'commitHistory')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'contributors')).toBe(true)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issueActions')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'sourceLinks')).toBe(false)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'editLinks')).toBe(false)
    expect(provider.actions).toEqual({})
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
    )).toThrow('repository fullName must be mirrors/vue')

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
    leakedContributor.components.CopyText!.contributors.push({
      contributions: 1,
      id: 'yunxiao:test',
      name: 'Test',
      email: 'private@example.test',
    } as never)
    expect(() => assertYunxiaoMetadataSnapshot(
      leakedContributor,
      repositoryMetadataExpectations.yunxiao,
    )).toThrow('CopyText contributor contains unsupported or missing fields')
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

  it('rejects malformed GitLab identity and leaked contributor fields', () => {
    const wrongProject = structuredClone(gitlabSnapshot)
    wrongProject.repository.projectPath = 'other/project'
    expect(() => assertGitlabMetadataSnapshot(
      wrongProject,
      repositoryMetadataExpectations.gitlab,
    )).toThrow(`projectPath must be ${docsSite.repositories.gitlab.projectPath}`)

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
    )).toThrow('CopyText contributor profile fields must be provided together')

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
      for (const commit of component.commits)
        commit.url = `${expectation.repositoryUrl}/-/commit/${commit.sha}`
      for (const issue of component.openIssues)
        issue.url = `${expectation.repositoryUrl}/-/work_items/${issue.iid}`
    }

    expect(() => assertGitlabMetadataSnapshot(snapshot, expectation)).not.toThrow()
  })

  it('accepts exact GitLab Issue detail routes and rejects route identity drift', () => {
    const workItemSnapshot = structuredClone(gitlabSnapshot)
    expect(workItemSnapshot.components.CopyText?.openIssues[0]?.url).toContain('/-/work_items/1')
    expect(() => assertGitlabMetadataSnapshot(
      workItemSnapshot,
      repositoryMetadataExpectations.gitlab,
    )).not.toThrow()

    const legacyIssueSnapshot = structuredClone(gitlabSnapshot)
    legacyIssueSnapshot.components.CopyText!.openIssues[0]!.url
      = `${legacyIssueSnapshot.repository.webUrl}/-/issues/1`
    expect(() => assertGitlabMetadataSnapshot(
      legacyIssueSnapshot,
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
      invalidSnapshot.components.CopyText!.openIssues[0]!.url = invalidUrl
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
    )).toThrow(`repository default branch must be ${docsSite.repositories.local.defaultBranch}`)
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
