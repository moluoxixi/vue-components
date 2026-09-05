import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowDirectory = resolve(import.meta.dirname, '../../.github/workflows')
const ciWorkflow = readFileSync(resolve(workflowDirectory, 'ci.yml'), 'utf8')
const pagesWorkflow = readFileSync(resolve(workflowDirectory, 'pages.yml'), 'utf8')
const releaseWorkflow = readFileSync(resolve(workflowDirectory, 'release.yml'), 'utf8')
const pnpmLockfile = readFileSync(resolve(import.meta.dirname, '../../pnpm-lock.yaml'), 'utf8')
const workflowValidator = readFileSync(resolve(import.meta.dirname, '../validate-workflows.mjs'), 'utf8')
const rootManifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'))
const githubTokenEnvironment = ['GITHUB_TOKEN: $', '{{ github.token }}'].join('')
const aiDocAssistantManifest = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../packages/ai-doc-assistant/package.json'),
  'utf8',
))
const viteConfigManifest = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../packages/vite-config/package.json'),
  'utf8',
))

describe('release workflow topology', () => {
  it('keeps CI, Pages, and package publishing in separate workflows', () => {
    expect(ciWorkflow).toContain('name: CI')
    expect(ciWorkflow).not.toContain('changeset publish')
    expect(ciWorkflow).not.toContain('Deploy GitHub Pages')
    expect(pagesWorkflow).toContain('name: Pages')
    expect(releaseWorkflow).toContain('name: Release packages')
  })

  it('runs core browser suites for pull requests, main, and nightly with diagnostics', () => {
    expect(ciWorkflow).toContain('cron: \'0 18 * * *\'')
    expect(ciWorkflow).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
    expect(ciWorkflow).toContain('name: Browser tests')
    const playwrightImage = ciWorkflow.match(/mcr\.microsoft\.com\/playwright:v([^@]+)-noble@sha256:([a-f0-9]{64})/)
    expect(playwrightImage?.[1]).toBe('1.60.0')
    expect(playwrightImage?.[2]).toBe('83192064c7510f7ee73dd63dc5f22a5e01a92c81a2e6a9c715d9e3fe55471fd9')
    expect(pnpmLockfile).toContain(`'@playwright/test@${playwrightImage?.[1]}':`)
    expect(ciWorkflow).toContain('options: --ipc=host')
    expect(ciWorkflow).toContain('timeout-minutes: 30')
    expect(ciWorkflow).not.toContain('playwright install --with-deps chromium')
    expect(ciWorkflow).toContain('pnpm test:pack:browser')
    expect(ciWorkflow).toContain('pnpm -C packages/ConfigForm/playground test:e2e')
    expect(ciWorkflow).toContain('pnpm -C playgrounds/components-playground test:e2e')
    expect(ciWorkflow).toContain('if: failure()')
    expect(ciWorkflow).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02')
    expect(ciWorkflow).toContain('packages/ConfigForm/playground/dist/playwright-report/config-form-playground')
    expect(ciWorkflow).toContain('playgrounds/components-playground/dist/test-results/components-playground')
    expect(ciWorkflow).toContain('packages/ai-doc-assistant/.playwright/report')
    expect(ciWorkflow).toContain('packages/ai-doc-assistant/.playwright/test-results')
    expect(ciWorkflow).not.toContain('packages/ai-doc-assistant/dist/playwright-report/ai-doc-assistant')
    expect(ciWorkflow).not.toContain('packages/ai-doc-assistant/dist/test-results/ai-doc-assistant')
  })

  it('synchronizes only production GitHub metadata during documentation builds', () => {
    expect(ciWorkflow).not.toContain('validate-repository-metadata')
    expect(ciWorkflow).toContain(githubTokenEnvironment)
    expect(ciWorkflow).toContain('issues: read')
    expect(pagesWorkflow).toContain(githubTokenEnvironment)
    expect(pagesWorkflow).toContain('issues: read')
    expect(releaseWorkflow).not.toContain('sync-github-metadata')
    expect(releaseWorkflow).not.toContain('build:docs')
    expect(rootManifest.scripts.release).not.toContain('build:docs')
  })

  it('checks out complete history before running local Git metadata consumers', () => {
    expect(ciWorkflow).toMatch(/verify:[\s\S]*?- name: Checkout[\s\S]*?fetch-depth: 0[\s\S]*?- name: Setup pnpm/)
  })

  it('limits concurrency around resource-heavy integration tests', () => {
    expect(rootManifest.scripts.test).toContain('--concurrency=2')
    expect(rootManifest.scripts.test).toContain('--filter=!@moluoxixi/vite-config')
    expect(rootManifest.scripts.test).toContain('turbo run test --filter=@moluoxixi/vite-config --concurrency=1')
    expect(aiDocAssistantManifest.scripts.test).toContain('--no-file-parallelism --maxWorkers=1')
    expect(viteConfigManifest.scripts.test).toContain('--no-file-parallelism --maxWorkers=1')
    expect(rootManifest.scripts['test:coverage']).toContain('--concurrency=2')
    expect(rootManifest.scripts['test:coverage']).toContain('turbo run test:coverage --filter=@moluoxixi/vite-config --concurrency=1')
    expect(aiDocAssistantManifest.scripts['test:coverage']).toContain('--no-file-parallelism --maxWorkers=1')
    expect(viteConfigManifest.scripts['test:coverage']).toContain('--no-file-parallelism --maxWorkers=1')
  })

  it('runs a pinned official actionlint binary after checksum verification', () => {
    expect(workflowValidator).toContain('const actionlintVersion = \'1.7.12\'')
    expect(workflowValidator).toContain('github.com/rhysd/actionlint/releases/download')
    expect(workflowValidator).toContain('createHash(\'sha256\')')
    expect(workflowValidator).toContain('8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8')
    expect(workflowValidator).toContain('run(actionlint, workflowFiles.map')
  })

  it('starts release only after a successful main push CI run', () => {
    expect(releaseWorkflow).toContain('workflow_run:')
    expect(releaseWorkflow).toContain('- CI')
    expect(releaseWorkflow).toContain('github.event.workflow_run.conclusion == \'success\'')
    expect(releaseWorkflow).toContain('github.event.workflow_run.event == \'push\'')
    expect(releaseWorkflow).toContain('github.event.workflow_run.head_branch == \'main\'')
    expect(releaseWorkflow).toContain('id: freshness')
    expect(releaseWorkflow).toContain('contents: write')
    expect(releaseWorkflow).toContain('id-token: write')
    expect(releaseWorkflow).toContain('NPM_CONFIG_PROVENANCE: true')
    expect(releaseWorkflow).not.toMatch(/(?:NPM_TOKEN|NODE_AUTH_TOKEN): \$\{\{ secrets\.NPM_TOKEN \}\}/)
  })

  it('skips a stale Pages deployment while allowing release-only commits', () => {
    expect(pagesWorkflow).toContain('github.event.workflow_run.conclusion == \'success\'')
    expect(pagesWorkflow).toContain('github.event.workflow_run.event == \'push\'')
    expect(pagesWorkflow).toContain('github.event.workflow_run.head_branch == \'main\'')
    expect(pagesWorkflow).toContain('id: freshness')
    expect(pagesWorkflow).toContain('grep -v \'\\[skip ci\\]\'')
    expect(pagesWorkflow).toContain('if: needs.build-pages.outputs.deploy == \'true\'')
  })

  it('versions and publishes changed packages without a release PR', () => {
    const orderedSteps = [
      '- name: Create patch changesets for changed packages',
      '- name: Version packages',
      '- name: Commit release metadata',
      '- name: Publish packages',
      '- name: Push release tags',
    ]

    let previousIndex = -1
    for (const step of orderedSteps) {
      const currentIndex = releaseWorkflow.indexOf(step)
      expect(currentIndex).toBeGreaterThan(previousIndex)
      previousIndex = currentIndex
    }

    expect(releaseWorkflow).not.toContain('changesets/action')
  })
})
