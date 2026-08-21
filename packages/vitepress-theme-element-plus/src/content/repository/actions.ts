import type { RepositoryMetadataProviderActions } from './types'

function repositoryRoot(repositoryUrl: string): string {
  return repositoryUrl.replace(/\/+$/, '')
}

function encodePath(value: string): string {
  return value.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

function yunxiaoMarkdownSourceQuery(path: string): string {
  // Codeup otherwise opens non-README Markdown in a preview without line anchors.
  return /\.md$/i.test(path) ? '?README.md' : ''
}

export function createGithubRepositoryMetadataActions(): Readonly<RepositoryMetadataProviderActions> {
  return Object.freeze({
    componentSourceHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/tree/${encodePath(defaultBranch)}/${encodePath(path)}`,
    editDocumentationHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/edit/${encodePath(defaultBranch)}/${encodePath(path)}`,
    newIssueHref: ({ issueTitlePrefix, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/issues/new?title=${encodeURIComponent(`${issueTitlePrefix} `)}`,
    openIssuesHref: ({ issueTitlePrefix, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/issues?q=${encodeURIComponent(`is:issue is:open in:title "${issueTitlePrefix}"`)}`,
    sourceLineHref: ({ defaultBranch, endLine, path, repositoryUrl, startLine }) => `${repositoryRoot(repositoryUrl)}/blob/${encodePath(defaultBranch)}/${encodePath(path)}?plain=1#L${startLine}-L${endLine}`,
  })
}

export function createGitlabRepositoryMetadataActions(): Readonly<RepositoryMetadataProviderActions> {
  return Object.freeze({
    componentSourceHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/-/tree/${encodePath(defaultBranch)}/${encodePath(path)}`,
    editDocumentationHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/-/edit/${encodePath(defaultBranch)}/${encodePath(path)}`,
    newIssueHref: ({ issueTitlePrefix, repositoryUrl }) => {
      const query = new URLSearchParams({ 'issue[title]': `${issueTitlePrefix} ` })
      return `${repositoryRoot(repositoryUrl)}/-/issues/new?${query}`
    },
    openIssuesHref: ({ issueTitlePrefix, repositoryUrl }) => {
      const query = new URLSearchParams({ search: issueTitlePrefix, state: 'opened' })
      return `${repositoryRoot(repositoryUrl)}/-/issues?${query}`
    },
    sourceLineHref: ({ defaultBranch, endLine, path, repositoryUrl, startLine }) => `${repositoryRoot(repositoryUrl)}/-/blob/${encodePath(defaultBranch)}/${encodePath(path)}#L${startLine}-${endLine}`,
  })
}

export function createGiteeRepositoryMetadataActions(): Readonly<RepositoryMetadataProviderActions> {
  return Object.freeze({
    componentSourceHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/tree/${encodePath(defaultBranch)}/${encodePath(path)}`,
    editDocumentationHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/edit/${encodePath(defaultBranch)}/${encodePath(path)}`,
    newIssueHref: ({ issueTitlePrefix, repositoryUrl }) => {
      const query = new URLSearchParams({ 'issue[title]': `${issueTitlePrefix} ` })
      return `${repositoryRoot(repositoryUrl)}/issues/new?${query}`
    },
    openIssuesHref: ({ issueTitlePrefix, repositoryUrl }) => {
      const query = new URLSearchParams({ q: `is:open in:title "${issueTitlePrefix}"` })
      return `${repositoryRoot(repositoryUrl)}/issues?${query}`
    },
    sourceLineHref: ({ defaultBranch, path, repositoryUrl, startLine }) => `${repositoryRoot(repositoryUrl)}/blame/${encodePath(defaultBranch)}/${encodePath(path)}#L${startLine}`,
  })
}

export function createYunxiaoRepositoryMetadataActions(): Readonly<RepositoryMetadataProviderActions> {
  return Object.freeze({
    componentSourceHref: ({ defaultBranch, path, repositoryUrl }) => `${repositoryRoot(repositoryUrl)}/tree/${encodePath(defaultBranch)}/${encodePath(path)}`,
    sourceLineHref: ({ defaultBranch, path, repositoryUrl, startLine }) => `${repositoryRoot(repositoryUrl)}/blob/${encodePath(defaultBranch)}/${encodePath(path)}${yunxiaoMarkdownSourceQuery(path)}#L${startLine}`,
  })
}
