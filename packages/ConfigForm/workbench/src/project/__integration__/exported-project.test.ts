import type { CanonicalProjectSourceExport, WorkspaceFile } from '../index'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { afterAll, describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectSourceExport } from '../export/source'
import { normalizeProjectPath } from '../path'
import { createBuiltInProject } from '../templates'

const bundledPnpmCli = resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.mjs')
const pnpmCli = process.env.npm_execpath || (existsSync(bundledPnpmCli) ? bundledPnpmCli : undefined)
const pnpmCommand = pnpmCli ? process.execPath : 'pnpm'
const pnpmPrefix = pnpmCli ? [pnpmCli] : []
const temporaryRoots: string[] = []

async function runPnpm(args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(pnpmCommand, [...pnpmPrefix, ...args], {
      cwd,
      shell: false,
      stdio: 'inherit',
    })
    child.on('error', rejectPromise)
    child.on('close', (code, signal) => {
      if (code === 0)
        resolvePromise()
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
  const document = createBuiltInProject(templateId, {
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

      await runPnpm(['install', '--ignore-scripts', '--no-lockfile', '--trust-policy-ignore-after', '10080'], root)
      await runPnpm(['run', 'typecheck'], root)
      await runPnpm(['run', 'build'], root)

      const appSource = await readFile(resolve(root, 'src/App.vue'), 'utf8')
      expect(appSource).not.toMatch(/ConfigForm|config-form|form\.config/)
      expect(existsSync(resolve(root, 'dist/index.html'))).toBe(true)
    },
    120_000,
  )
})
