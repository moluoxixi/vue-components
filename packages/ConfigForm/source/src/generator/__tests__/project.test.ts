import type { ComponentContract, ProjectDocument, ProjectSurface } from '@moluoxixi/config-form-model'
import type { GenerateProjectSourceInput, SourceProjectPreset, SourceResourceReader } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
  writeProjectTransfer,
} from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { generateProjectSource, selectProjectSourceDocument } from '..'
import { assertGeneratedRuntimeBoundary, assertGeneratedVueFilesCompile } from './generated-consumer'

function fixture(provider: 'element-plus' | 'antd-vue' = 'element-plus') {
  const valueProp = provider === 'element-plus' ? 'modelValue' : 'value'
  const contract: ComponentContract = {
    key: 'fixture.input',
    version: '1',
    kind: 'field',
    props: [{ key: 'placeholder', path: ['props', 'placeholder'], valueKind: 'string' }],
    bindings: [{ name: 'value', valueProp, trigger: `update:${valueProp}` }],
    slots: [],
    defaults: {},
    allowedParents: [],
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
  }
  const registry = createComponentContractRegistry([contract], { adapter: provider, version: '1' })
  const snapshot = createRegistryContractSnapshot(registry)
  const library = provider === 'element-plus'
    ? { packageName: 'element-plus', plugin: 'ElementPlus', version: '^2.9.1', stylesheet: 'element-plus/dist/index.css' }
    : { packageName: 'ant-design-vue', plugin: 'Antd', version: '^4.2.6', stylesheet: 'ant-design-vue/dist/reset.css' }
  const preset: SourceProjectPreset = {
    registry: snapshot,
    componentResolver: {
      adapter: { adapter: snapshot.adapter, adapterVersion: snapshot.adapterVersion, registryFingerprint: snapshot.fingerprint },
      resolveComponent(request) {
        const component = snapshot.components.find(item => item.key === request.componentKey)
        if (!component || component.contractVersion !== request.contractVersion || component.fingerprint !== request.contractFingerprint)
          return { success: false, reason: 'Unknown or changed input component.' }
        return {
          success: true,
          value: {
            moduleSpecifier: library.packageName,
            importName: library.plugin,
            tag: provider === 'element-plus' ? 'el-input' : 'a-input',
            configComponent: 'input',
            render: 'component',
            valueProp,
            trigger: `update:${valueProp}`,
            blurTrigger: 'blur',
            styleImports: [library.stylesheet],
            dependencies: { [library.packageName]: library.version },
            library,
          },
        }
      },
    },
  }
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'sdk-project',
    name: 'SDK 工程',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: '资料',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: { density: 'compact' },
          root: [{ nodeId: 'name', placement: {} }],
          nodesById: {
            name: { id: 'name', kind: 'field', component: contract.key, field: 'name', label: '姓名', defaultValue: 'Ada', required: true, props: { placeholder: '请输入姓名' } },
          },
        },
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(registry.lock),
    settings: {},
  }
  return { document, preset }
}

function addCover(document: ProjectDocument) {
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16"/></svg>')
  document.resources.cover = {
    id: 'cover',
    name: '封面',
    kind: 'embedded',
    fileName: 'cover.svg',
    mediaType: 'image/svg+xml',
    byteLength: bytes.byteLength,
    contentHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  }
  document.settings.projectImageResourceId = 'cover'
  const reader: SourceResourceReader = {
    readEmbedded: vi.fn(async () => ({ success: true as const, data: bytes, diagnostics: [] as [] })),
  }
  return { bytes, reader }
}

