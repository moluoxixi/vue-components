import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium, expect } from '@playwright/test'
import { createNodeSmokeSource, createPnpmInvocation, createTypeSmokeSource } from '../../../scripts/published-package-verifier.mjs'

const packageRoot = resolve(import.meta.dirname, '..')
const require = createRequire(join(packageRoot, 'package.json'))
const requested = process.argv.find(argument => argument.startsWith('--version='))?.slice('--version='.length)
const versions = requested ? [requested] : ['3.29.0', '3.29.2', '3.31.3']
if (versions.some(version => !/^3\.\d+\.\d+$/.test(version)))
  throw new Error('Expected an explicit Tiptap 3.x.y version.')
const report = resolve(packageRoot, '.playwright/consumer-report')
await mkdir(report, { recursive: true })
const invocation = createPnpmInvocation(process.platform, process.execPath, process.env.npm_execpath)
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false, windowsHide: true })
  if (result.status !== 0)
    throw new Error([result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n'))
  return result.stdout
}
const pnpm = (args, cwd = packageRoot) => run(invocation.command, [...invocation.argsPrefix, ...args], cwd)
const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
const tiptapPackages = new Set()
function readManifest(name, from) {
  let directory = dirname(from.resolve(name === '@tiptap/pm' ? '@tiptap/pm/state' : name))
  while (true) {
    const filename = join(directory, 'package.json')
    if (existsSync(filename)) {
      const value = JSON.parse(readFileSync(filename, 'utf8'))
      if (value.name === name)
        return { filename, value }
    }
    const parent = dirname(directory)
    if (parent === directory)
      throw new Error(`Cannot locate installed package manifest: ${name}`)
    directory = parent
  }
}
function collectTiptap(name, from = require) {
  if (tiptapPackages.has(name))
    return
  tiptapPackages.add(name)
  const { filename, value: current } = readManifest(name, from)
  const relative = createRequire(filename)
  for (const dependency of Object.keys(current.dependencies ?? {})) {
    if (dependency.startsWith('@tiptap/'))
      collectTiptap(dependency, relative)
  }
}
for (const name of Object.keys(manifest.peerDependencies).filter(name => name.startsWith('@tiptap/')))
  collectTiptap(name)
const scratch = await mkdtemp(join(tmpdir(), 'rich-text-consumer-'))
const packed = JSON.parse(pnpm(['pack', '--pack-destination', scratch, '--json']))
const tarball = resolve(scratch, packed.filename ?? packed[0]?.filename)
if (!existsSync(tarball))
  throw new Error('Package tarball was not created.')

const results = []
for (const version of versions) {
  const consumer = join(scratch, version)
  await cp(join(packageRoot, 'fixtures/consumer'), consumer, { recursive: true })
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      [manifest.name]: `file:${tarball.replaceAll('\\', '/')}`,
      vue: '3.5.33',
      ...Object.fromEntries([...tiptapPackages].map(name => [name, version])),
    },
    devDependencies: { typescript: '5.9.3', vite: '6.4.2' },
    pnpm: { overrides: Object.fromEntries([...tiptapPackages].map(name => [name, version])) },
  }, null, 2))
  await writeFile(join(consumer, 'pnpm-workspace.yaml'), 'packages: []\n')
  console.log(`Installing Tiptap ${version} with the packed editor...`)
  pnpm(['install', '--ignore-scripts', '--strict-peer-dependencies'], consumer)
  await cp(join(consumer, 'pnpm-lock.yaml'), join(report, `lock-${version}.yaml`))
  await writeFile(join(consumer, 'node-smoke.mjs'), `${createNodeSmokeSource([manifest.name], [manifest.name])}\n`
  + `import { createSSRApp, h } from 'vue';\nimport { renderToString } from 'vue/server-renderer';\nimport { RichTextEditor } from '${manifest.name}';\nconst html = await renderToString(createSSRApp({render:()=>h(RichTextEditor)}));\nif (!html.includes('mx-rich-text-editor')) throw new Error('SSR failed');\n`)
  run(process.execPath, [join(consumer, 'node-smoke.mjs')], consumer)
  await writeFile(join(consumer, 'type-smoke.ts'), createTypeSmokeSource([manifest.name]))
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, lib: ['ES2022', 'DOM'], skipLibCheck: false },
    files: ['type-contract.ts', 'type-smoke.ts'],
  }))
  pnpm(['exec', 'tsc', '-p', 'tsconfig.json'], consumer)
  const installed = createRequire(join(consumer, 'package.json'))
  for (const name of tiptapPackages) {
    const { value: dependency } = readManifest(name, installed)
    if (dependency.version !== version)
      throw new Error(`Mixed Tiptap version: ${name}@${dependency.version}`)
  }
  const vite = await import(pathToFileURL(installed.resolve('vite')).href)
  await vite.build({ root: consumer, configFile: false, logLevel: 'warn' })
  const server = await vite.preview({ root: consumer, configFile: false, logLevel: 'warn', preview: { host: '127.0.0.1', port: 0 } })
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const address = server.httpServer.address()
    const url = `http://127.0.0.1:${address.port}`
    for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(url)
      const textbox = page.getByRole('textbox', { name: '文章内容', exact: true })
      const bold = page.getByRole('button', { name: '粗体', exact: true })
      await expect(textbox).toBeVisible()
      await expect(bold).toHaveCSS('width', '30px')
      await expect(bold).toHaveCSS('height', '30px')
      await expect(textbox).toHaveCSS('min-height', '240px')
      await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled()
      await textbox.click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText('Production editor')
      await page.keyboard.press('ControlOrMeta+A')
      await bold.click()
      await expect(page.getByTestId('html')).toContainText('<strong>Production editor</strong>')
      await expect(bold).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: '链接', exact: true }).click()
      const link = page.getByRole('textbox', { name: '链接地址', exact: true })
      await expect(link).toBeFocused()
      await link.fill('javascript:alert(1)')
      await link.press('Enter')
      await expect(page.getByRole('alert')).toBeVisible()
      const linkAccessibility = await new AxeBuilder({ page }).include('.mx-rich-text-editor').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(linkAccessibility.violations).toEqual([])
      await link.fill('example.com')
      await link.press('Enter')
      await expect(link).toHaveCount(0)
      await expect(page.getByTestId('html')).toContainText('href="https://example.com"')
      expect(await page.evaluate(() => window.richTextFixture.submits.value)).toBe(0)
      await page.getByRole('button', { name: '链接', exact: true }).click()
      await link.press('Escape')
      await expect(page.getByRole('button', { name: '链接', exact: true })).toBeFocused()
      await page.getByLabel('禁用', { exact: true }).check()
      await expect(textbox).toHaveAttribute('contenteditable', 'false')
      await expect(bold).toBeDisabled()
      expect(await page.evaluate(() => window.richTextFixture.editor.value.commands.toggleBold())).toBe(false)
      await page.getByLabel('禁用', { exact: true }).uncheck()
      await expect(bold).toBeEnabled()
      await page.getByLabel('只读', { exact: true }).check()
      await expect(page.getByRole('toolbar')).toHaveCount(0)
      await page.getByLabel('只读', { exact: true }).uncheck()
      await expect(page.getByRole('toolbar')).toBeVisible()
      const accessibility = await new AxeBuilder({ page }).include('.mx-rich-text-editor').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(accessibility.violations).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow).toBe(false)
      await page.screenshot({ path: join(report, `${version}-${viewport.width}.png`), fullPage: true })
      expect(errors).toEqual([])
      await page.evaluate(() => window.richTextFixture.unmount())
      await context.close()
    }
    results.push({ version, node: true, ssr: true, types: true, build: true, browser: true, viewports: [1280, 375] })
    console.log(`PASS packed consumer Tiptap ${version}`)
  }
  finally {
    await browser?.close()
    await new Promise((resolveClose, reject) => server.httpServer.close(error => error ? reject(error) : resolveClose()))
  }
}
await writeFile(join(report, 'results.json'), JSON.stringify({ results, consumerRoot: scratch }, null, 2))
console.log(`Consumer diagnostics: ${report}`)
console.log(`Reproducible installed consumers: ${scratch}`)
