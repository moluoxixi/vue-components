import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowDirectory = resolve(import.meta.dirname, '../../.github/workflows')
const ciWorkflow = readFileSync(resolve(workflowDirectory, 'ci.yml'), 'utf8')
const pagesWorkflow = readFileSync(resolve(workflowDirectory, 'pages.yml'), 'utf8')
const releaseWorkflow = readFileSync(resolve(workflowDirectory, 'release.yml'), 'utf8')
const workflowValidator = readFileSync(resolve(import.meta.dirname, '../validate-workflows.mjs'), 'utf8')

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
    expect(ciWorkflow).toContain('playwright install --with-deps chromium')
    expect(ciWorkflow).toContain('pnpm test:pack:browser')
    expect(ciWorkflow).toContain('pnpm -C packages/ConfigForm/playground test:e2e')
    expect(ciWorkflow).toContain('pnpm -C playgrounds/components-playground test:e2e')
    expect(ciWorkflow).toContain('if: failure()')
    expect(ciWorkflow).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02')
    expect(ciWorkflow).toContain('packages/ConfigForm/playground/dist/playwright-report/config-form-playground')
    expect(ciWorkflow).toContain('playgrounds/components-playground/dist/test-results/components-playground')
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
    expect(releaseWorkflow).toMatch(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/)
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
