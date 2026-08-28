import type { Page } from '@playwright/test'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

type StubMode = 'invalid' | 'slow' | 'success'

const packageRoot = resolve(import.meta.dirname, '..')
let projectRoot: string
let cliProcess: ChildProcessWithoutNullStreams
let cliUrl: string
let stubMode: StubMode = 'success'
let stubRequestStarted = false
let stubRequestAborted = false
let closeStub: () => Promise<void>
const browserProblems = new WeakMap<Page, string[]>()

async function listen(server = createServer()): Promise<{ close: () => Promise<void>, port: number }> {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const port = (server.address() as AddressInfo).port
  return {
    close: () => new Promise<void>((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose())
    }),
    port,
  }
}

async function availablePort(): Promise<number> {
  const server = createServer()
  const listening = await listen(server)
  await listening.close()
  return listening.port
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/__i18n-tool/api/config`)).ok)
        return
    }
    catch {
      // Server is still starting.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
  }
  throw new Error(`i18n-tool CLI did not start at ${url}`)
}

async function resetProject(): Promise<void> {
  stubMode = 'success'
  stubRequestStarted = false
  stubRequestAborted = false
  await mkdir(resolve(projectRoot, 'locales'), { recursive: true })
  await writeFile(resolve(projectRoot, 'locales/en-US.json'), `${JSON.stringify({
    common: {
      hello: 'Hello {name}',
      plain: 'Plain text',
    },
  }, null, 2)}\n`)
  await unlink(resolve(projectRoot, 'locales/zh-CN.json')).catch(() => {})
}

test.beforeAll(async () => {
  projectRoot = await mkdtemp(resolve(tmpdir(), 'i18n-tool-e2e-'))
  const stub = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404).end()
      return
    }
    stubRequestStarted = true
    request.once('aborted', () => {
      stubRequestAborted = true
    })
    response.once('close', () => {
      if (!response.writableEnded)
        stubRequestAborted = true
    })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.flushHeaders()
    if (stubMode === 'slow')
      return

    const chunks: Buffer[] = []
    for await (const chunk of request)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const translationRequest = JSON.parse(payload.messages[1].content)
    const translations = translationRequest.entries.map((entry: { id: string, source: string }) => ({
      id: entry.id,
      value: stubMode === 'invalid'
        ? 'Broken {unexpected}'
        : entry.source === 'Plain text' ? '普通文本' : '你好 {name}',
    }))
    const content = JSON.stringify({ targetLocale: translationRequest.targetLocale, translations })
    response.end(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content, role: 'assistant' } }],
      id: 'chatcmpl-i18n-tool-e2e',
      model: 'stub-model',
      usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
    }))
  })
  const stubListening = await listen(stub)
  closeStub = stubListening.close
  const cliPort = await availablePort()
  await writeFile(resolve(projectRoot, 'i18n-tool.config.mjs'), `
export default {
  ai: {
    apiKeyEnv: 'I18N_TOOL_E2E_API_KEY',
    baseUrl: 'http://127.0.0.1:${stubListening.port}/v1',
    model: 'stub-model',
    provider: 'openai-compatible',
  },
  resources: {
    adapter: 'vue-i18n-json',
    include: ['locales/**/*.json'],
    keyStyle: 'nested',
    layout: 'locale-per-file',
    localePattern: 'locales/{locale}.json',
    sourceLocale: 'en-US',
    targetLocales: ['zh-CN'],
  },
  server: { host: '127.0.0.1', open: false, port: ${cliPort} },
}
`)
  cliUrl = `http://127.0.0.1:${cliPort}`
  cliProcess = spawn(process.execPath, [
    resolve(packageRoot, 'dist/cli.js'),
    '--config',
    resolve(projectRoot, 'i18n-tool.config.mjs'),
  ], {
    cwd: packageRoot,
    env: { ...process.env, I18N_TOOL_E2E_API_KEY: 'e2e-secret' },
    stdio: 'pipe',
  })
  await waitForServer(cliUrl)
})

test.afterAll(async () => {
  cliProcess?.kill()
  await closeStub?.()
  await rm(projectRoot, { force: true, recursive: true })
})

test.beforeEach(async ({ page }) => {
  const problems: string[] = []
  browserProblems.set(page, problems)
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error')
      problems.push(`console: ${message.text()}`)
  })
  await resetProject()
  await page.goto(cliUrl)
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([])
})

async function translateAndPreview(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Translate' }).click()
  await page.getByRole('button', { name: /Translate 2/ }).click()
  await expect(page.locator('textarea').first()).toHaveValue('你好 {name}')
  await page.getByRole('button', { name: 'Preview changes' }).click()
  await expect(page.getByRole('heading', { name: 'Changes' })).toBeVisible()
  await expect(page.getByText('locales/zh-CN.json').first()).toBeVisible()
}

