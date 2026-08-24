import type {
  RepositoryMetadata,
  RepositoryMetadataExpectation,
} from '../../content/repository/types'
import type { ElementPlusDocsProject, ElementPlusDocsResolvedRepository } from '../../project'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { repositoryMetadataProviders } from '../../content/repository/providers'
import { resolveElementPlusDocsProjectRepository } from '../../project'
import { writeJsonAtomically } from './atomic-write'

export interface ElementPlusDocsRepositoryRuntime {
  environment?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  generatedRoot: string
  project: ElementPlusDocsProject
  projectRoot: string
  providerOverride?: string
}

export interface SynchronizedElementPlusDocsRepository {
  metadata: RepositoryMetadata
  outputPath: string
  repository: ElementPlusDocsResolvedRepository
  snapshot: unknown
}

function componentSources(project: ElementPlusDocsProject) {
  return project.components.flatMap(group => group.items).map(component => ({
    name: component.name,
    path: component.repositorySourcePath,
  }))
}

function repositoryExpectation(
  repository: ElementPlusDocsResolvedRepository,
  defaultBranch: string,
  project: ElementPlusDocsProject,
  repositoryUrl = repository.url,
): RepositoryMetadataExpectation {
  const expectation: RepositoryMetadataExpectation = {
    components: componentSources(project),
    defaultBranch,
    repositoryUrl,
  }
  switch (repository.provider) {
    case 'github':
    case 'gitee':
      return {
        ...expectation,
        owner: repository.owner,
        repository: repository.repository,
      }
    case 'gitlab':
      return { ...expectation, projectPath: repository.projectPath }
    case 'yunxiao':
      return {
        ...expectation,
        apiMode: repository.apiMode,
        organizationId: repository.organizationId,
        repositoryId: repository.repositoryId,
        repositoryPath: repository.repositoryPath,
      }
    case 'local':
      return expectation
  }
}

function requireObject(value: unknown, provider: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${provider} repository API returned an invalid response`)
  return value as Record<string, unknown>
}

async function requestDefaultBranch(
  repository: Exclude<ElementPlusDocsResolvedRepository, { provider: 'local' }>,
  environment: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<string> {
  let url: URL
  let headers: Record<string, string>
  switch (repository.provider) {
    case 'github': {
      url = new URL(`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`)
      headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': repository.userAgent,
        'X-GitHub-Api-Version': '2022-11-28',
      }
      if (environment.GITHUB_TOKEN)
        headers.Authorization = `Bearer ${environment.GITHUB_TOKEN}`
      break
    }
    case 'gitee': {
      url = new URL(`${repository.apiBaseUrl}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`)
      if (environment.GITEE_TOKEN)
        url.searchParams.set('access_token', environment.GITEE_TOKEN)
      headers = { 'Accept': 'application/json', 'User-Agent': repository.userAgent }
      break
    }
    case 'gitlab': {
      url = new URL(`${repository.apiBaseUrl}/projects/${encodeURIComponent(repository.projectPath)}`)
      headers = { 'Accept': 'application/json', 'User-Agent': repository.userAgent }
      const token = environment.GITLAB_TOKEN
      if (token)
        headers[repository.authentication === 'bearer' ? 'Authorization' : 'PRIVATE-TOKEN'] = repository.authentication === 'bearer' ? `Bearer ${token}` : token
      break
    }
    case 'yunxiao': {
      const { yunxiaoRepositoryApiPath } = await import('./yunxiao')
      url = new URL(`${repository.apiBaseUrl}${yunxiaoRepositoryApiPath(repository.apiMode, repository.organizationId, repository.repositoryId)}`)
      headers = {
        'Accept': 'application/json',
        'User-Agent': repository.userAgent,
        'X-Yunxiao-Token': environment.YUNXIAO_TOKEN ?? '',
      }
      break
    }
  }
  const response = await fetchImpl(url, { headers })
  if (!response.ok)
    throw new Error(`${repository.provider} repository request failed (${response.status}) while resolving the default branch`)
  const payload = requireObject(await response.json(), repository.provider)
  const branch = repository.provider === 'github' || repository.provider === 'gitee'
    ? payload.default_branch
    : payload.defaultBranch ?? payload.default_branch
  if (typeof branch !== 'string' || !branch.trim())
    throw new TypeError(`${repository.provider} repository API did not return a default branch`)
  return branch.trim()
}

function runGit(repositoryRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }).trim()
}

function resolveLocalRepositoryRoot(projectRoot: string, configured?: string): string {
  const candidate = configured ? resolve(projectRoot, configured) : projectRoot
  try {
    return runGit(candidate, ['rev-parse', '--show-toplevel'])
  }
  catch (error) {
    throw new Error(`Unable to resolve the local Git repository from ${candidate}`, { cause: error })
  }
}

function normalizeGitRemoteUrl(remote: string): string {
  const ssh = remote.match(/^git@([^:]+):(.+)$/)
  const value = ssh ? `https://${ssh[1]}/${ssh[2]}` : remote
  return value.replace(/\.git$/, '').replace(/\/+$/, '')
}

function resolveLocalDefaultBranch(repositoryRoot: string, configured?: string): string {
  if (configured)
    return configured
  try {
    return runGit(repositoryRoot, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '')
  }
  catch {
    const branch = runGit(repositoryRoot, ['branch', '--show-current'])
    if (!branch)
      throw new Error('Unable to infer the local Git default branch; configure repository.defaultBranch')
    return branch
  }
}

