import type { CanonicalProjectSourceExport, WorkspaceFile } from '../index'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normalizeProjectPath } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProjectFixture } from '../__tests__/fixtures'
import { createCanonicalProjectSourceExport } from '../export'

const bundledPnpmCli = resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.mjs')
const corepackPnpmCli = (process.env.PATH ?? '')
  .split(delimiter)
  .map(entry => resolve(entry, 'node_modules/corepack/dist/pnpm.js'))
  .find(existsSync)
const pnpmCli = process.env.npm_execpath
  || (existsSync(bundledPnpmCli) ? bundledPnpmCli : corepackPnpmCli)
const pnpmCommand = pnpmCli ? process.execPath : 'pnpm'
const pnpmPrefix = pnpmCli ? [pnpmCli] : []
const temporaryRoots: string[] = []
let coreTarball: string
let rulesTarball: string
let prototypeRuntimeTarball: string

async function runPnpm(args: string[], cwd: string): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    let output = ''
    const child = spawn(pnpmCommand, [...pnpmPrefix, ...args], {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
      process.stdout.write(chunk)
    })
    child.on('error', rejectPromise)
    child.on('close', (code, signal) => {
      if (code === 0)
        resolvePromise(output.trim())
      else
        rejectPromise(new Error(`pnpm ${args.join(' ')} failed${signal ? ` (${signal})` : ''}`))
    })
  })
}

async function writeFiles(files: Readonly<Record<string, Readonly<WorkspaceFile>>>, directory: string): Promise<void> {
  const resolvedRoot = resolve(directory)
  for (const [path, file] of Object.entries(files)) {
    const normalized = normalizeProjectPath(path)
    const destination = resolve(resolvedRoot, normalized)
    if (!destination.startsWith(`${resolvedRoot}${sep}`))
      throw new Error(`Project file escaped the export root: ${path}`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, file.kind === 'text' ? file.content : file.content)
  }
}

async function generatedProject(adapterId: 'antd-vue' | 'element-plus'): Promise<CanonicalProjectSourceExport> {
  const adapter = await loadWorkbenchAdapter(adapterId)
  const templateId = adapterId === 'element-plus' ? 'element-profile' : 'antd-profile'
  const document = createBuiltInProjectFixture(templateId, {
    id: `${templateId}-source-build`,
    name: `${templateId} source build`,
  }, adapter.componentRegistry.lock)
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(document, 1),
    registry: adapter.registrySnapshot,
  })
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Compilation failed.')
  return createCanonicalProjectSourceExport(result.compilation, adapter.sourceResolver)
}

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'config-form-rules-package-'))
  temporaryRoots.push(root)
  coreTarball = resolve(root, 'core.tgz')
  rulesTarball = resolve(root, 'rules.tgz')
  prototypeRuntimeTarball = resolve(root, 'prototype-runtime.tgz')
  await runPnpm(
    ['pack', '--out', coreTarball],
    fileURLToPath(new URL('../../../../core/', import.meta.url)),
  )
  await runPnpm(['pack', '--out', rulesTarball], fileURLToPath(new URL('../../../../../zod3-to-rule/', import.meta.url)))
  await runPnpm(
    ['pack', '--out', prototypeRuntimeTarball],
    fileURLToPath(new URL('../../../../prototype-runtime/', import.meta.url)),
  )
})

afterAll(async () => {
  await Promise.all(temporaryRoots.map(root => rm(root, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  })))
})

describe('canonical exported projects', () => {
  it.each(['element-plus', 'antd-vue'] as const)(
    'installs, type-checks, and builds the %s standalone Source project',
    async (adapterId) => {
      const exported = await generatedProject(adapterId)
      const root = await mkdtemp(join(tmpdir(), `config-form-${adapterId}-source-`))
      temporaryRoots.push(root)
      await writeFiles(exported.files, root)

      const responsiveStyles = await readFile(resolve(root, 'src/runtime/vue/styles/responsive.scss'), 'utf8')
      expect(responsiveStyles).toContain('@media (max-width: 1024px)')
      expect(responsiveStyles).toContain('@media (max-width: 720px)')
      expect(responsiveStyles).not.toContain('grid-template-columns: 1fr !important')
      const main = await readFile(resolve(root, 'src/main.ts'), 'utf8')
      expect(main).toContain('import \'./runtime/vue/styles/index.scss\'')

      // Exercise this checkout's published package files, without registry state deciding which implementation is tested.
      const packagePath = resolve(root, 'package.json')
      const manifest = JSON.parse(await readFile(packagePath, 'utf8'))
      expect(manifest.dependencies['@moluoxixi/zod3-to-rule']).toBe('^0.1.2')
      const workspaceManifest = JSON.parse(await readFile(new URL('../../../../../../package.json', import.meta.url), 'utf8'))
      expect(manifest.packageManager).toBe(workspaceManifest.packageManager)
      manifest.pnpm = { overrides: {
        '@moluoxixi/config-form-core': `file:${coreTarball.replaceAll('\\', '/')}`,
        '@moluoxixi/config-form-prototype-runtime': `file:${prototypeRuntimeTarball.replaceAll('\\', '/')}`,
        '@moluoxixi/zod3-to-rule': `file:${rulesTarball.replaceAll('\\', '/')}`,
      } }
      await writeFile(packagePath, JSON.stringify(manifest, null, 2))
      const version = await runPnpm(['--version'], root)
      expect(`pnpm@${version}`).toBe(workspaceManifest.packageManager)
      process.stdout.write(`Standalone toolchain: ${pnpmCli ?? pnpmCommand}, pnpm ${version}, ${root}\n`)
      await runPnpm(['install', '--ignore-scripts', '--no-lockfile'], root)
      await runPnpm(['run', 'typecheck'], root)
      await runPnpm(['run', 'build'], root)

      const appSource = await readFile(resolve(root, 'src/App.vue'), 'utf8')
      expect(appSource).toContain(`from '@moluoxixi/config-form-prototype-runtime/vue'`)
      expect(appSource).toContain('<PrototypeSurfaceHost')
      expect(appSource).not.toContain('reducePrototypeSession')
      expect(appSource).not.toContain('form.config')
      expect(existsSync(resolve(root, 'dist/index.html'))).toBe(true)
      const assets = resolve(root, 'dist/assets')
      const cssFiles = (await readdir(assets)).filter(path => path.endsWith('.css'))
      expect(cssFiles.length).toBeGreaterThan(0)
      const css = (await Promise.all(cssFiles.map(path => readFile(resolve(assets, path), 'utf8')))).join('\n')
      expect(css).toContain('[data-config-form-responsive-root]')
      expect(css).toContain('--mx-config-form-active-columns')
      expect(css).toMatch(/@media\s*\(max-width:\s*1024px\)/)
      expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/)
    },
    120_000,
  )
})