test('creates a target locale file through the reviewed workflow', async ({ page }, testInfo) => {
  await translateAndPreview(page)
  await page.screenshot({ fullPage: true, path: testInfo.outputPath('changes-workbench.png') })
  const applyButton = page.getByRole('button', { name: 'Apply changes' })
  await applyButton.click()
  const dialog = page.getByRole('dialog', { name: 'Write locale files?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(applyButton).toBeFocused()
  await applyButton.click()
  await page.getByRole('button', { name: 'Confirm write' }).click()
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
  await expect(page.getByText('Locale files updated')).toBeVisible()

  const target = JSON.parse(await readFile(resolve(projectRoot, 'locales/zh-CN.json'), 'utf8'))
  expect(target).toEqual({ common: { hello: '你好 {name}', plain: '普通文本' } })
})

test('requires explicit overwrite review and confirmation', async ({ page }) => {
  await writeFile(resolve(projectRoot, 'locales/zh-CN.json'), `${JSON.stringify({
    common: {
      hello: '旧译文 {name}',
      plain: '旧普通文本',
    },
  }, null, 2)}\n`)
  await page.getByRole('button', { name: 'Rescan locale resources' }).click()
  await page.getByRole('tab', { name: 'Translate' }).click()
  await expect(page.getByRole('button', { name: /Translate 0/ })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Select common.hello' }).check()
  await page.getByRole('button', { name: /Translate 1/ }).click()
  await expect(page.getByRole('textbox', { name: 'Candidate translation for common.hello' })).toHaveValue('你好 {name}')
  await page.getByRole('checkbox', { name: 'Allow overwrite' }).check()
  await page.getByRole('button', { name: 'Preview changes' }).click()
  await expect(page.getByText('overwrite', { exact: true })).toBeVisible()
  await expect(page.getByText('/common/hello', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Apply changes' }).click()
  await expect(page.getByText('1 existing translations will be overwritten.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm write' }).click()
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
  const target = JSON.parse(await readFile(resolve(projectRoot, 'locales/zh-CN.json'), 'utf8'))
  expect(target).toEqual({ common: { hello: '你好 {name}', plain: '旧普通文本' } })
})

test('preserves an external edit when apply detects a stale preview', async ({ page }) => {
  await translateAndPreview(page)
  const external = '{"external":"keep"}\n'
  await writeFile(resolve(projectRoot, 'locales/zh-CN.json'), external)
  await page.getByRole('button', { name: 'Apply changes' }).click()
  await page.getByRole('button', { name: 'Confirm write' }).click()

  await expect(page.getByText('A locale resource changed after preview.')).toBeVisible()
  const problems = browserProblems.get(page) ?? []
  const conflictLog = problems.find(problem => problem.includes('409 (Conflict)'))
  expect(conflictLog).toBeDefined()
  browserProblems.set(page, problems.filter(problem => problem !== conflictLog))
  await expect(page.getByRole('tab', { name: 'Translate' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Changes' })).toBeDisabled()
  expect(await readFile(resolve(projectRoot, 'locales/zh-CN.json'), 'utf8')).toBe(external)
})

test('blocks invalid model output and supports cancellation', async ({ page }) => {
  stubMode = 'invalid'
  await page.getByRole('tab', { name: 'Translate' }).click()
  await page.getByRole('button', { name: /Translate 2/ }).click()
  await expect(page.getByRole('alert')).toContainText('TOKEN_MISMATCH')
  await expect(page.getByRole('button', { name: 'Preview changes' })).toBeDisabled()

  stubMode = 'slow'
  stubRequestStarted = false
  stubRequestAborted = false
  await page.getByRole('button', { name: /Translate 2/ }).click()
  await expect.poll(() => stubRequestStarted).toBe(true)
  await page.getByRole('button', { name: 'Stop active translation' }).click()
  await expect(page.getByText('Translation stopped')).toBeVisible()
  await expect.poll(() => stubRequestAborted).toBe(true)
})

test('mobile layout keeps commands reachable and tabs keyboard accessible', async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.reload()
  const resourcesTab = page.getByRole('tab', { name: 'Resources' })
  await resourcesTab.focus()
  await page.keyboard.press('ArrowRight')
  const translateTab = page.getByRole('tab', { name: 'Translate' })
  await expect(translateTab).toHaveAttribute('aria-selected', 'true')
  await expect(translateTab).toHaveAttribute('aria-controls', 'panel-translate')
  await expect(page.locator('#panel-translate')).toBeVisible()
  await expect(page.locator('#panel-resources')).toBeHidden()
  await expect(page.getByRole('button', { name: /Translate 2/ })).toBeVisible()
  await page.getByRole('button', { name: /Translate 2/ }).click()
  await expect(page.getByRole('textbox', { name: 'Candidate translation for common.hello' })).toHaveValue('你好 {name}')
  await page.getByRole('button', { name: 'Preview changes' }).click()
  const diff = page.getByLabel('Diff for locales/zh-CN.json')
  await expect(diff).toBeVisible()
  const bounds = await diff.boundingBox()
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document: document.documentElement.scrollWidth - window.innerWidth,
  }))
  expect(overflow).toEqual({ body: 0, document: 0 })
  await page.getByRole('button', { name: 'Apply changes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Write locale files?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.screenshot({ fullPage: true, path: testInfo.outputPath('mobile-workbench.png') })

  await page.setViewportSize({ height: 900, width: 768 })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0)
})
