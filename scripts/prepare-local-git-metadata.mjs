import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** Supply the branch refs omitted by a detached Actions checkout without changing its HEAD. */
export function prepareLocalGitMetadata(repositoryRoot, defaultBranch) {
  if (typeof defaultBranch !== 'string' || !defaultBranch || defaultBranch !== defaultBranch.trim())
    throw new Error('A repository default branch is required')

  const git = args => execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
  const localRef = `refs/heads/${defaultBranch}`
  const remoteRef = `refs/remotes/origin/${defaultBranch}`
  git(['check-ref-format', localRef])
  // Resolve the exact remote ref before making any changes. Never guess a branch or use the PR merge commit.
  const defaultSha = git(['rev-parse', '--verify', `${remoteRef}^{commit}`])
  const local = spawnSync('git', ['-C', repositoryRoot, 'show-ref', '--verify', '--quiet', localRef], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (local.error)
    throw local.error
  if (local.status === 1)
    git(['update-ref', localRef, defaultSha, '0'.repeat(defaultSha.length)])
  else if (local.status !== 0)
    throw new Error(`Unable to inspect ${localRef}: ${local.stderr.trim()}`)

  git(['symbolic-ref', 'refs/remotes/origin/HEAD', remoteRef])
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  prepareLocalGitMetadata(process.cwd(), process.env.REPOSITORY_DEFAULT_BRANCH)
