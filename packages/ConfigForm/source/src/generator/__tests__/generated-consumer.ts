import type { SourceFileSetV1, SourceTextFile } from '../types'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

const execFileAsync = promisify(execFile)
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
const workspaceRoot = resolve(packageRoot, '../../..')
const require = createRequire(import.meta.url)
const vueTscBin = require.resolve('vue-tsc/bin/vue-tsc.js')
const viteBin = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')

function installedPackagePath(name: string, fallback: string): string {
  const direct = join(packageRoot, 'node_modules', ...name.split('/'))
  return existsSync(direct) ? direct : fallback
}

const consumerDependencies = new Map<string, string>([
  ['@moluoxixi/config-form', resolve(workspaceRoot, 'packages/ConfigForm/runtime')],
  ['@moluoxixi/config-form-element', resolve(workspaceRoot, 'packages/ConfigForm/element')],
  ['@moluoxixi/config-form-headless', resolve(workspaceRoot, 'packages/ConfigForm/headless')],
  ['@vitejs/plugin-vue', join(packageRoot, 'node_modules/@vitejs/plugin-vue')],
  ['element-plus', installedPackagePath('element-plus', resolve(workspaceRoot, 'packages/ConfigForm/element/node_modules/element-plus'))],
  ['sass', join(packageRoot, 'node_modules/sass')],
  ['vite', join(packageRoot, 'node_modules/vite')],
  ['vue', join(packageRoot, 'node_modules/vue')],
  ['vue-router', installedPackagePath('vue-router', resolve(workspaceRoot, 'packages/ConfigForm/workbench/node_modules/vue-router'))],
  ['zod', installedPackagePath('zod', resolve(workspaceRoot, 'packages/ConfigForm/element/node_modules/zod'))],
])

function textFiles(fileSet: SourceFileSetV1): SourceTextFile[] {
  return fileSet.files.filter((file): file is SourceTextFile => file.kind === 'text')
}

function formatCompilerErrors(errors: readonly (string | SyntaxError)[]): string {
  return errors.map(error => typeof error === 'string' ? error : error.message).join('\n')
}

export function assertGeneratedVueFilesCompile(fileSet: SourceFileSetV1): void {
  for (const file of textFiles(fileSet).filter(file => file.path.endsWith('.vue'))) {
    const parsed = parse(file.content, { filename: file.path })
    if (parsed.errors.length > 0)
      throw new Error(`${file.path} failed SFC parsing:\n${formatCompilerErrors(parsed.errors)}`)

    const { descriptor } = parsed
    let bindingMetadata: ReturnType<typeof compileScript>['bindings'] | undefined
    if (descriptor.script || descriptor.scriptSetup) {
      const compiledScript = compileScript(descriptor, {
        id: `generated-${file.path.replace(/[^a-z0-9]/gi, '-')}`,
      })
      bindingMetadata = compiledScript.bindings
    }
    if (descriptor.template) {
      const compiledTemplate = compileTemplate({
        id: `generated-${file.path.replace(/[^a-z0-9]/gi, '-')}`,
        filename: file.path,
        source: descriptor.template.content,
        compilerOptions: { bindingMetadata },
      })
      if (compiledTemplate.errors.length > 0) {
        throw new Error(
          `${file.path} failed template compilation:\n${formatCompilerErrors(compiledTemplate.errors)}`,
        )
      }
    }
  }
}

