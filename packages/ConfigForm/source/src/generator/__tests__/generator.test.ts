import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ContractResult, ModelJsonObject } from '@moluoxixi/config-form-model'
import type {
  GenerateSourceInput,
  SourceComponentRequest,
  SourceProviderResolver,
  SourceResourceReader,
} from '../types'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { generateConfigFormBindings, generateVueSource } from '..'
import {
  assertGeneratedRuntimeBoundary,
  assertGeneratedVueFilesCompile,
  verifyGeneratedConsumer,
} from './generated-consumer'

const embeddedBytes = new TextEncoder().encode('hello')
const embeddedHash = `sha256:${createHash('sha256').update(embeddedBytes).digest('hex')}`

function node(
  input: ModelJsonObject & { id: string, kind: 'field' | 'layout' | 'element', component: string },
) {
  return {
    componentVersion: '1',
    componentFingerprint: `fingerprint:${input.component}`,
    subtreeHash: `subtree:${input.id}`,
    placement: { parentId: null, slot: null, props: {} },
    configuredProps: {},
    props: {},
    ...input,
  }
}

function compilation(): ProjectCompilation {
  const homeNodes = {
    layout: node({
      id: 'layout',
      kind: 'layout',
      component: 'layout.flex',
      placement: { parentId: null, slot: null, props: {} },
      props: { direction: 'column', gap: 12, ariaLabel: 'Primary "layout" & navigation' },
      slots: { default: ['name', 'status', 'logo', 'open'] },
    }),
    name: node({
      id: 'name',
      kind: 'field',
      component: 'field.input',
      field: 'name',
      label: 'Name',
      defaultValue: 'Ada',
      validateOn: ['submit'],
      validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Name is required' }] },
      placement: { parentId: 'layout', slot: 'default', props: { span: 12 } },
    }),
    status: node({
      id: 'status',
      kind: 'field',
      component: 'field.select',
      field: 'status',
      label: 'Status',
      defaultValue: 'draft',
      validateOn: ['change'],
      datasetBindings: {
        options: { datasetId: 'statuses', projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] } },
      },
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    logo: node({
      id: 'logo',
      kind: 'element',
      component: 'element.image',
      resourceBindings: { src: { resourceId: 'brand.logo' }, fallback: { resourceId: 'remote.hero' } },
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    open: node({
      id: 'open',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Open "details" & <more>' },
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
  }
  const surfacesById = {
    home: {
      id: 'home', name: 'Home', kind: 'page', route: '/home', props: {}, form: {}, rootIds: ['layout'], nodesById: homeNodes,
      parameters: [], outputs: [], interactions: [{ kind: 'primaryUiAction', id: 'open-details', nodeId: 'open', trigger: 'activate', action: { kind: 'open', targetSurfaceId: 'details', parameters: [] } }],
      scopedFields: [], valueScopes: [],
    },
    details: {
      id: 'details', name: 'Details', kind: 'dialog', props: {}, form: {}, rootIds: [], nodesById: {}, parameters: [], outputs: [], interactions: [], scopedFields: [], valueScopes: [],
      presentation: { kind: 'dialog', title: 'Details', width: { desktop: { value: 480, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
    },
    drawer: {
      id: 'drawer', name: 'Drawer', kind: 'drawer', props: {}, form: {}, rootIds: [], nodesById: {}, parameters: [], outputs: [], interactions: [], scopedFields: [], valueScopes: [],
      presentation: { kind: 'drawer', title: 'Drawer', placement: 'right', size: { desktop: { value: 420, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
    },
  }
  const key = {
    projectId: 'demo-project',
    contentHash: 'sha256:project',
    registryAdapter: 'element-plus',
    registryAdapterVersion: '3',
    registryFingerprint: 'sha256:registry',
    compilerVersion: '6.0.0',
    environmentHash: 'sha256:environment',
    irHash: 'sha256:ir',
  }
  return {
    snapshot: {},
    registry: {},
    origin: { kind: 'committed', editVersion: 1 },
    key,
    ir: {
      version: 5,
      identity: key,
      name: 'Source Demo',
      homeSurfaceId: 'home',
      surfaceOrder: ['home', 'details', 'drawer'],
      surfacesById,
      datasetOrder: ['statuses'],
      datasetsById: {
        statuses: { id: 'statuses', name: 'Statuses', rows: [{ label: 'Draft', value: 'draft' }, { label: 'Done', value: 'done' }] },
      },
      resources: {
        'brand.logo': { id: 'brand.logo', name: 'Logo', kind: 'embedded', fileName: 'Logo.PNG', mediaType: 'image/png', byteLength: embeddedBytes.byteLength, contentHash: embeddedHash },
        'remote.hero': { id: 'remote.hero', name: 'Hero', kind: 'url', url: 'https://example.com/hero.png', mediaType: 'image/png' },
      },
      theme: { version: 1, colors: { primary: '#336699', canvas: '#F5F7FA' }, spacing: { md: 16 } },
      settings: {},
      environment: { version: '1', features: {} },
    },
  } as unknown as ProjectCompilation
}

function provider(requests: SourceComponentRequest[] = []): SourceProviderResolver {
  return {
    adapter: { adapter: 'element-plus', adapterVersion: '3', registryFingerprint: 'sha256:registry' },
    resolveComponent(request) {
      requests.push(request)
      const isNative = request.componentKey === 'layout.flex'
      const dependencies: Readonly<Record<string, string>> = isNative
        ? {}
        : { 'element-plus': '^2.9.0' }
      return {
        success: true,
        value: {
          moduleSpecifier: isNative ? '' : 'element-plus',
          importName: isNative ? '' : 'ElementPlus',
          tag: isNative ? 'div' : request.componentKey === 'field.input' ? 'el-input' : request.componentKey === 'field.select' ? 'el-select' : request.componentKey === 'element.image' ? 'el-image' : 'el-button',
          configComponent: request.componentKey,
          render: request.componentKey === 'layout.flex' ? 'layout-flex' : 'component',
          styleImports: isNative ? [] : ['element-plus/dist/index.css'],
          dependencies,
          ...(isNative ? {} : { library: { packageName: 'element-plus', plugin: 'ElementPlus', version: '^2.9.0', stylesheet: 'element-plus/dist/index.css' } }),
          ...(request.componentKey === 'field.select' ? { options: { mode: 'prop' as const } } : {}),
          ...(request.componentKey.startsWith('field.') ? { valueProp: 'modelValue', trigger: 'update:modelValue' } : {}),
        },
      }
    },
    resolveConfigFormBinding() {
      return {
        success: true,
        value: {
          component: { moduleSpecifier: '@moluoxixi/config-form-element', importName: 'ElementConfigForm' },
          model: { moduleSpecifier: '@moluoxixi/config-form-headless', importName: 'createConfigFormModel' },
          styleImports: ['@moluoxixi/config-form-element/styles'],
          dependencies: {
            '@moluoxixi/config-form': '^0.3.0',
            '@moluoxixi/config-form-element': '^0.2.6',
            '@moluoxixi/config-form-headless': '^0.2.6',
            'element-plus': '^2.9.0',
            'zod': '^3.24.2',
          },
        },
      }
    },
  }
}

function resourceReader(bytes = embeddedBytes): SourceResourceReader & { readEmbedded: ReturnType<typeof vi.fn> } {
  return {
    readEmbedded: vi.fn(async (): Promise<ContractResult<Uint8Array>> => ({
      success: true,
      data: new Uint8Array(bytes),
      diagnostics: [],
    })),
  }
}

function input(overrides: Partial<GenerateSourceInput> = {}): GenerateSourceInput {
  return {
    compilation: compilation(),
    providerResolver: provider(),
    resourceReader: resourceReader(),
    ...overrides,
  }
}

function text(fileSet: { files: readonly { kind: string, content?: string }[] }): string {
  return fileSet.files.flatMap(file => file.kind === 'text' ? [file.content ?? ''] : []).join('\n')
}

describe('source generators', () => {
  it('generates deterministic raw Vue source that directly uses provider UI', async () => {
    const requests: SourceComponentRequest[] = []
    const reader = resourceReader()
    const sourceInput = input({ providerResolver: provider(requests), resourceReader: reader })
    const first = await generateVueSource(sourceInput)
    const second = await generateVueSource(sourceInput)
    expect(first).toEqual(second)
    expect(first.success).toBe(true)
    if (!first.success)
      return

    expect(first.data.kind).toBe('raw-source')
    expect(first.data.entry).toBe('src/main.ts')
    expect(first.data.files.map(file => file.path)).toEqual([...first.data.files.map(file => file.path)].sort())
    expect(first.data.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'package.json', 'src/App.vue', 'src/data/datasets.ts', 'src/data/resources.ts', 'src/main.ts', 'src/router.ts',
      'src/surfaces/home/Surface.vue', 'src/surfaces/details/Surface.vue', 'src/surfaces/drawer/Surface.vue',
      'src/assets/brand-logo.png',
    ]))
    expect(first.data.files.some(file => file.path.startsWith('src/runtime/'))).toBe(false)
    expect(text(first.data)).not.toMatch(/@moluoxixi\/config-form|prototype-runtime|handlerRegistry|handler registry/)
    expect(text(first.data)).toMatch(/import ElementPlus from ['"]element-plus['"]/)
    expect(text(first.data)).toContain('.use(ElementPlus)')
    expect(text(first.data)).toContain('<el-input')
    expect(text(first.data)).toContain("https://example.com/hero.png")
    const binary = first.data.files.find(file => file.kind === 'binary')
    expect(binary).toMatchObject({ path: 'src/assets/brand-logo.png', contentBase64: 'aGVsbG8=' })
    expect(reader.readEmbedded).toHaveBeenCalledTimes(2)
    expect(reader.readEmbedded).toHaveBeenCalledWith({ projectId: 'demo-project', resourceId: 'brand.logo', contentHash: embeddedHash })
    expect(requests).toContainEqual({ componentKey: 'field.input', contractVersion: '1', contractFingerprint: 'fingerprint:field.input' })

    const manifestFile = first.data.files.find(file => file.path === 'package.json')
    const manifest = JSON.parse(manifestFile?.kind === 'text' ? manifestFile.content : '{}')
    expect(manifest.dependencies).toMatchObject({ vue: '3.5.33', 'vue-router': '^4.6.4', 'element-plus': '^2.9.0' })
    expect(Object.keys(manifest.dependencies)).not.toContain('@moluoxixi/config-form')
    assertGeneratedVueFilesCompile(first.data)
    assertGeneratedRuntimeBoundary(first.data)
    await verifyGeneratedConsumer(first.data)
  }, 30_000)

  it('generates a separate public ConfigForm binding project', async () => {
    const result = await generateConfigFormBindings(input())
    expect(result.success).toBe(true)
    if (!result.success)
      return

    expect(result.data.kind).toBe('config-bindings')
    expect(result.data.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'src/surfaces/home/Surface.vue', 'src/surfaces/home/config.ts', 'src/data/datasets.ts', 'src/main.ts',
    ]))
    const generated = text(result.data)
    expect(generated).toMatch(/import \{ ElementConfigForm \} from ['"]@moluoxixi\/config-form-element['"]/) 
    expect(generated).toMatch(/import \{ createConfigFormModel \} from ['"]@moluoxixi\/config-form-headless['"]/) 
    expect(generated).toContain('fields')
    expect(generated).not.toMatch(/src\/runtime|prototype-runtime|handlerRegistry|session reducer|overlay host/)
    assertGeneratedVueFilesCompile(result.data)
    assertGeneratedRuntimeBoundary(result.data)
    await verifyGeneratedConsumer(result.data)
  }, 30_000)

  it('fails closed on adapter identity or component resolution failures', async () => {
    const mismatched = provider()
    Object.assign(mismatched.adapter, { registryFingerprint: 'sha256:other' })
    const adapterResult = await generateVueSource(input({ providerResolver: mismatched }))
    expect(adapterResult.success).toBe(false)
    if (!adapterResult.success)
      expect(adapterResult.diagnostics[0]?.code).toBe('source_resolution_failed')

    const unresolved = provider()
    unresolved.resolveComponent = () => ({ success: false, reason: 'not published' })
    const componentResult = await generateVueSource(input({ providerResolver: unresolved }))
    expect(componentResult.success).toBe(false)
    if (!componentResult.success)
      expect(componentResult.diagnostics[0]?.code).toBe('source_resolution_failed')
  })

  it('fails without partial files when embedded content is missing or corrupt', async () => {
    const missingReader: SourceResourceReader = {
      async readEmbedded() {
        return { success: false, diagnostics: [{ code: 'resource_missing', message: 'missing' }] }
      },
    }
    const missing = await generateVueSource(input({ resourceReader: missingReader }))
    expect(missing.success).toBe(false)
    if (!missing.success)
      expect(missing.diagnostics[0]?.code).toBe('source_resource_read_failed')

    const corrupt = await generateVueSource(input({ resourceReader: resourceReader(new TextEncoder().encode('wrong')) }))
    expect(corrupt.success).toBe(false)
    if (!corrupt.success)
      expect(corrupt.diagnostics[0]?.code).toBe('resource_content_invalid')
  })

  it('turns reader throws and non-portable dependency versions into stable diagnostics', async () => {
    const throwing: SourceResourceReader = {
      async readEmbedded() {
        throw new Error('storage offline')
      },
    }
    const readResult = await generateVueSource(input({ resourceReader: throwing }))
    expect(readResult.success).toBe(false)
    if (!readResult.success)
      expect(readResult.diagnostics[0]?.code).toBe('source_resource_read_failed')

    const nonPortable = provider()
    const resolve = nonPortable.resolveComponent
    nonPortable.resolveComponent = (request) => {
      const result = resolve(request)
      return result.success
        ? { ...result, value: { ...result.value, dependencies: { 'element-plus': 'workspace:*' } } }
        : result
    }
    const dependencyResult = await generateVueSource(input({ providerResolver: nonPortable }))
    expect(dependencyResult.success).toBe(false)
    if (!dependencyResult.success)
      expect(dependencyResult.diagnostics[0]?.code).toBe('source_resolution_failed')
  })
})
