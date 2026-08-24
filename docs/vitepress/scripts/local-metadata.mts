import type { Buffer } from 'node:buffer'
import type {
  LocalCommit,
  LocalContributor,
  LocalMetadataExpectation,
  LocalMetadataSnapshot,
} from '../.vitepress/repository/providers/local.ts'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { assertLocalMetadataSnapshot } from '../.vitepress/repository/providers/local.ts'

export interface LocalComponentSource {
  name: string
  path: string
}

export interface CreateLocalMetadataOptions {
  components: LocalComponentSource[]
  defaultBranch: string
  generatedAt?: string
  repositoryRoot: string
  repositoryUrl: string
  runGit?: (args: string[]) => string
}

export interface WriteLocalMetadataOptions {
  expectation: LocalMetadataExpectation
  outputPath: string
  snapshot: LocalMetadataSnapshot
}

interface ParsedLocalCommit extends LocalCommit {
  authorEmail: string
}

const GIT_LOG_FORMAT = '%H%x00%aN%x00%aE%x00%aI%x00%s%x00%x00'

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function createGitRunner(repositoryRoot: string): (args: string[]) => string {
  return (args) => {
    try {
      return execFileSync(
        'git',
        ['-c', 'i18n.logOutputEncoding=UTF-8', '-C', repositoryRoot, ...args],
        {
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      )
    }
    catch (error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr
      const detail = typeof stderr === 'string' ? stderr.trim() : stderr?.toString('utf8').trim()
      throw new Error(`Git metadata command failed: git ${args.join(' ')}${detail ? `\n${detail}` : ''}`, { cause: error })
    }
  }
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function normalizeRepositoryUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function contributorId(name: string, email: string): string {
  const identity = `${name.trim().toLocaleLowerCase('en-US')}\0${email.trim().toLocaleLowerCase('en-US')}`
  return `git:${createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 20)}`
}

export function parseGitLog(output: string, repositoryUrl: string): ParsedLocalCommit[] {
  const baseUrl = normalizeRepositoryUrl(repositoryUrl)
  const records = output
    .split('\0\0')
    .map(record => record.replace(/^[\r\n]+|[\r\n]+$/g, ''))
    .filter(Boolean)

  return records.map((record) => {
    const fields = record.split('\0')
    if (fields.length !== 5)
      throw new Error(`Unable to parse local Git metadata record with ${fields.length} fields.`)

    const [sha, authorName, authorEmail, date, message] = fields
    if (!/^[a-f0-9]{40}$/.test(sha))
      throw new Error(`Unable to parse local Git metadata SHA: ${sha || '(empty)'}`)

    return {
      author: { name: authorName || 'Unknown author' },
      authorEmail,
      date,
      message: message || '(no commit message)',
      sha,
      shortSha: sha.slice(0, 7),
      url: `${baseUrl}/commit/${sha}`,
    }
  })
}

function createContributors(commits: ParsedLocalCommit[]): LocalContributor[] {
  const contributors = new Map<string, LocalContributor>()
  for (const commit of commits) {
    const id = contributorId(commit.author.name, commit.authorEmail)
    const current = contributors.get(id)
    if (current)
      current.contributions += 1
    else
      contributors.set(id, { contributions: 1, id, name: commit.author.name })
  }

  return [...contributors.values()].sort((left, right) => (
    right.contributions - left.contributions
    || compareText(left.name, right.name)
    || compareText(left.id, right.id)
  ))
}

function stripPrivateCommitFields(commit: ParsedLocalCommit): LocalCommit {
  const { authorEmail: _authorEmail, ...publicCommit } = commit
  return publicCommit
}

export function createLocalMetadata(options: CreateLocalMetadataOptions): LocalMetadataSnapshot {
  const runGit = options.runGit ?? createGitRunner(options.repositoryRoot)
  const shallow = runGit(['rev-parse', '--is-shallow-repository']).trim()
  if (shallow === 'true') {
    throw new Error('Local Git metadata requires complete history. Run "git fetch --unshallow" before syncing.')
  }
  if (shallow !== 'false')
    throw new Error(`Unable to determine whether the repository is shallow: ${shallow || '(empty)'}`)

  const headSha = runGit(['rev-parse', '--verify', `refs/heads/${options.defaultBranch}^{commit}`]).trim()
  if (!/^[a-f0-9]{40}$/.test(headSha))
    throw new Error(`Unable to resolve a full ${options.defaultBranch} commit SHA: ${headSha || '(empty)'}`)

  const components = Object.fromEntries(options.components.map((component) => {
    const path = normalizePath(component.path)
    const parsedCommits = parseGitLog(runGit([
      '--no-pager',
      'log',
      '--use-mailmap',
      '--no-show-signature',
      `--format=${GIT_LOG_FORMAT}`,
      headSha,
      '--',
      path,
    ]), options.repositoryUrl).sort((left, right) => (
      Date.parse(right.date) - Date.parse(left.date)
      || compareText(left.sha, right.sha)
    ))

    return [component.name, {
      commits: parsedCommits.map(stripPrivateCommitFields),
      contributors: createContributors(parsedCommits),
      path,
    }]
  }))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      defaultBranch: options.defaultBranch,
      headSha,
      url: normalizeRepositoryUrl(options.repositoryUrl),
    },
    components,
  }
}

export function writeLocalMetadata(options: WriteLocalMetadataOptions): void {
  assertLocalMetadataSnapshot(options.snapshot, options.expectation)
  mkdirSync(dirname(options.outputPath), { recursive: true })
  const temporaryPath = `${options.outputPath}.${process.pid}.${randomUUID()}.tmp`

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(options.snapshot, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, options.outputPath)
  }
  finally {
    rmSync(temporaryPath, { force: true })
  }
}
