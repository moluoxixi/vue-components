// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { documentedComponents } from '../../.vitepress/component-manifest'
import { componentSourcePath, docsSite } from '../../.vitepress/docs-site'
import { assertGitLocalMetadataSnapshot } from '../../.vitepress/git-local-metadata-types'
import gitLocalSnapshot from '../../.vitepress/git-local-metadata.json'
import githubSnapshot from '../../.vitepress/github-metadata.json'
import { repositoryMetadata as configuredRepositoryMetadata } from '../../.vitepress/repository-metadata'
import { repositoryMetadataSnapshotPath } from '../../.vitepress/repository-metadata-alias'
import { resolveRepositoryMetadata } from '../../.vitepress/repository-metadata-types'

const expectation = {
  components: documentedComponents.map(component => ({
    name: component.name,
    path: componentSourcePath(component.name),
  })),
  defaultBranch: docsSite.repository.defaultBranch,
  owner: docsSite.repository.owner,
  repository: docsSite.repository.name,
  repositoryUrl: docsSite.repository.url,
}

describe('repository metadata source selection', () => {
  it('loads the configured source through the single-snapshot module alias', () => {
    expect(configuredRepositoryMetadata.source).toBe(docsSite.metadataSource)
    expect(configuredRepositoryMetadata.repository.headSha).toBe(gitLocalSnapshot.repository.headSha)
  })

  it('resolves exactly one source-specific snapshot file', () => {
    expect(repositoryMetadataSnapshotPath('github')).toMatch(/github-metadata\.json$/)
    expect(repositoryMetadataSnapshotPath('git-local')).toMatch(/git-local-metadata\.json$/)
  })

  it('normalizes only the explicitly selected GitHub snapshot', () => {
    const metadata = resolveRepositoryMetadata({
      expectation,
      githubSnapshot,
      gitLocalSnapshot: { invalid: true },
      source: 'github',
    })

    expect(metadata.source).toBe('github')
    expect(metadata.components.CopyText?.openIssueCount).toBeTypeOf('number')
    expect(metadata.components.CopyText?.contributors[0]?.id).toMatch(/^github:/)
  })

  it('normalizes only the explicitly selected local Git snapshot', () => {
    const metadata = resolveRepositoryMetadata({
      expectation,
      githubSnapshot: { invalid: true },
      gitLocalSnapshot,
      source: 'git-local',
    })

    expect(metadata.source).toBe('git-local')
    expect(metadata.components.CopyText?.openIssueCount).toBeUndefined()
    expect(metadata.components.CopyText?.contributors[0]?.id).toMatch(/^git:/)
    expect(metadata.components.CopyText?.contributors[0]).not.toHaveProperty('profileUrl')
  })

  it('fails when the selected snapshot is missing even if the other source is valid', () => {
    expect(() => resolveRepositoryMetadata({
      expectation,
      githubSnapshot,
      gitLocalSnapshot: undefined,
      source: 'git-local',
    })).toThrow('Invalid local Git metadata snapshot')

    expect(() => resolveRepositoryMetadata({
      expectation,
      githubSnapshot: undefined,
      gitLocalSnapshot,
      source: 'github',
    })).toThrow('Invalid GitHub metadata snapshot')
  })

  it('rejects unrecognized local snapshot fields before they can enter the browser bundle', () => {
    const leakedSnapshot = structuredClone(gitLocalSnapshot) as Record<string, any>
    leakedSnapshot.components.CopyText.commits[0].author.emailAddress = 'private@example.test'

    expect(() => assertGitLocalMetadataSnapshot(leakedSnapshot, {
      components: expectation.components,
      defaultBranch: expectation.defaultBranch,
      repositoryUrl: expectation.repositoryUrl,
    })).toThrow('commit author contains unsupported or missing fields')
  })

  it('rejects a local snapshot for a different default branch', () => {
    const mismatchedSnapshot = structuredClone(gitLocalSnapshot) as Record<string, any>
    mismatchedSnapshot.repository.defaultBranch = 'feature/docs'

    expect(() => assertGitLocalMetadataSnapshot(mismatchedSnapshot, {
      components: expectation.components,
      defaultBranch: expectation.defaultBranch,
      repositoryUrl: expectation.repositoryUrl,
    })).toThrow('repository default branch must be main')
  })
})
