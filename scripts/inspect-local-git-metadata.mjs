import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export function inspectLocalGitMetadata(directory, defaultBranch) {
  const git = args => execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
  const optionalGit = (args) => {
    try {
      return git(args)
    }
    catch {
      return null
    }
  }
  const root = git(['rev-parse', '--show-toplevel'])
  const gitDirectory = git(['rev-parse', '--absolute-git-dir'])
  const shallowPath = git(['rev-parse', '--path-format=absolute', '--git-path', 'shallow'])
  let shallowBoundaries = []
  try {
    shallowBoundaries = readFileSync(shallowPath, 'utf8').trim().split(/\s+/).filter(Boolean)
    if (shallowBoundaries.some(sha => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)))
      throw new Error('Git shallow file contains an invalid commit ID')
  }
  catch (error) {
    if (error.code !== 'ENOENT')
      throw error
  }
  const originHead = optionalGit(['symbolic-ref', 'refs/remotes/origin/HEAD'])
  if (defaultBranch)
    git(['check-ref-format', `refs/heads/${defaultBranch}`])
  const defaultRef = defaultBranch ? `refs/remotes/origin/${defaultBranch}` : originHead
  return {
    directory: resolve(directory),
    root,
    gitDirectory,
    isShallow: git(['rev-parse', '--is-shallow-repository']),
    shallowBoundaries,
    head: git(['rev-parse', '--verify', 'HEAD^{commit}']),
    originHead,
    defaultRef,
    defaultSha: defaultRef ? optionalGit(['rev-parse', '--verify', `${defaultRef}^{commit}`]) : null,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const directories = process.argv.slice(2)
  for (const directory of directories.length ? directories : [process.cwd()])
    process.stdout.write(`${JSON.stringify(inspectLocalGitMetadata(directory, process.env.REPOSITORY_DEFAULT_BRANCH))}\n`)
}