export function assertGeneratedRuntimeBoundary(fileSet: SourceFileSetV1): void {
  const forbiddenDirectories = [
    'src/compiler/',
    'src/prototype-runtime/',
    'src/runtime/',
    'src/session/',
  ]
  const forbiddenSymbols = [
    /@moluoxixi\/config-form-compiler/iu,
    /@moluoxixi\/config-form-prototype-runtime/iu,
    /handler\s*registry/iu,
    /initializePrototypeSession/u,
    /overlay\s*host/iu,
    /reducePrototypeSession/u,
    /session\s*reducer/iu,
  ]

  for (const file of fileSet.files) {
    if (forbiddenDirectories.some(prefix => file.path.startsWith(prefix)))
      throw new Error(`${fileSet.kind} emitted forbidden runtime path ${file.path}.`)
  }

  const generatedText = textFiles(fileSet).map(file => file.content).join('\n')
  if (fileSet.kind === 'raw-source' && /@moluoxixi\/config-form/iu.test(generatedText))
    throw new Error('raw-source emitted a ConfigForm package reference.')
  for (const forbidden of forbiddenSymbols) {
    if (forbidden.test(generatedText))
      throw new Error(`${fileSet.kind} emitted forbidden runtime source matching ${forbidden}.`)
  }

  const manifestFile = textFiles(fileSet).find(file => file.path === 'package.json')
  if (!manifestFile)
    throw new Error(`${fileSet.kind} did not emit package.json.`)
  const manifest = JSON.parse(manifestFile.content) as {
    dependencies?: Record<string, string>
  }
  const dependencyNames = Object.keys(manifest.dependencies ?? {})
  const forbiddenDependencies = fileSet.kind === 'raw-source'
    ? dependencyNames.filter(name => name.startsWith('@moluoxixi/config-form'))
    : dependencyNames.filter(name => [
        '@moluoxixi/config-form-compiler',
        '@moluoxixi/config-form-designer',
        '@moluoxixi/config-form-model',
        '@moluoxixi/config-form-prototype-runtime',
        '@moluoxixi/config-form-source',
        '@config-form/workbench',
      ].includes(name))
  if (forbiddenDependencies.length > 0) {
    throw new Error(
      `${fileSet.kind} emitted forbidden dependencies: ${forbiddenDependencies.join(', ')}.`,
    )
  }
}

async function writeGeneratedFiles(root: string, fileSet: SourceFileSetV1): Promise<void> {
  for (const file of fileSet.files) {
    const target = join(root, ...file.path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    const content = file.kind === 'text'
      ? file.content
      : Buffer.from(file.contentBase64, 'base64')
    await writeFile(target, content)
  }
}

async function linkConsumerDependencies(root: string): Promise<void> {
  for (const [name, target] of consumerDependencies) {
    if (!existsSync(target))
      throw new Error(`Generated consumer dependency ${name} is not installed at ${target}.`)
    const linkPath = join(root, 'node_modules', ...name.split('/'))
    await mkdir(dirname(linkPath), { recursive: true })
    await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
}

export async function verifyGeneratedConsumer(fileSet: SourceFileSetV1): Promise<void> {
  const consumerRoot = await mkdtemp(join(packageRoot, '.generated-consumer-'))
  try {
    await writeGeneratedFiles(consumerRoot, fileSet)
    await linkConsumerDependencies(consumerRoot)
    try {
      await execFileAsync(process.execPath, [vueTscBin, '-p', 'tsconfig.json', '--noEmit'], {
        cwd: consumerRoot,
        windowsHide: true,
      })
    }
    catch (error) {
      const failure = error as { stdout?: string, stderr?: string }
      throw new Error([
        `${fileSet.kind} generated consumer typecheck failed.`,
        failure.stdout,
        failure.stderr,
        ...textFiles(fileSet)
          .filter(file => file.path.endsWith('.vue'))
          .map(file => `--- ${file.path} ---\n${file.content}`),
      ].filter(Boolean).join('\n'))
    }
    try {
      await execFileAsync(process.execPath, [viteBin, 'build', '--logLevel', 'error'], {
        cwd: consumerRoot,
        windowsHide: true,
      })
    }
    catch (error) {
      const failure = error as { stdout?: string, stderr?: string }
      throw new Error([
        `${fileSet.kind} generated consumer build failed.`,
        failure.stdout,
        failure.stderr,
      ].filter(Boolean).join('\n'))
    }
  }
  finally {
    await rm(consumerRoot, { recursive: true, force: true })
  }
}