async function collectSelectedSnapshot(
  repository: ElementPlusDocsResolvedRepository,
  project: ElementPlusDocsProject,
  projectRoot: string,
  environment: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<{ defaultBranch: string, repositoryUrl?: string, snapshot: unknown }> {
  const components = componentSources(project)
  if (repository.provider === 'local') {
    const { createLocalMetadata } = await import('./local')
    const repositoryRoot = resolveLocalRepositoryRoot(projectRoot, repository.repositoryRoot)
    const defaultBranch = resolveLocalDefaultBranch(repositoryRoot, repository.defaultBranch)
    const repositoryUrl = repository.url
      ?? normalizeGitRemoteUrl(runGit(repositoryRoot, ['config', '--get', 'remote.origin.url']))
    return {
      defaultBranch,
      repositoryUrl,
      snapshot: createLocalMetadata({ components, defaultBranch, repositoryRoot, repositoryUrl }),
    }
  }

  const defaultBranch = repository.defaultBranch
    ?? await requestDefaultBranch(repository, environment, fetchImpl)
  switch (repository.provider) {
    case 'github': {
      const { createGithubMetadata } = await import('./github')
      return {
        defaultBranch,
        snapshot: await createGithubMetadata({
          components,
          defaultBranch,
          excludeBotsFromContributors: repository.excludeBotsFromContributors,
          fetchImpl,
          issueTitlePrefix: repository.issueTitlePrefix,
          owner: repository.owner,
          repository: repository.repository,
          token: environment.GITHUB_TOKEN,
          userAgent: repository.userAgent,
        }),
      }
    }
    case 'gitee': {
      const { createGiteeMetadata } = await import('./gitee')
      return {
        defaultBranch,
        snapshot: await createGiteeMetadata({
          apiBaseUrl: repository.apiBaseUrl,
          components,
          defaultBranch,
          fetchImpl,
          issueTitlePrefix: repository.issueTitlePrefix,
          owner: repository.owner,
          repository: repository.repository,
          repositoryUrl: repository.url,
          token: environment.GITEE_TOKEN,
          userAgent: repository.userAgent,
          webBaseUrl: repository.webBaseUrl,
        }),
      }
    }
    case 'gitlab': {
      const { createGitlabMetadata } = await import('./gitlab')
      return {
        defaultBranch,
        snapshot: await createGitlabMetadata({
          apiBaseUrl: repository.apiBaseUrl,
          authentication: repository.authentication,
          components,
          contributorProfiles: repository.contributorProfiles,
          defaultBranch,
          fetchImpl,
          issueTitlePrefix: repository.issueTitlePrefix,
          projectPath: repository.projectPath,
          repositoryUrl: repository.url,
          token: environment.GITLAB_TOKEN,
          userAgent: repository.userAgent,
          webBaseUrl: repository.webBaseUrl,
        }),
      }
    }
    case 'yunxiao': {
      const { createYunxiaoMetadata } = await import('./yunxiao')
      return {
        defaultBranch,
        snapshot: await createYunxiaoMetadata({
          apiBaseUrl: repository.apiBaseUrl,
          apiMode: repository.apiMode,
          components,
          contributorAccounts: repository.contributorAccounts,
          defaultBranch,
          fetchImpl,
          organizationId: repository.organizationId,
          repositoryId: repository.repositoryId,
          repositoryPath: repository.repositoryPath,
          repositoryUrl: repository.url,
          token: environment.YUNXIAO_TOKEN ?? '',
          userAgent: repository.userAgent,
        }),
      }
    }
  }
}

function snapshotPath(generatedRoot: string, providerId: string): string {
  const provider = repositoryMetadataProviders.get(providerId)
  return resolve(generatedRoot, 'repository', provider.snapshotFile)
}

export async function synchronizeElementPlusDocsRepository(
  options: ElementPlusDocsRepositoryRuntime,
): Promise<SynchronizedElementPlusDocsRepository> {
  const repository = resolveElementPlusDocsProjectRepository(options.project, options.providerOverride)
  const environment = options.environment ?? process.env
  const { defaultBranch, repositoryUrl, snapshot } = await collectSelectedSnapshot(
    repository,
    options.project,
    options.projectRoot,
    environment,
    options.fetchImpl ?? fetch,
  )
  const expectation = repositoryExpectation(repository, defaultBranch, options.project, repositoryUrl)
  const metadata = repositoryMetadataProviders.resolve(repository.provider, snapshot, expectation)
  const outputPath = snapshotPath(options.generatedRoot, repository.provider)
  writeJsonAtomically(snapshot, outputPath)
  return { metadata, outputPath, repository, snapshot }
}

export function validateElementPlusDocsRepository(
  options: Omit<ElementPlusDocsRepositoryRuntime, 'fetchImpl'>,
): RepositoryMetadata {
  const repository = resolveElementPlusDocsProjectRepository(options.project, options.providerOverride)
  const path = snapshotPath(options.generatedRoot, repository.provider)
  const snapshot: unknown = JSON.parse(readFileSync(path, 'utf8'))
  const rawRepository = requireObject(requireObject(snapshot, repository.provider).repository, repository.provider)
  const defaultBranch = rawRepository.defaultBranch ?? rawRepository.default_branch
  if (typeof defaultBranch !== 'string' || !defaultBranch.trim())
    throw new TypeError(`${repository.provider} snapshot has no default branch`)
  if (repository.defaultBranch && repository.defaultBranch !== defaultBranch)
    throw new TypeError(`${repository.provider} snapshot default branch does not match the configured branch`)
  const snapshotRepositoryUrl = rawRepository.url ?? rawRepository.webUrl
  const repositoryUrl = repository.url
    ?? (typeof snapshotRepositoryUrl === 'string' ? snapshotRepositoryUrl : undefined)
  return repositoryMetadataProviders.resolve(
    repository.provider,
    snapshot,
    repositoryExpectation(repository, defaultBranch, options.project, repositoryUrl),
  )
}
