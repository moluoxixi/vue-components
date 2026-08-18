// @vitest-environment node

import type { RepositoryMetadataProvider } from '../../.vitepress/repository-metadata-types'
import { describe, expect, it } from 'vitest'
import { docsSite } from '../../.vitepress/docs-site'
import githubSnapshot from '../../.vitepress/github-metadata.json'
import { assertLocalMetadataSnapshot } from '../../.vitepress/local-metadata-types'
import localSnapshot from '../../.vitepress/local-metadata.json'
import { configuredRepositoryMetadataProvider, repositoryMetadata } from '../../.vitepress/repository-metadata'
import { repositoryMetadataSnapshotPath } from '../../.vitepress/repository-metadata-alias'
import { repositoryMetadataExpectation } from '../../.vitepress/repository-metadata-expectation'
import { repositoryMetadataProviders } from '../../.vitepress/repository-metadata-providers'
import {
  createRepositoryMetadataProviderRegistry,
  defineRepositoryMetadataProvider,
  repositoryMetadataProviderSupports,
} from '../../.vitepress/repository-metadata-types'
import {
  resolveDocsRepositoryComponentMeta,
  resolveDocsRepositoryContributors,
} from '../../.vitepress/theme/repository-content'

describe('repository metadata providers', () => {
  it('keeps GitHub as the selected production provider and loads one snapshot', () => {
    expect(docsSite.metadataProvider).toBe('github')
    expect(configuredRepositoryMetadataProvider.id).toBe('github')
    expect(repositoryMetadata.provider.platform).toBe('github')
    expect(repositoryMetadata.repository.headSha).toBe(githubSnapshot.repository.headSha)
    expect(repositoryMetadataSnapshotPath(docsSite.metadataProvider)).toMatch(/github-metadata\.json$/)
  })

  it('normalizes GitHub capabilities and provider-owned links', () => {
    const metadata = repositoryMetadataProviders.resolve('github', githubSnapshot, repositoryMetadataExpectation)
    const provider = repositoryMetadataProviders.get('github')

    expect(metadata.components.CopyText?.openIssueCount).toBeTypeOf('number')
    expect(metadata.components.CopyText?.contributors[0]?.id).toMatch(/^github:/)
    expect(repositoryMetadataProviderSupports(metadata.provider, 'issues')).toBe(true)
    expect(provider.actions?.newIssueHref?.({
      issueTitlePrefix: '[CopyText]',
      repositoryUrl: docsSite.repository.url,
    })).toContain('/issues/new?title=')
  })

  it('normalizes local Git with history and contributors only', () => {
    const metadata = repositoryMetadataProviders.resolve('local', localSnapshot, repositoryMetadataExpectation)

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
      repositoryMetadataExpectation,
    )
    const localMetadata = repositoryMetadataProviders.resolve(
      'local',
      localSnapshot,
      repositoryMetadataExpectation,
    )
    const input = {
      defaultBranch: docsSite.repository.defaultBranch,
      editPath: 'packages/components/src/CopyText/docs/index.md',
      issueTitlePrefix: docsSite.repository.issueTitlePrefix('CopyText'),
      repositoryUrl: docsSite.repository.url,
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

  it('fails before snapshot loading for an unsupported provider', () => {
    expect(() => repositoryMetadataProviders.get('gitlab')).toThrow(
      'Unsupported repository metadata provider: gitlab',
    )
    expect(() => repositoryMetadataSnapshotPath('gitlab')).toThrow(
      'Unsupported repository metadata provider: gitlab',
    )
  })

  it('does not fall back to another provider snapshot', () => {
    expect(() => repositoryMetadataProviders.resolve(
      'github',
      localSnapshot,
      repositoryMetadataExpectation,
    )).toThrow('Invalid GitHub metadata snapshot')
    expect(() => repositoryMetadataProviders.resolve(
      'local',
      githubSnapshot,
      repositoryMetadataExpectation,
    )).toThrow('Invalid local Git metadata snapshot')
  })

  it('validates provider-required configuration before parsing snapshots', () => {
    expect(() => repositoryMetadataProviders.resolve('github', null, {
      ...repositoryMetadataExpectation,
      owner: undefined,
    })).toThrow('Repository metadata provider "github" requires configuration field "owner"')
    expect(() => repositoryMetadataProviders.resolve('github', null, {
      ...repositoryMetadataExpectation,
      repository: undefined,
    })).toThrow('Repository metadata provider "github" requires configuration field "repository"')
    expect(() => repositoryMetadataProviders.resolve('local', null, {
      ...repositoryMetadataExpectation,
      repositoryUrl: undefined,
    })).toThrow('Repository metadata provider "local" requires configuration field "repositoryUrl"')
  })

  it('rejects unsupported nested fields in local Git metadata', () => {
    const leakedSnapshot = structuredClone(localSnapshot)
    Object.assign(leakedSnapshot.components.CopyText!.commits[0]!.author, {
      emailAddress: 'private@example.test',
    })

    expect(() => assertLocalMetadataSnapshot(
      leakedSnapshot,
      repositoryMetadataExpectation,
    )).toThrow('CopyText commit author contains unsupported or missing fields')
  })

  it('rejects local Git metadata from the wrong default branch', () => {
    const wrongBranchSnapshot = structuredClone(localSnapshot)
    wrongBranchSnapshot.repository.defaultBranch = 'feature/docs'

    expect(() => assertLocalMetadataSnapshot(
      wrongBranchSnapshot,
      repositoryMetadataExpectation,
    )).toThrow(`repository default branch must be ${docsSite.repository.defaultBranch}`)
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
      id: 'gitlab',
      platform: 'gitlab',
      resolveSnapshot: () => ({
        components: {},
        repository: { defaultBranch: 'main', headSha: 'a'.repeat(40) },
      }),
      snapshotFile: 'gitlab-metadata.json',
    } satisfies RepositoryMetadataProvider)
    const registry = createRepositoryMetadataProviderRegistry([futureProvider])

    expect(registry.ids).toEqual(['gitlab'])
    expect(registry.get('gitlab').platform).toBe('gitlab')
    expect(registry.resolve('gitlab', {}, repositoryMetadataExpectation).components).toEqual({})
  })
})
