import type { ProjectDialogSurface, ProjectDocument, ProjectDrawerSurface } from '@moluoxixi/config-form-model'
import type { SourceFile, SourceFileSetV1 } from '@moluoxixi/config-form-source/generator'
import type { WorkbenchAdapterId } from '../../adapters'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { PROJECT_IMAGE_RESOURCE_SETTING } from '@moluoxixi/config-form-model'
import { generateConfigFormBindings, generateVueSource } from '@moluoxixi/config-form-source/generator'
import { compileScript, parse } from '@vue/compiler-sfc'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProjectFixture, duplicateProjectSurface } from '../__tests__/fixtures'
import { createProjectSourceInput, createStructuredSourceArchive } from '../export'

const execFileAsync = promisify(execFile)
const workbenchRoot = fileURLToPath(new URL('../../../', import.meta.url))
const require = createRequire(import.meta.url)
const vueTscBin = require.resolve('vue-tsc/bin/vue-tsc.js')
const viteBin = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBpQAAAAASUVORK5CYII=', 'base64')

async function fixture(provider: WorkbenchAdapterId = 'element-plus') {
  const adapter = await loadWorkbenchAdapter(provider)
  const document = createBuiltInProjectFixture(provider === 'element-plus' ? 'element-profile' : 'antd-profile', {
    id: 'export-project',
    name: 'Export project',
  }, adapter.componentRegistry.lock)
  const home = document.surfacesById.home!
  const name = Object.values(home.graph.nodesById).find(node => node.kind === 'field' && node.component.endsWith('.input'))
  if (name?.kind !== 'field')
    throw new Error('Fixture needs a name field.')
  name.required = true
  name.validation = {
    version: 2,
    base: { type: 'string' },
    rules: [{ kind: 'minLength', value: 2, message: 'Use at least two characters.' }],
  }
  const imageId = 'project-logo'
  home.graph.nodesById[imageId] = {
    id: imageId,
    kind: 'element',
    component: provider === 'element-plus' ? 'element.image' : 'antd.image',
    props: {},
    resourceBindings: { src: { resourceId: 'logo' } },
  }
  home.graph.root.push({ nodeId: imageId, placement: {} })
  const buttonId = 'open-details'
  home.graph.nodesById[buttonId] = { id: buttonId, kind: 'element', component: provider === 'element-plus' ? 'element.button' : 'antd.button', props: { text: 'Open details' } }
  home.graph.root.push({ nodeId: buttonId, placement: {} })
  home.interactions.push({ kind: 'primaryUiAction', id: 'open-details', nodeId: buttonId, trigger: 'activate', action: { kind: 'open', targetSurfaceId: 'details', parameters: [] } })
  const details: ProjectDialogSurface = {
    id: 'details',
    kind: 'dialog',
    name: 'Details',
    parameters: [],
    outputs: [],
    graph: structuredClone(home.graph),
    interactions: [{ kind: 'primaryUiAction', id: 'open-drawer', nodeId: buttonId, trigger: 'activate', action: { kind: 'open', targetSurfaceId: 'drawer', parameters: [] } }],
    presentation: { kind: 'dialog', title: 'Details', width: { desktop: { value: 560, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
  }
  const drawer: ProjectDrawerSurface = {
    id: 'drawer',
    kind: 'drawer',
    name: 'Drawer',
    parameters: [],
    outputs: [],
    interactions: [],
    graph: structuredClone(home.graph),
    presentation: { kind: 'drawer', title: 'Drawer', placement: 'right', size: { desktop: { value: 480, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
  }
  document.surfacesById.details = details
  document.surfacesById.drawer = drawer
  document.surfacesById.settings = { ...duplicateProjectSurface(home, 'settings', 'Settings', '/settings'), interactions: [] }
  document.surfaceOrder.push('details', 'drawer', 'settings')
  document.resources.logo = {
    id: 'logo',
    kind: 'embedded',
    name: 'Project logo',
    fileName: 'logo.png',
    mediaType: 'image/png',
    byteLength: logo.byteLength,
    contentHash: `sha256:${createHash('sha256').update(logo).digest('hex')}`,
  }
  document.settings[PROJECT_IMAGE_RESOURCE_SETTING] = 'logo'
  return {
    adapter,
    document,
    readEmbedded: async () => ({
      success: true as const,
      data: Uint8Array.from(logo),
      diagnostics: [] as [],
    }),
  }
}

function sourceText(files: readonly SourceFile[], path: string): string {
  const file = files.find(file => file.path === path)
  if (!file || file.kind !== 'text')
    throw new Error(`Missing generated text file: ${path}`)
  return file.content
}

async function verifyArchive(fileSet: SourceFileSetV1, document: ProjectDocument, surfaceId?: string): Promise<void> {
  const archive = unzipSync(await createStructuredSourceArchive({
    name: 'consumer',
    projectId: document.id,
    projectName: document.name,
    files: fileSet.files,
    scope: surfaceId ? 'surface' : 'project',
    ...(surfaceId ? { surfaceId, surfaceDirectory: surfaceId, surfaceDirectories: document.surfaceOrder } : {}),
  }))
  const consumerRoot = await mkdtemp(join(tmpdir(), 'config-form-structured-export-'))
  try {
    for (const [path, bytes] of Object.entries(archive)) {
      const relative = path.slice('consumer/'.length)
      const target = join(consumerRoot, relative)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
    }
    await symlink(join(workbenchRoot, 'node_modules'), join(consumerRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    try {
      await execFileAsync(process.execPath, [vueTscBin, '-p', 'tsconfig.json', '--noEmit'], { cwd: consumerRoot, windowsHide: true })
      await execFileAsync(process.execPath, [viteBin, 'build', '--logLevel', 'error'], { cwd: consumerRoot, windowsHide: true })
    }
    catch (error) {
      const failure = error as { stdout?: string, stderr?: string }
      throw new Error(`Exported ${fileSet.kind} failed consumer verification:\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`)
    }
    expect(Object.keys(archive).every(path => !path.includes('/shared/') && !path.includes('/surfaces/'))).toBe(true)
    if (fileSet.kind === 'raw-source') {
      for (const [path, bytes] of Object.entries(archive)) {
        if (path.endsWith('.vue'))
          expect(strFromU8(bytes), path).not.toMatch(/\bcontrol-id\b|\bcontrolId\b/u)
      }
      const html = await readFile(join(consumerRoot, 'dist/index.html'), 'utf8')
      expect(html).toContain('./favicon.png')
      expect(await readFile(join(consumerRoot, 'dist/favicon.png'))).toEqual(logo)
      expect(strFromU8(archive['consumer/src/router/index.ts']!)).toContain('@/views/home/index.vue')
      const page = strFromU8(archive['consumer/src/views/home/index.vue']!)
      expect(page).toContain('@/components/ConfigFormItem.vue')
      expect(page).toMatch(/v-model(?::(?:value|checked))?=/u)
      expect(strFromU8(archive['consumer/src/views/home/utils/validation.ts']!)).toContain('zod')
    }
    else {
      expect(await readFile(join(consumerRoot, 'dist/style.css'), 'utf8')).toContain('--demo-')
      expect(strFromU8(archive['consumer/src/bindings.ts']!)).toContain('@/views/home/utils/config')
    }
  }
  finally {
    await rm(consumerRoot, { recursive: true, force: true })
  }
}

describe('structured export consumer', () => {
  it.each<WorkbenchAdapterId>(['element-plus', 'antd-vue'])('emits working business bindings and static choices for %s', async (provider) => {
    const adapter = await loadWorkbenchAdapter(provider)
    const document = createBuiltInProjectFixture(provider === 'element-plus' ? 'element-profile' : 'antd-profile', {
      id: 'profile-export',
      name: 'Profile',
    }, adapter.componentRegistry.lock)
    const source = createProjectSourceInput({ document, registry: adapter.registrySnapshot, componentResolver: adapter.sourceComponentResolver, readEmbedded: async () => ({ success: true as const, data: new Uint8Array(), diagnostics: [] }) })
    const generated = await generateVueSource(source.source)
    if (!generated.success)
      throw new Error(JSON.stringify(generated.diagnostics))
    const page = sourceText(generated.data.files, 'src/surfaces/home/Surface.vue')
    const { descriptor } = parse(page)
    const script = compileScript(descriptor, { id: 'profile-export', inlineTemplate: true })
    expect(Object.keys(script.bindings ?? {})).toContain('values')
    expect(script.content).toMatch(/(?:onUpdate:modelValue|onUpdate:value|onUpdate:checked)/u)
    expect(page).not.toMatch(/updateValue|demoParameters|setDemoFields|reactionProjection/u)
    expect(page).toContain('grid-cols-24')
    expect(page).toContain('max-[720px]:col-span-1')
    if (provider === 'element-plus') {
      expect(page).toContain('<el-option label="Developer" value="developer" />')
      expect(page).toContain('<el-option label="Designer" value="designer" />')
      expect(page).not.toContain(':options=')
    }
    else {
      expect(page).toContain(':options=')
      expect(page).toContain('v-model:value=')
      expect(page).toContain('v-model:checked=')
    }
  })

  it.each<WorkbenchAdapterId>(['element-plus', 'antd-vue'])('typechecks and builds a Tailwind project for %s', async (provider) => {
    const input = await fixture(provider)
    const source = createProjectSourceInput({ ...input, registry: input.adapter.registrySnapshot, componentResolver: input.adapter.sourceComponentResolver })
    const generated = await generateVueSource(source.source)
    if (!generated.success)
      throw new Error(JSON.stringify(generated.diagnostics))
    await verifyArchive(generated.data, source.document)
  })

  it('typechecks and builds ConfigForm bindings with the same src layout and aliases', async () => {
    const input = await fixture()
    const source = createProjectSourceInput({ ...input, registry: input.adapter.registrySnapshot, componentResolver: input.adapter.sourceComponentResolver })
    const generated = await generateConfigFormBindings({ ...source.source, bindingResolver: input.adapter.sourceBindingResolver })
    if (!generated.success)
      throw new Error(JSON.stringify(generated.diagnostics))
    expect(sourceText(generated.data.files, 'src/surfaces/home/config.ts')).toContain('@moluoxixi')
    await verifyArchive(generated.data, source.document)
  })

  it('typechecks and builds a page export including nested overlays and the project favicon', async () => {
    const input = await fixture()
    const source = createProjectSourceInput({ ...input, surfaceId: 'home', registry: input.adapter.registrySnapshot, componentResolver: input.adapter.sourceComponentResolver })
    expect(source.document.surfaceOrder).toEqual(['home', 'details', 'drawer'])
    const generated = await generateVueSource(source.source)
    if (!generated.success)
      throw new Error(JSON.stringify(generated.diagnostics))
    await verifyArchive(generated.data, source.document, 'home')
  })
})
