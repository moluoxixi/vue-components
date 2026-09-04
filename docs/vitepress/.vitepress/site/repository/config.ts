import {
  resolveElementPlusDocsProject,
  resolveElementPlusDocsProjectRepository,
} from '@moluoxixi/vitepress-theme-element-plus'
import {
  elementPlusDocsRepositorySnapshotId,
  repositoryMetadataProviders,
} from '@moluoxixi/vitepress-theme-element-plus/repository'
import projectConfig from '../../../element-plus-docs.config.ts'
import { docsSite } from '../config'

const providerLabels: Readonly<Record<string, string>> = {
  gitee: 'Gitee',
  github: 'GitHub',
  gitlab: 'GitLab',
  local: 'Local',
  yunxiao: 'Yunxiao',
}

export const docsProject = resolveElementPlusDocsProject(projectConfig)
export const docsRepository = resolveElementPlusDocsProjectRepository(
  docsProject,
  docsSite.metadataProvider,
)
export const docsRepositoryProvider = repositoryMetadataProviders.get(docsRepository.provider)
export const docsRepositoryLabel = providerLabels[docsRepository.provider] ?? docsRepositoryProvider.platform
export { elementPlusDocsRepositorySnapshotId }

function repositoryDefaultBranchEnvironment(): string | undefined {
  const viteEnvironment = import.meta.env?.VITE_DOCS_REPOSITORY_DEFAULT_BRANCH
  if (viteEnvironment)
    return viteEnvironment
  const nodeProcess = Reflect.get(globalThis, 'process') as
    | { env?: Record<string, string | undefined> }
    | undefined
  return nodeProcess?.env?.VITE_DOCS_REPOSITORY_DEFAULT_BRANCH
}

export function resolveDocsRepositoryDefaultBranch(): string {
  const defaultBranch = docsRepository.defaultBranch
    ?? repositoryDefaultBranchEnvironment()
  if (!defaultBranch)
    throw new Error(`Repository provider "${docsRepository.provider}" has no resolved default branch`)
  return defaultBranch
}

export function createDocsRepositoryActionInput(componentName: string) {
  if (!docsRepository.url)
    throw new Error(`Repository provider "${docsRepository.provider}" has no resolved repository URL`)
  return {
    defaultBranch: resolveDocsRepositoryDefaultBranch(),
    issueTitlePrefix: docsRepository.issueTitlePrefix(componentName),
    repositoryUrl: docsRepository.url,
  }
}
