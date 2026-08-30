import type { LegacyLowCodePageModelV1 as LowCodePageModel } from '@moluoxixi/config-form-model'
import type { WorkspaceProject } from '../types'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPureSourceExport } from '../export/source'
import { normalizeProjectPath } from '../path'
import { createBuiltInWorkspaceProject } from '../templates'

const workspaceRoot = resolve(import.meta.dirname, '../../../../../..')
const bundledPnpmCli = resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.mjs')
const pnpmCli = process.env.npm_execpath || (existsSync(bundledPnpmCli) ? bundledPnpmCli : undefined)
const pnpmCommand = pnpmCli ? process.execPath : 'pnpm'
const pnpmPrefix = pnpmCli ? [pnpmCli] : []
const packageDirectories = [
  'packages/ConfigForm/core',
  'packages/ConfigForm/headless',
  'packages/ConfigForm/runtime',
  'packages/ConfigForm/element',
  'packages/ConfigForm/antd',
]
const temporaryRoots: string[] = []
let packedDependencies: Record<string, string>

async function runPnpm(args: string[], options: { capture?: boolean, cwd?: string } = {}): Promise<string> {
  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(pnpmCommand, [...pnpmPrefix, ...args], {
      cwd: options.cwd ?? workspaceRoot,
      shell: false,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', chunk => stdout += chunk)
    child.stderr?.on('data', chunk => stderr += chunk)
    child.on('error', rejectPromise)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolvePromise(stdout)
        return
      }
      const diagnostics = [signal, stdout, stderr].filter(Boolean).join('\n')
      rejectPromise(new Error(`pnpm ${args.join(' ')} failed${diagnostics ? `:\n${diagnostics}` : ''}`))
    })
  })
}

async function writeProject(project: WorkspaceProject, directory: string): Promise<void> {
  const resolvedRoot = resolve(directory)
  for (const [path, file] of Object.entries(project.files)) {
    const normalized = normalizeProjectPath(path)
    const destination = resolve(resolvedRoot, normalized)
    if (!destination.startsWith(`${resolvedRoot}${sep}`))
      throw new Error(`project file escaped the export root: ${path}`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, file.kind === 'text' ? file.content : file.content)
  }
}

beforeAll(async () => {
  await runPnpm([
    '--filter',
    '@moluoxixi/config-form-core',
    '--filter',
    '@moluoxixi/config-form-headless',
    '--filter',
    '@moluoxixi/config-form',
    '--filter',
    '@moluoxixi/config-form-element',
    '--filter',
    '@moluoxixi/config-form-antd-vue',
    'run',
    'build',
  ])

  const root = await mkdtemp(join(tmpdir(), 'config-form-workbench-packs-'))
  temporaryRoots.push(root)
  const packDirectory = resolve(root, 'packs')
  await mkdir(packDirectory, { recursive: true })
  const entries: Array<[string, string]> = []

  for (const relativeDirectory of packageDirectories) {
    const packageDirectory = resolve(workspaceRoot, relativeDirectory)
    const manifest = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8')) as { name: string }
    const output = await runPnpm([
      '--config.ignore-scripts=true',
      '--dir',
      packageDirectory,
      'pack',
      '--pack-destination',
      packDirectory,
      '--json',
    ], { capture: true })
    const packed = JSON.parse(output) as { filename?: string } | Array<{ filename?: string }>
    const filename = Array.isArray(packed) ? packed[0]?.filename : packed.filename
    if (!filename)
      throw new Error(`pnpm pack did not report a tarball for ${manifest.name}`)
    entries.push([manifest.name, `file:${resolve(packDirectory, basename(filename)).replaceAll('\\', '/')}`])
  }

  packedDependencies = Object.fromEntries(entries)
})

afterAll(async () => {
  await Promise.all(temporaryRoots.map(root => rm(root, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  })))
})

describe('exported projects', () => {
  it.each(['element-profile', 'antd-profile'])('installs, type-checks, and builds %s', async (templateId) => {
    const project = createBuiltInWorkspaceProject(templateId, {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: `${templateId}-build`,
      name: `${templateId} build`,
    })
    const root = await mkdtemp(join(tmpdir(), `config-form-${templateId}-`))
    temporaryRoots.push(root)
    await writeProject(project, root)

    const packagePath = resolve(root, 'package.json')
    const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    manifest.dependencies = {
      ...manifest.dependencies,
      ...packedDependencies,
    }
    await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(resolve(root, 'pnpm-workspace.yaml'), JSON.stringify({ overrides: packedDependencies }))

    await runPnpm([
      '--dir',
      root,
      'install',
      '--ignore-scripts',
      '--no-lockfile',
      '--trust-policy-ignore-after',
      '10080',
    ])
    await runPnpm(['--dir', root, 'run', 'typecheck'])
    await runPnpm(['--dir', root, 'run', 'build'])

    expect(existsSync(resolve(root, 'dist/index.html'))).toBe(true)
  })

  it.each(['element-profile', 'antd-profile'])('builds standalone Source export for %s', async (templateId) => {
    const project = createBuiltInWorkspaceProject(templateId, {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: `${templateId}-source-build`,
      name: `${templateId} source build`,
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    const registry = project.manifest.adapter === 'element-plus'
      ? createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
      : createLowCodeComponentRegistry(createAntdVueDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const root = await mkdtemp(join(tmpdir(), `config-form-${templateId}-source-`))
    temporaryRoots.push(root)
    await writeProject(exported.project, root)

    await runPnpm([
      '--dir',
      root,
      'install',
      '--ignore-scripts',
      '--no-lockfile',
      '--trust-policy-ignore-after',
      '10080',
    ])
    await runPnpm(['--dir', root, 'run', 'typecheck'])
    await runPnpm(['--dir', root, 'run', 'build'])

    const appSource = await readFile(resolve(root, 'src/App.vue'), 'utf8')
    expect(appSource).not.toMatch(/ConfigForm|config-form|form\.config/)
    expect(existsSync(resolve(root, 'dist/index.html'))).toBe(true)
  })
})