describe('project source SDK', () => {
  it.each(['element-plus', 'antd-vue'] as const)('generates deterministic %s projects from objects and JSON text without a DOM', async (provider) => {
    const { document, preset } = fixture(provider)
    const before = structuredClone(document)
    const first = await generateProjectSource({ project: document, preset })
    const second = await generateProjectSource({ project: JSON.stringify(document), preset })
    expect(first).toEqual(second)
    expect(first.success).toBe(true)
    expect(document).toEqual(before)
    expect(typeof globalThis.document).toBe('undefined')
    if (!first.success)
      throw new Error(JSON.stringify(first.diagnostics))
    expect(first.data.entry).toBe('src/main.ts')
    expect(first.data.kind).toBe('raw-source')
    expect(first.data.files.some(file => file.path === 'src/surfaces/home/Surface.vue')).toBe(true)
    assertGeneratedRuntimeBoundary(first.data)
    assertGeneratedVueFilesCompile(first.data)
  })

  it('uses embedded transfer contents without a browser or external resource reader', async () => {
    const { document, preset } = fixture()
    const { bytes, reader } = addCover(document)
    const written = await writeProjectTransfer({ document, readEmbedded: async () => bytes })
    if (!written.success)
      throw new Error(JSON.stringify(written.diagnostics))
    const before = structuredClone(written.data)
    const direct = await generateProjectSource({ project: document, preset, resourceReader: reader })
    const embedded = await generateProjectSource({ project: JSON.stringify(written.data), preset })
    expect(embedded).toEqual(direct)
    expect(embedded.success).toBe(true)
    expect(written.data).toEqual(before)
    if (!embedded.success)
      return
    const image = embedded.data.files.find(file => file.kind === 'binary' && file.contentBase64 === Buffer.from(bytes).toString('base64'))
    expect(image).toBeDefined()
    expect(reader.readEmbedded).toHaveBeenCalledWith({ projectId: document.id, resourceId: 'cover', contentHash: document.resources.cover!.kind === 'embedded' ? document.resources.cover!.contentHash : '' })
  })

  it('reports missing and corrupt resource contents without a partial file set', async () => {
    const { document, preset } = fixture()
    const { bytes } = addCover(document)
    const missing = await generateProjectSource({ project: document, preset })
    expect(missing).toMatchObject({ success: false, diagnostics: [{ code: 'source_resource_read_failed', resourceId: 'cover' }] })
    expect(missing).not.toHaveProperty('data')
    const transfer = await writeProjectTransfer({ document, readEmbedded: async () => bytes })
    if (!transfer.success)
      throw new Error(JSON.stringify(transfer.diagnostics))
    transfer.data.embeddedContents[0]!.content.data = Buffer.from('wrong').toString('base64')
    const corrupt = await generateProjectSource({ project: transfer.data, preset })
    expect(corrupt.success).toBe(false)
    expect(corrupt).not.toHaveProperty('data')
  })

  it('rejects invalid JSON, unsupported document versions, missing surfaces and changed presets', async () => {
    const { document, preset } = fixture()
    const invalidJson = await generateProjectSource({ project: '{', preset })
    expect(invalidJson).toMatchObject({ success: false, diagnostics: [{ code: 'source_input_invalid', path: ['project'] }] })
    const future = await generateProjectSource({ project: { ...document, version: PROJECT_DOCUMENT_VERSION + 1 }, preset })
    expect(future).toMatchObject({ success: false, diagnostics: [{ code: 'unsupported_contract_version' }] })
    expect(await generateProjectSource({ project: document, preset, surfaceId: 'missing' })).toMatchObject({ success: false, diagnostics: [{ code: 'source_surface_missing', surfaceId: 'missing' }] })
    const mismatch = await generateProjectSource({ project: document, preset: fixture('antd-vue').preset })
    expect(mismatch.success).toBe(false)
    expect(mismatch).not.toHaveProperty('data')
    const reader = { readEmbedded: vi.fn() }
    expect(await generateProjectSource({ project: document, preset, resourceReader: reader, styleTarget: 'scss' } as unknown as GenerateProjectSourceInput)).toMatchObject({ success: false, diagnostics: [{ path: ['styleTarget'] }] })
    expect(reader.readEmbedded).not.toHaveBeenCalled()
  })

  it('contains resolver failures in diagnostics', async () => {
    const { document, preset } = fixture()
    preset.componentResolver.resolveComponent = () => {
      throw new Error('Provider mapping failed.')
    }
    const result = await generateProjectSource({ project: document, preset })
    expect(result).toMatchObject({ success: false, diagnostics: [{ context: { reason: 'Provider mapping failed.' } }] })
    expect(result).not.toHaveProperty('data')
  })

  it('exports a Surface dependency closure while preserving the project image', async () => {
    const { document, preset } = fixture()
    const { reader } = addCover(document)
    document.surfacesById.other = { ...structuredClone(document.surfacesById.home!), id: 'other', name: '其他页面', kind: 'page', route: '/other' }
    document.surfaceOrder.push('other')
    document.datasetOrder = ['unused']
    document.datasetsById.unused = { id: 'unused', name: 'Unused', rows: [{ value: 1 }] }
    document.resources.unused = { id: 'unused', name: 'Unused', kind: 'url', url: '/unused.png' }
    const before = structuredClone(document)
    const selected = selectProjectSourceDocument(document, 'home')
    expect(selected).toMatchObject({ success: true, data: { surfaceOrder: ['home'], datasetOrder: [], datasetsById: {} } })
    if (!selected.success)
      return
    expect(Object.keys(selected.data.resources)).toEqual(['cover'])
    const result = await generateProjectSource({ project: document, preset, resourceReader: reader, surfaceId: 'home', styleTarget: 'tailwind-v4' })
    expect(result.success).toBe(true)
    if (!result.success)
      throw new Error(JSON.stringify(result.diagnostics))
    expect(result.data.files.some(file => file.path.includes('/other/'))).toBe(false)
    expect(document).toEqual(before)
    assertGeneratedVueFilesCompile(result.data)
  })

  it('allocates an export host without replacing a same-named Dialog', () => {
    const { document } = fixture()
    const dialog: ProjectSurface = {
      id: 'export-host-page',
      kind: 'dialog',
      name: '编辑',
      parameters: [],
      outputs: [],
      interactions: [],
      presentation: { kind: 'dialog', title: '编辑', width: { desktop: { value: 480, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
      graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root: [], nodesById: {} },
    }
    document.surfaceOrder.push(dialog.id)
    document.surfacesById[dialog.id] = dialog
    const selected = selectProjectSourceDocument(document, dialog.id)
    expect(selected).toMatchObject({ success: true, data: { homeSurfaceId: 'export-host-page-2', surfaceOrder: ['export-host-page', 'export-host-page-2'] } })
    if (selected.success)
      expect(selected.data.surfacesById[dialog.id]).toEqual(dialog)
  })
})
