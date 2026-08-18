export interface ElementPlusDocsCommitAuthor {
  avatarUrl?: string
  login?: string
  name: string
  profileUrl?: string
}

export interface ElementPlusDocsCommit {
  author: ElementPlusDocsCommitAuthor
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface ElementPlusDocsContributor {
  avatarUrl?: string
  contributions: number
  id: string
  login?: string
  name: string
  profileUrl?: string
}

export interface ElementPlusDocsComponentMetaData {
  apiHref?: string
  commits?: readonly ElementPlusDocsCommit[]
  editHref?: string
  hasSourceDoc: boolean
  importStatement: string
  name: string
  newIssueHref?: string
  openIssueCount?: number
  openIssuesHref?: string
  overviewHref: string
  sourceHref?: string
  sourceLabel: string
}
