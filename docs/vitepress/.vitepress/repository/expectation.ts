import type { RepositoryMetadataExpectation } from './types.ts'
import { documentedComponents } from '../catalog/component-manifest.ts'
import { docsSite } from '../site/docs-site.ts'

const components = documentedComponents.map(component => ({
  name: component.name,
  path: component.repositorySourcePath,
}))

export const repositoryMetadataExpectations = {
  gitee: {
    components,
    defaultBranch: docsSite.repositories.gitee.defaultBranch,
    owner: docsSite.repositories.gitee.owner,
    repository: docsSite.repositories.gitee.name,
    repositoryUrl: docsSite.repositories.gitee.url,
  },
  github: {
    components,
    defaultBranch: docsSite.repositories.github.defaultBranch,
    owner: docsSite.repositories.github.owner,
    repository: docsSite.repositories.github.name,
    repositoryUrl: docsSite.repositories.github.url,
  },
  gitlab: {
    components,
    defaultBranch: docsSite.repositories.gitlab.defaultBranch,
    projectPath: docsSite.repositories.gitlab.projectPath,
    repositoryUrl: docsSite.repositories.gitlab.url,
  },
  local: {
    components,
    defaultBranch: docsSite.repositories.local.defaultBranch,
    repositoryUrl: docsSite.repositories.local.url,
  },
  yunxiao: {
    apiMode: docsSite.repositories.yunxiao.apiMode,
    components,
    defaultBranch: docsSite.repositories.yunxiao.defaultBranch,
    organizationId: docsSite.repositories.yunxiao.organizationId,
    repositoryId: docsSite.repositories.yunxiao.repositoryId,
    repositoryPath: docsSite.repositories.yunxiao.repositoryPath,
    repositoryUrl: docsSite.repositories.yunxiao.url,
  },
} satisfies Record<keyof typeof docsSite.repositories, RepositoryMetadataExpectation>

export const repositoryMetadataExpectation = repositoryMetadataExpectations[docsSite.metadataProvider]
