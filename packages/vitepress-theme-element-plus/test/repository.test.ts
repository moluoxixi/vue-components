import type { RepositoryMetadataProvider } from '../index'
import { describe, expect, it } from 'vitest'
import {
  createGiteeRepositoryMetadataActions,
  createGithubRepositoryMetadataActions,
  createGitlabRepositoryMetadataActions,
  createRepositoryMetadataProviderRegistry,
  createYunxiaoRepositoryMetadataActions,
  defineRepositoryMetadataProvider,
} from '../index'

const noCapabilities = {
  commitHistory: false,
  contributorProfiles: false,
  contributors: false,
  editLinks: false,
  issueActions: false,
  issues: false,
  sourceLinks: false,
} as const

describe('repository provider public contract', () => {
  it('creates exact GitHub and GitLab actions with segment-safe paths', () => {
    const github = createGithubRepositoryMetadataActions()
    const gitlab = createGitlabRepositoryMetadataActions()
    const gitee = createGiteeRepositoryMetadataActions()
    const yunxiao = createYunxiaoRepositoryMetadataActions()
    const file = {
      defaultBranch: 'feature/docs links',
      path: 'packages/my component/demo.vue',
      repositoryUrl: 'https://example.test/group/project/',
    }

    expect(github.componentSourceHref?.(file)).toBe(
      'https://example.test/group/project/tree/feature/docs%20links/packages/my%20component/demo.vue',
    )
    expect(github.sourceLineHref?.({ ...file, startLine: 3, endLine: 8 })).toBe(
      'https://example.test/group/project/blob/feature/docs%20links/packages/my%20component/demo.vue?plain=1#L3-L8',
    )
    expect(gitlab.componentSourceHref?.(file)).toBe(
      'https://example.test/group/project/-/tree/feature/docs%20links/packages/my%20component/demo.vue',
    )
    expect(gitlab.editDocumentationHref?.(file)).toBe(
      'https://example.test/group/project/-/edit/feature/docs%20links/packages/my%20component/demo.vue',
    )
    expect(gitlab.sourceLineHref?.({ ...file, startLine: 3, endLine: 8 })).toBe(
      'https://example.test/group/project/-/blob/feature/docs%20links/packages/my%20component/demo.vue#L3-8',
    )
    expect(gitlab.newIssueHref?.({ issueTitlePrefix: '[CopyText]', repositoryUrl: file.repositoryUrl }))
      .toBe('https://example.test/group/project/-/issues/new?issue%5Btitle%5D=%5BCopyText%5D+')
    expect(gitlab.openIssuesHref?.({ issueTitlePrefix: '[CopyText]', repositoryUrl: file.repositoryUrl }))
      .toBe('https://example.test/group/project/-/issues?search=%5BCopyText%5D&state=opened')
    expect(gitee.componentSourceHref?.(file)).toBe(
      'https://example.test/group/project/tree/feature/docs%20links/packages/my%20component/demo.vue',
    )
    expect(gitee.editDocumentationHref?.(file)).toBe(
      'https://example.test/group/project/edit/feature/docs%20links/packages/my%20component/demo.vue',
    )
    expect(gitee.sourceLineHref?.({ ...file, startLine: 3, endLine: 8 })).toBe(
      'https://example.test/group/project/blob/feature/docs%20links/packages/my%20component/demo.vue#L3-L8',
    )
    expect(gitee.newIssueHref?.({ issueTitlePrefix: '[CopyText]', repositoryUrl: file.repositoryUrl }))
      .toBe('https://example.test/group/project/issues/new?issue%5Btitle%5D=%5BCopyText%5D+')
    expect(gitee.openIssuesHref?.({ issueTitlePrefix: '[CopyText]', repositoryUrl: file.repositoryUrl }))
      .toBe('https://example.test/group/project/issues?q=is%3Aopen+in%3Atitle+%22%5BCopyText%5D%22')
    expect(yunxiao).toEqual({})
    expect(Object.isFrozen(yunxiao)).toBe(true)
  })

  it('allows snapshots to downgrade but never elevate provider capabilities', () => {
    const provider = defineRepositoryMetadataProvider({
      capabilities: {
        ...noCapabilities,
        contributors: true,
        issues: true,
      },
      id: 'fixture',
      platform: 'fixture',
      resolveSnapshot: () => ({
        capabilities: { contributors: false, issues: false },
        payload: {
          components: {
            Demo: {
              commits: [],
              contributors: [{
                avatarUrl: 'https://example.test/avatar.png',
                contributions: 1,
                id: 'fixture:1',
                login: 'demo',
                name: 'Demo',
                profileUrl: 'https://example.test/demo',
              }],
              openIssueCount: 2,
              path: 'src/Demo',
            },
          },
          repository: { defaultBranch: 'main', headSha: 'a'.repeat(40) },
        },
      }),
      snapshotFile: 'fixture-metadata.json',
    } satisfies RepositoryMetadataProvider)
    const metadata = createRepositoryMetadataProviderRegistry([provider]).resolve('fixture', {}, {
      components: [],
      defaultBranch: 'main',
    })

    expect(metadata.provider.capabilities.contributors).toBe(false)
    expect(metadata.provider.capabilities.issues).toBe(false)
    expect(metadata.components.Demo?.contributors).toEqual([])
    expect(metadata.components.Demo?.openIssueCount).toBeUndefined()

    const invalidProvider = defineRepositoryMetadataProvider({
      capabilities: noCapabilities,
      id: 'invalid',
      platform: 'invalid',
      resolveSnapshot: () => ({
        capabilities: { contributorProfiles: true },
        payload: { components: {}, repository: { defaultBranch: 'main', headSha: 'b'.repeat(40) } },
      }),
      snapshotFile: 'invalid-metadata.json',
    } satisfies RepositoryMetadataProvider)
    expect(() => createRepositoryMetadataProviderRegistry([invalidProvider]).resolve('invalid', {}, {
      components: [],
      defaultBranch: 'main',
    })).toThrow('snapshot cannot enable capability "contributorProfiles"')
  })
})
