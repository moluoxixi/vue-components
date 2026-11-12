import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
// Bootstrap diagnostics must run before third-party dependencies are installed.
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { inspectLocalGitMetadata } from '../inspect-local-git-metadata.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'inspect-git-metadata-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  git(['init', '--initial-branch=trunk'])
  writeFileSync(join(root, 'content.txt'), 'unchanged')
  git(['add', 'content.txt'])
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', `core.hooksPath=${join(root, 'no-hooks')}`, 'commit', '--no-gpg-sign', '-m', 'fixture'])
  const head = git(['rev-parse', 'HEAD'])
  git(['update-ref', 'refs/remotes/origin/trunk', head])
  git(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk'])
  const nested = join(root, 'fixtures', 'consumer')
  mkdirSync(nested, { recursive: true })
  return { root, nested, git, head }
}

test('reports the same repository from root and nested directories without changing Git state', (t) => {
  const { root, nested, git, head } = fixture(t)
  const refs = git(['show-ref'])
  const index = readFileSync(join(root, '.git', 'index'))
  const config = readFileSync(join(root, '.git', 'config'))
  const state = inspectLocalGitMetadata(root)
  assert.equal(state.root, root)
  assert.equal(state.gitDirectory, join(root, '.git'))
  assert.equal(state.isShallow, 'false')
  assert.deepEqual(state.shallowBoundaries, [])
  assert.equal(state.head, head)
  assert.equal(state.defaultRef, 'refs/remotes/origin/trunk')
  assert.equal(state.defaultSha, head)
  assert.deepEqual(inspectLocalGitMetadata(nested), { ...state, directory: nested })
  assert.equal(git(['show-ref']), refs)
  assert.deepEqual(readFileSync(join(root, '.git', 'index')), index)
  assert.deepEqual(readFileSync(join(root, '.git', 'config')), config)
  assert.equal(readFileSync(join(root, 'content.txt'), 'utf8'), 'unchanged')
})

test('reports shallow boundaries without removing or changing them', (t) => {
  const { root, head } = fixture(t)
  const shallowPath = join(root, '.git', 'shallow')
  writeFileSync(shallowPath, `${head}\n`)
  const state = inspectLocalGitMetadata(root)
  assert.equal(state.isShallow, 'true')
  assert.deepEqual(state.shallowBoundaries, [head])
  assert.equal(readFileSync(shallowPath, 'utf8'), `${head}\n`)
})

test('reports an absent remote HEAD without creating it', (t) => {
  const { root, git } = fixture(t)
  git(['symbolic-ref', '--delete', 'refs/remotes/origin/HEAD'])
  assert.equal(inspectLocalGitMetadata(root).defaultRef, null)
  assert.equal(inspectLocalGitMetadata(root).defaultSha, null)
  const configured = inspectLocalGitMetadata(root, 'trunk')
  assert.equal(configured.defaultRef, 'refs/remotes/origin/trunk')
  assert.equal(configured.defaultSha, git(['rev-parse', 'refs/remotes/origin/trunk']))
  assert.equal(configured.originHead, null)
  assert.throws(() => git(['symbolic-ref', 'refs/remotes/origin/HEAD']))
})

test('CLI emits one diagnostic per supplied working directory', (t) => {
  const { root, nested } = fixture(t)
  const output = execFileSync(process.execPath, [resolve(import.meta.dirname, '../inspect-local-git-metadata.mjs'), root, nested], { encoding: 'utf8' })
  const reports = output.trim().split('\n').map(line => JSON.parse(line))
  assert.deepEqual(reports.map(report => report.directory), [root, nested])
  assert.equal(reports[0].head, reports[1].head)
})
