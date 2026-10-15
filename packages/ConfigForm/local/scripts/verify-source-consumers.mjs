import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { openHttpProjectRepository } from '@moluoxixi/config-form-studio/client'
import { chromium, expect } from '@playwright/test'
// Verify the built public package, including the CLI used by the real MCP client.
// eslint-disable-next-line antfu/no-import-dist
import { startLocalWorkspace } from '../dist/index.js'
import { createEmployeeDirectory } from '../examples/employee-directory.mjs'

const pnpm = process.env.npm_execpath
if (!pnpm)
  throw new Error('Run with pnpm verify:source so the package manager is known.')
const directory = await mkdtemp(join(tmpdir(), 'config-form-source-consumer-'))
const service = await startLocalWorkspace({ directory: join(directory, 'workspace'), port: 0 })
const client = new Client({ name: 'source-consumer-verifier', version: '1' })
const browser = await chromium.launch()
const repository = await openHttpProjectRepository({ url: service.url })
const results = []

async function call(name, input) {
  const result = await client.callTool({ name, arguments: input })
  assert.equal(result.isError, undefined, JSON.stringify(result.content))
  return JSON.parse(result.content[0].text)
}
async function run(args, cwd) {
  await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [pnpm, ...args], { cwd, stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? accept() : reject(new Error(`pnpm ${args.join(' ')} failed: ${code}`)))
  })
}
async function serve(output) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname
      const target = resolve(output, `.${path === '/' ? '/index.html' : decodeURIComponent(path)}`)
      const local = relative(output, target)
      assert(!isAbsolute(local) && !local.startsWith('..'))
      response.setHeader('Content-Type', mime[extname(target)] ?? 'application/octet-stream')
      response.end(await readFile(target))
    }
    catch {
      response.writeHead(404).end()
    }
  })
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept)) }
}

try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(import.meta.dirname, '../dist/cli.js'), 'mcp', '--url', service.url], stderr: 'pipe' }))
  for (const preset of ['element-plus', 'antd-vue']) {
    const document = createEmployeeDirectory(preset)
    await call('create_project', { id: document.id, name: document.name, preset, surfaces: document.surfaceOrder.map(id => document.surfacesById[id]), datasets: document.datasetOrder.map(id => document.datasetsById[id]) })
    const saved = await repository.get(document.id)
    const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBpQAAAAASUVORK5CYII=', 'base64'))
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    saved.document.resources.logo = { id: 'logo', kind: 'embedded', name: 'Logo', fileName: 'logo.png', mediaType: 'image/png', contentHash: hash, byteLength: bytes.byteLength }
    const home = saved.document.surfacesById.home
    home.graph.nodesById.logo = { id: 'logo', kind: 'element', component: `${preset === 'element-plus' ? 'element' : 'antd'}.image`, props: { alt: 'Company logo' }, resourceBindings: { src: { resourceId: 'logo' } } }
    home.graph.root.push({ nodeId: 'logo', placement: { span: 24 } })
    await repository.commit({ id: document.id, expectedRepositoryRevision: 0, commandId: 'add-image', document: saved.document, metadata: { source: 'manual' }, embeddedWrites: [{ resourceId: 'logo', contentHash: hash, bytes }] })
    const artifact = await call('generate_source', { projectId: document.id, expectedRepositoryRevision: 1, styleTarget: preset === 'element-plus' ? 'tailwind-v4' : 'css' })
    const exported = await call('export_source', { artifactId: artifact.artifactId, format: 'directory', name: preset })
    const manifest = JSON.parse(await readFile(join(exported.directory, 'package.json'), 'utf8'))
    assert(Object.keys(manifest.dependencies).every(name => !name.includes('config-form')))
    // Fresh install outside the repository: no workspace links or reused node_modules.
    await run(['install', '--ignore-scripts'], exported.directory)
    await run(['build'], exported.directory)
    const host = await serve(join(exported.directory, 'dist'))
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(host.url)
      await expect(page.getByRole('row').filter({ hasText: '林晓' })).toBeVisible()
      await expect(page.getByRole('row').filter({ hasText: '王宁' })).toBeVisible()
      if (preset === 'element-plus')
        await page.locator('.el-switch').click()
      else
        await page.getByRole('switch').click()
      await expect(page.getByRole('row').filter({ hasText: '王宁' })).toHaveCount(0)
      await page.getByRole('row').filter({ hasText: '林晓' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: /^完\s*成$/ }).click()
      await expect(dialog.getByText('请输入员工姓名', { exact: true })).toBeVisible()
      await dialog.getByRole('textbox').fill('林晓')
      await dialog.getByRole('button', { name: /^完\s*成$/ }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('img', { name: 'Company logo', exact: true })).toBeVisible()
      assert(await page.getByRole('img', { name: 'Company logo', exact: true }).evaluate(image => image.complete && image.naturalWidth > 0))
      await page.screenshot({ path: join(directory, `${preset}-desktop.png`) })
      await page.setViewportSize({ width: 390, height: 844 })
      // Provider wave animations may still retain the previous viewport's geometry.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
      await page.screenshot({ path: join(directory, `${preset}-mobile.png`) })
      assert.deepEqual(errors, [])
      results.push({ preset, directory: exported.directory, artifactId: artifact.artifactId, checks: ['fresh-install', 'typecheck', 'build', 'filter', 'row-dialog', 'validation', 'close', 'embedded-image', 'mobile'] })
    }
    finally {
      await page.close()
      await host.close()
    }
  }
  await writeFile(join(directory, 'verification.json'), JSON.stringify(results, null, 2))
  process.stdout.write(`Source consumers passed. Reviewable apps and screenshots: ${directory}\n`)
}
finally {
  repository.close()
  await browser.close()
  await client.close()
  await service.close()
}
