import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { prepareLocalGitMetadata } from '../prepare-local-git-metadata.mjs'

function fixture(t, defaultBranch = 'main') {
  const root = mkdtempSync(join(tmpdir(), 'local-git-metadata-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  git(['init', '--initial-branch', defaultBranch])
  const commit = (content) => {
    writeFileSync(join(root, 'source.txt'), content)
    git(['add', 'source.txt'])
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', `core.hooksPath=${join(root, 'no-hooks')}`, 'commit', '--no-gpg-sign', '-m', content])
    return git(['rev-parse', 'HEAD'])
  }
  const defaultSha = commit('default-branch-content')
  git(['update-ref', `refs/remotes/origin/${defaultBranch}`, defaultSha])
  git(['checkout', '--detach'])
  const mergeSha = commit('pull-request-content')
  git(['branch', '-D', defaultBranch])
  return { root, git, defaultSha, mergeSha }
}

for (const defaultBranch of ['main', 'trunk/docs']) {
  test(`prepares detached checkout with default ${defaultBranch} without switching HEAD`, (t) => {
    const { root, git, defaultSha, mergeSha } = fixture(t, defaultBranch)
    assert.equal(git(['branch', '--show-current']), '')
    assert.throws(() => git(['symbolic-ref', 'refs/remotes/origin/HEAD']))
    prepareLocalGitMetadata(root, defaultBranch)
    prepareLocalGitMetadata(root, defaultBranch)
    assert.equal(git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']), `origin/${defaultBranch}`)
    assert.equal(git(['rev-parse', `refs/heads/${defaultBranch}`]), defaultSha)
    assert.equal(git(['rev-parse', 'HEAD']), mergeSha)
    assert.equal(git(['branch', '--show-current']), '')
    assert.equal(readFileSync(join(root, 'source.txt'), 'utf8'), 'pull-request-content')
    assert.equal(git(['status', '--porcelain']), '')
  })
}

test('preserves an existing local default branch', (t) => {
  const { root, git, mergeSha } = fixture(t)
  git(['branch', 'main', mergeSha])
  prepareLocalGitMetadata(root, 'main')
  assert.equal(git(['rev-parse', 'refs/heads/main']), mergeSha)
})

test('rejects a missing remote default branch without creating refs', (t) => {
  const { root, git } = fixture(t)
  const refs = git(['show-ref'])
  assert.throws(() => prepareLocalGitMetadata(root, 'missing'))
  assert.equal(git(['show-ref']), refs)
  assert.throws(() => git(['symbolic-ref', 'refs/remotes/origin/HEAD']))
})

test('rejects missing and invalid default branches without changing refs', (t) => {
  const { root, git } = fixture(t)
  const refs = git(['show-ref'])
  for (const branch of [undefined, '', ' main', 'main ', 'bad branch', '../main', 'main\nother', 'main.lock'])
    assert.throws(() => prepareLocalGitMetadata(root, branch))
  assert.equal(git(['show-ref']), refs)
  assert.throws(() => git(['symbolic-ref', 'refs/remotes/origin/HEAD']))
})

test('CLI reads the repository default branch from the environment', (t) => {
  const { root, git, defaultSha } = fixture(t, 'stable')
  execFileSync(process.execPath, [resolve(import.meta.dirname, '../prepare-local-git-metadata.mjs')], {
    cwd: root,
    env: { ...process.env, REPOSITORY_DEFAULT_BRANCH: 'stable' },
  })
  assert.equal(git(['rev-parse', 'refs/heads/stable']), defaultSha)
})
