import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponentPackage,
  defineElementPlusDocsProject,
  resolveElementPlusDocsPlaygroundManifest,
  resolveElementPlusDocsProject,
  resolveElementPlusDocsProjectRepository,
  resolveElementPlusDocsRepository,
} from '../index'
import { synchronizeElementPlusDocsRepository } from '../src/node/repository/project'

const temporaryDirectories: string[] = []

function packageProfile(root = 'packages/components') {
  return defineComponentPackage({
    name: '@fixture/components',
    root,
    componentSource: name => `${root}/src/${name}`,
    load: async () => ({}),
    styles: ['@fixture/components/styles'],
  })
}

function project(repository: Parameters<typeof defineElementPlusDocsProject>[0]['repository']) {
  return defineElementPlusDocsProject({
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
    repository,
    packages: { components: packageProfile() },
    components: [{
      id: 'general',
      title: 'General',
      description: 'General components',
      items: [{
        name: 'CopyText',
        sidebarText: 'CopyText',
        description: 'Copies text',
        icon: 'copy',
      }],
    }],
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('element plus docs project configuration', () => {
  it('derives package-owned component paths and stable slugs', () => {
    const resolved = resolveElementPlusDocsProject(project({
      provider: 'github',
      url: 'https://github.com/fixture/components',
    }))
    expect(resolved.components[0]?.items[0]).toMatchObject({
      apiEntry: 'packages/components/index.ts',
      docsSourcePath: 'packages/components/src/CopyText',
      packageName: '@fixture/components',
      repositorySourcePath: 'packages/components/src/CopyText',
      slug: 'copy-text',
    })
    expect(resolved.documentation).toMatchObject({
      componentsRoute: 'components',
      defaultLocale: 'en-US',
      locales: {
        'en-US': {
          lang: 'en-US',
          pathPrefix: '',
          siteKey: 'root',
          sourceDirectory: '',
        },
      },
    })
  })

  it('keeps generated Playground manifests lazy and validates them at the lifecycle boundary', () => {
    const loadPlaygroundManifest = vi.fn(async () => ({ imports: {}, packageName: '@fixture/components' }))
    const input = project({ provider: 'local' })
    input.packages = {
      components: defineComponentPackage({
        ...packageProfile(),
        loadPlaygroundManifest,
      }),
    }
    resolveElementPlusDocsProject(input)
    expect(loadPlaygroundManifest).not.toHaveBeenCalled()
    expect(resolveElementPlusDocsPlaygroundManifest('@fixture/components', {
      imports: {},
      packageName: '@fixture/components',
    })).toEqual({ imports: {}, packageName: '@fixture/components' })
    expect(() => resolveElementPlusDocsPlaygroundManifest('@fixture/components', {
      imports: {},
      packageName: '@fixture/other',
    })).toThrow('Playground manifest package mismatch')
  })

  it('derives GitHub and Gitee coordinates from the repository URL', () => {
    expect(resolveElementPlusDocsRepository({
      provider: 'github',
      url: 'https://github.com/acme/widgets.git',
    })).toMatchObject({
      owner: 'acme',
      repository: 'widgets',
      url: 'https://github.com/acme/widgets',
    })
    expect(resolveElementPlusDocsRepository({
      provider: 'gitee',
      url: 'https://gitee.com/acme/widgets',
    })).toMatchObject({
      apiBaseUrl: 'https://gitee.com/api/v5',
      owner: 'acme',
      repository: 'widgets',
      webBaseUrl: 'https://gitee.com',
    })
  })

  it('supports GitLab installations and derives Yunxiao organization coordinates', () => {
    expect(resolveElementPlusDocsRepository({
      provider: 'gitlab',
      url: 'https://gitlab.example.com/gitlab/group/widgets',
      projectPath: 'group/widgets',
      webBaseUrl: 'https://gitlab.example.com/gitlab',
    })).toMatchObject({
      apiBaseUrl: 'https://gitlab.example.com/gitlab/api/v4',
      projectPath: 'group/widgets',
      webBaseUrl: 'https://gitlab.example.com/gitlab',
    })
    expect(resolveElementPlusDocsRepository({
      provider: 'yunxiao',
      url: 'https://codeup.aliyun.com/org-id/widgets',
      repositoryId: '12345',
    })).toMatchObject({
      organizationId: 'org-id',
      repositoryId: '12345',
      repositoryPath: 'org-id/widgets',
    })
  })

  it('requires an override provider to be explicitly configured', () => {
    expect(() => resolveElementPlusDocsProjectRepository(
      project({ provider: 'github', url: 'https://github.com/acme/widgets' }),
      'gitlab',
    )).toThrow('Repository provider "gitlab" is selected but not configured')
  })

  it('reads only the selected provider token while synchronizing', async () => {
    const generatedRoot = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-selected-provider-'))
    temporaryDirectories.push(generatedRoot)
    const accessedEnvironmentKeys: string[] = []
    const environment = new Proxy<Record<string, string | undefined>>({ GITHUB_TOKEN: 'github-token' }, {
      get(target, property) {
        if (typeof property === 'string')
          accessedEnvironmentKeys.push(property)
        return Reflect.get(target, property)
      },
    })
    const input = defineElementPlusDocsProject({
      ...project({
        provider: 'github',
        url: 'https://github.com/fixture/components',
        defaultBranch: 'main',
      }),
      components: [],
      repositoryProviders: {
        gitlab: {
          provider: 'gitlab',
          url: 'https://gitlab.example.com/group/components',
        },
      },
    })
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      requests.push(url)
      if (url.includes('/git/ref/heads/'))
        return Response.json({ object: { sha: 'a'.repeat(40) } })
      if (url.includes('/issues?'))
        return Response.json([])
      throw new Error(`Unexpected GitHub request: ${url}`)
    }

    const result = await synchronizeElementPlusDocsRepository({
      environment,
      fetchImpl,
      generatedRoot,
      project: resolveElementPlusDocsProject(input),
      projectRoot: generatedRoot,
    })

    expect(result.repository.provider).toBe('github')
    expect(requests).toHaveLength(2)
    expect(accessedEnvironmentKeys).toEqual(['GITHUB_TOKEN'])
  })
})
