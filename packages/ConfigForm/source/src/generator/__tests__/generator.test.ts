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

function scopedFields(nodesById: Record<string, Record<string, unknown>>) {
  return Object.values(nodesById).flatMap(node => node.kind === 'field'
    ? [{
        nodeId: node.id,
        field: node.field,
        ...(Object.hasOwn(node, 'defaultValue') ? { defaultValue: structuredClone(node.defaultValue) } : {}),
      }]
    : [])
}

function compilation(): ProjectCompilation {
  const homeNodes = {
    layout: node({
      id: 'layout',
      kind: 'layout',
      component: 'layout.flex',
      placement: { parentId: null, slot: null, props: {} },
      props: { direction: 'column', gap: 12, ariaLabel: 'Primary "layout" & navigation' },
      slots: { default: ['name', 'status', 'enabled', 'summaryValue', 'mirror', 'clearable', 'guard', 'order', 'logo', 'rows', 'open', 'navigate'] },
    }),
    name: node({
      id: 'name',
      kind: 'field',
      component: 'field.input',
      field: 'name',
      label: 'Name',
      defaultValue: 'Ada',
      validateOn: ['submit'],
      validation: {
        version: 1,
        base: { type: 'string' },
        rules: [
          { kind: 'required', message: 'Name is required' },
          { kind: 'minLength', value: 3, message: 'Name is too short' },
          { kind: 'regex', source: '^[A-Za-z]+$', message: 'Name must contain letters only' },
        ],
      },
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
    rows: node({
      id: 'rows',
      kind: 'element',
      component: 'element.table',
      props: {},
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    enabled: node({
      id: 'enabled',
      kind: 'field',
      component: 'field.input',
      field: 'enabled',
      label: 'Enabled',
      defaultValue: true,
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    summaryValue: node({
      id: 'summaryValue',
      kind: 'field',
      component: 'field.input',
      field: 'summaryValue',
      label: 'Summary',
      defaultValue: 'initial summary',
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    mirror: node({
      id: 'mirror',
      kind: 'field',
      component: 'field.input',
      field: 'mirror',
      label: 'Mirror',
      defaultValue: 'initial mirror',
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    clearable: node({
      id: 'clearable',
      kind: 'field',
      component: 'field.input',
      field: 'clearable',
      label: 'Clearable',
      defaultValue: 'remove me',
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    guard: node({
      id: 'guard',
      kind: 'field',
      component: 'field.input',
      field: 'guard',
      label: 'Guard',
      defaultValue: 1,
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    order: node({
      id: 'order',
      kind: 'field',
      component: 'field.input',
      field: 'order',
      label: 'Order',
      defaultValue: 'initial order',
      validateOn: ['change'],
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    navigate: node({
      id: 'navigate',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Open summary' },
      placement: { parentId: 'layout', slot: 'default', props: {} },
    }),
    profileScope: node({
      id: 'profileScope',
      kind: 'layout',
      component: 'layout.flex',
      props: { direction: 'column' },
      valueScope: { kind: 'object', field: 'profile' },
      slots: { default: ['ordersScope'] },
      placement: { parentId: null, slot: null, props: {} },
    }),
    ordersScope: node({
      id: 'ordersScope',
      kind: 'layout',
      component: 'layout.flex',
      props: { direction: 'column' },
      valueScope: { kind: 'array', field: 'orders', minItems: 2, itemKey: 'id' },
      slots: { default: ['detailsScope'] },
      placement: { parentId: 'profileScope', slot: 'default', props: {} },
    }),
    detailsScope: node({
      id: 'detailsScope',
      kind: 'layout',
      component: 'layout.flex',
      props: { direction: 'column' },
      valueScope: { kind: 'object', field: 'details' },
      slots: { default: ['scopedName'] },
      placement: { parentId: 'ordersScope', slot: 'default', props: {} },
    }),
    scopedName: node({
      id: 'scopedName',
      kind: 'field',
      component: 'field.input',
      field: 'name',
      label: 'Scoped name',
      defaultValue: 'Nested default',
      validateOn: ['change'],
      placement: { parentId: 'detailsScope', slot: 'default', props: {} },
    }),
  }
  const detailsNodes = {
    detailName: node({
      id: 'detailName',
      kind: 'field',
      component: 'field.input',
      field: 'detailName',
      label: 'Detail name',
      defaultValue: 'Grace',
      validateOn: ['change'],
      placement: { parentId: null, slot: null, props: {} },
    }),
    openDrawer: node({
      id: 'openDrawer',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Open drawer' },
      placement: { parentId: null, slot: null, props: {} },
    }),
    save: node({
      id: 'save',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Save' },
      placement: { parentId: null, slot: null, props: {} },
    }),
  }
  const drawerNodes = {
    reopen: node({
      id: 'reopen',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Open nested dialog' },
      placement: { parentId: null, slot: null, props: {} },
    }),
    closeAll: node({
      id: 'closeAll',
      kind: 'element',
      component: 'element.button',
      props: { text: 'Close all' },
      placement: { parentId: null, slot: null, props: {} },
    }),
  }
  const surfacesById = {
    home: {
      id: 'home',
      name: 'Home',
      kind: 'page',
      route: '/home',
      props: {},
      form: {},
      rootIds: ['layout', 'profileScope'],
      nodesById: homeNodes,
      parameters: [],
      outputs: [],
      interactions: [
        {
          kind: 'stateProjection',
          id: 'project-name-required',
          target: { kind: 'state', nodeId: 'name', key: 'required' },
          value: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['enabled'] } },
        },
        {
          kind: 'stateProjection',
          id: 'project-status-visible',
          target: { kind: 'state', nodeId: 'status', key: 'visible' },
          value: { version: 1, ast: { kind: 'reference', scope: 'values', selector: 'parent', path: ['enabled'] } },
        },
        {
          kind: 'stateProjection',
          id: 'project-status-placeholder',
          target: { kind: 'property', nodeId: 'status', path: ['placeholder'] },
          value: {
            version: 1,
            ast: {
              kind: 'conditional',
              test: { kind: 'reference', scope: 'values', path: ['enabled'] },
              consequent: { kind: 'literal', value: 'Choose status' },
              alternate: { kind: 'literal', value: 'Unavailable' },
            },
          },
        },
        {
          kind: 'valueChange',
          id: 'name-to-summary',
          dependencies: ['name'],
          when: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['enabled'] } },
          action: {
            kind: 'set',
            targetFieldId: 'summaryValue',
            value: { version: 1, ast: { kind: 'call', callee: 'upper', args: [{ kind: 'reference', scope: 'values', path: ['name'] }] } },
          },
        },
        {
          kind: 'valueChange',
          id: 'summary-to-mirror',
          dependencies: ['summaryValue'],
          action: { kind: 'copy', sourceFieldId: 'summaryValue', targetFieldId: 'mirror' },
        },
        {
          kind: 'valueChange',
          id: 'status-clears-clearable',
          dependencies: ['status'],
          action: { kind: 'clear', targetFieldId: 'clearable' },
        },
        {
          kind: 'valueChange',
          id: 'name-order-first',
          dependencies: ['name'],
          action: { kind: 'set', targetFieldId: 'order', value: { version: 1, ast: { kind: 'literal', value: 'first' } } },
        },
        {
          kind: 'valueChange',
          id: 'name-order-last',
          dependencies: ['name'],
          action: { kind: 'set', targetFieldId: 'order', value: { version: 1, ast: { kind: 'literal', value: 'last' } } },
        },
        {
          kind: 'valueChange',
          id: 'guard-stages-write',
          dependencies: ['guard'],
          action: { kind: 'set', targetFieldId: 'order', value: { version: 1, ast: { kind: 'literal', value: 'partial' } } },
        },
        {
          kind: 'valueChange',
          id: 'guard-must-be-nonzero',
          dependencies: ['guard'],
          action: {
            kind: 'set',
            targetFieldId: 'mirror',
            value: {
              version: 1,
              ast: {
                kind: 'binary',
                operator: '/',
                left: { kind: 'literal', value: 1 },
                right: { kind: 'reference', scope: 'values', path: ['guard'] },
              },
            },
          },
        },
        {
          kind: 'primaryUiAction',
          id: 'open-details',
          nodeId: 'open',
          trigger: 'activate',
          validate: { scope: 'fields', fieldIds: ['name'] },
          action: {
            kind: 'open',
            targetSurfaceId: 'details',
            parameters: [{ name: 'name', value: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['name'] } } }],
            onResults: [{
              resultName: 'saved',
              assignments: [{ targetFieldId: 'name', value: { version: 1, ast: { kind: 'reference', scope: 'result', path: [] } } }],
            }],
          },
        },
        {
          kind: 'primaryUiAction',
          id: 'go-summary',
          nodeId: 'navigate',
          trigger: 'activate',
          action: { kind: 'navigate', targetSurfaceId: 'summary', parameters: [{ name: 'from', value: { version: 1, ast: { kind: 'literal', value: 'home' } } }] },
        },
        {
          kind: 'primaryUiAction',
          id: 'open-row-details',
          nodeId: 'rows',
          trigger: 'rowActivate',
          action: {
            kind: 'open',
            targetSurfaceId: 'details',
            parameters: [{
              name: 'name',
              value: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['name'] } },
            }],
          },
        },
      ],
      scopedFields: scopedFields(homeNodes).map(field => field.nodeId === 'scopedName'
        ? { ...field, scopeId: 'detailsScope' }
        : field),
      valueScopes: [
        { nodeId: 'profileScope', field: 'profile', kind: 'object' },
        { nodeId: 'ordersScope', field: 'orders', parentId: 'profileScope', kind: 'array', minItems: 2, itemKey: 'id' },
        { nodeId: 'detailsScope', field: 'details', parentId: 'ordersScope', kind: 'object' },
      ],
    },
    details: {
      id: 'details',
      name: 'Details',
      kind: 'dialog',
      props: {},
      form: {},
      rootIds: ['detailName', 'openDrawer', 'save'],
      nodesById: detailsNodes,
      parameters: [{ name: 'name', required: false, defaultValue: 'Anonymous' }],
      outputs: [{ name: 'saved' }],
      interactions: [
        {
          kind: 'primaryUiAction',
          id: 'open-drawer',
          nodeId: 'openDrawer',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'drawer', parameters: [] },
        },
        {
          kind: 'primaryUiAction',
          id: 'save-details',
          nodeId: 'save',
          trigger: 'activate',
          action: { kind: 'closeCurrent', result: { name: 'saved', value: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['detailName'] } } } },
        },
      ],
      scopedFields: scopedFields(detailsNodes),
      valueScopes: [],
      presentation: { kind: 'dialog', title: 'Details', width: { desktop: { value: 480, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
    },
    drawer: {
      id: 'drawer',
      name: 'Drawer',
      kind: 'drawer',
      props: {},
      form: {},
      rootIds: ['reopen', 'closeAll'],
      nodesById: drawerNodes,
      parameters: [],
      outputs: [],
      interactions: [
        {
          kind: 'primaryUiAction',
          id: 'reopen-details',
          nodeId: 'reopen',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'details', parameters: [] },
        },
        {
          kind: 'primaryUiAction',
          id: 'close-all',
          nodeId: 'closeAll',
          trigger: 'activate',
          action: { kind: 'closeAll' },
        },
      ],
      scopedFields: scopedFields(drawerNodes),
      valueScopes: [],
      presentation: { kind: 'drawer', title: 'Drawer', placement: 'right', size: { desktop: { value: 420, unit: 'px' } }, mask: true, close: { escape: true, mask: true, button: true } },
    },
    summary: {
      id: 'summary',
      name: 'Summary',
      kind: 'page',
      route: '/summary',
      props: {},
      form: {},
      rootIds: ['back'],
      nodesById: {
        back: node({ id: 'back', kind: 'element', component: 'element.button', props: { text: 'Back' }, placement: { parentId: null, slot: null, props: {} } }),
      },
      parameters: [{ name: 'from', required: false }],
      outputs: [],
      interactions: [{ kind: 'primaryUiAction', id: 'go-back', nodeId: 'back', trigger: 'activate', action: { kind: 'back' } }],
      scopedFields: [],
      valueScopes: [],
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
      surfaceOrder: ['home', 'details', 'drawer', 'summary'],
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
          semanticListeners: {
            activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'none' } },
            ...(request.componentKey === 'element.table'
              ? { rowActivate: { event: 'row-click', listenerProp: 'onRowClick', item: { kind: 'argument' as const, index: 1 } } }
              : {}),
          },
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

function textAt(fileSet: { files: readonly { kind: string, path: string, content?: string }[] }, path: string): string {
  const file = fileSet.files.find(item => item.path === path)
  if (!file || file.kind !== 'text')
    throw new Error(`Expected generated text file: ${path}`)
  return file.content ?? ''
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
      'package.json',
      'src/App.vue',
      'src/data/datasets.ts',
      'src/data/resources.ts',
      'src/main.ts',
      'src/router.ts',
      'src/demo-navigation.ts',
      'src/demo-values.ts',
      'src/surfaces/home/Surface.vue',
      'src/surfaces/details/Surface.vue',
      'src/surfaces/drawer/Surface.vue',
      'src/surfaces/summary/Surface.vue',
      'src/assets/brand-logo.png',
    ]))
    expect(first.data.files.some(file => file.path.startsWith('src/runtime/'))).toBe(false)
    expect(text(first.data)).not.toMatch(/@moluoxixi\/config-form|prototype-runtime|handlerRegistry|handler registry/)
    expect(text(first.data)).toMatch(/import ElementPlus from ['"]element-plus['"]/)
    expect(text(first.data)).toContain('.use(ElementPlus)')
    expect(text(first.data)).toContain('<el-input')
    expect(text(first.data)).toContain('https://example.com/hero.png')
    const homeSource = textAt(first.data, 'src/surfaces/home/Surface.vue')
    expect(homeSource).toContain('@click="handleOpenDetails"')
    expect(homeSource).not.toContain('handleOpenDetails($event)')
    expect(homeSource).toContain('navigation.open("details"')
    expect(homeSource).toContain('navigation.navigate("summary"')
    expect(homeSource).toContain('@row-click="handleOpenRowDetailsListener"')
    expect(homeSource).toContain('function handleOpenRowDetailsListener(...demoArgs: unknown[]): Promise<void>')
    expect(homeSource).toContain('return handleOpenRowDetails(demoArgs[1])')
    expect(homeSource).not.toContain('@row-click="(...demoArgs')
    expect(homeSource).toContain('readDemoPath(item, ["name"])')
    expect(homeSource).toContain('\'aria-required\': \'true\'')
    expect(homeSource).toContain('demo-field__required')
    expect(homeSource).toContain('reactionProjection.states')
    expect(homeSource).toContain('v-for="(scopeRowOrdersScope, scopeIndexOrdersScope) in demoArray(')
    expect(homeSource).toContain('demoObject(scopeRowOrdersScope[\'details\'], \'detailsScope\')[\'name\']')
    expect(textAt(first.data, 'src/surfaces/details/Surface.vue')).toContain('navigation.closeCurrent({ name: "saved"')
    expect(textAt(first.data, 'src/surfaces/drawer/Surface.vue')).toContain('navigation.closeAll()')
    expect(textAt(first.data, 'src/surfaces/summary/Surface.vue')).toContain('navigation.back()')
    const appSource = textAt(first.data, 'src/App.vue')
    expect(appSource).toContain('<OverlaySurface1 :demo-parameters="overlay.parameters" />')
    expect(appSource).toContain('<dialog')
    const dialogAttributes = appSource.slice(appSource.indexOf('<dialog'), appSource.indexOf('@click.self'))
    expect(dialogAttributes).toContain(':aria-labelledby="\'demo-overlay-title-details-\' + overlay.instanceId"')
    expect(appSource).not.toMatch(/<section[^>]*aria-labelledby/u)
    expect(appSource).toContain('element.showModal()')
    expect(appSource).toContain('@cancel="handleOverlayCancel($event, overlay.instanceId, true)"')
    expect(appSource).toContain('event.preventDefault()')
    expect(appSource).toContain('overlays.at(-1)?.instanceId === instanceId')
    expect(appSource).not.toContain('document.addEventListener')
    const styles = textAt(first.data, 'src/styles.css')
    expect(styles).toContain('width: 100%; height: 100%; max-width: none; max-height: none;')
    expect(styles).toContain('.demo-overlay::backdrop { background: transparent; }')
    const binary = first.data.files.find(file => file.kind === 'binary')
    expect(binary).toMatchObject({ path: 'src/assets/brand-logo.png', contentBase64: 'aGVsbG8=' })
    expect(reader.readEmbedded).toHaveBeenCalledTimes(2)
    expect(reader.readEmbedded).toHaveBeenCalledWith({ projectId: 'demo-project', resourceId: 'brand.logo', contentHash: embeddedHash })
    expect(requests).toContainEqual({ componentKey: 'field.input', contractVersion: '1', contractFingerprint: 'fingerprint:field.input' })

    const manifestFile = first.data.files.find(file => file.path === 'package.json')
    const manifest = JSON.parse(manifestFile?.kind === 'text' ? manifestFile.content : '{}')
    expect(manifest.dependencies).toMatchObject({
      'vue': '3.5.33',
      'vue-router': '^4.6.4',
      'element-plus': '^2.9.0',
      '@moluoxixi/zod3-to-rule': '^0.1.3',
      'zod': '^3.24.2',
    })
    expect(Object.keys(manifest.dependencies)).not.toContain('@moluoxixi/config-form')
    assertGeneratedVueFilesCompile(first.data)
    assertGeneratedRuntimeBoundary(first.data)
    await verifyGeneratedConsumer(first.data)
  }, 30_000)

  it('does not emit a self-redirect when the home page route is root', async () => {
    const rootCompilation = compilation()
    const home = rootCompilation.ir.surfacesById.home as unknown as { route: string }
    home.route = '/'

    const result = await generateVueSource(input({ compilation: rootCompilation }))
    expect(result.success).toBe(true)
    if (!result.success)
      return

    const router = textAt(result.data, 'src/router.ts')
    expect(router).toContain('{ path: "/", name: "home"')
    expect(router).not.toContain('{ path: "/", redirect:')
  })

  it('generates a separate public ConfigForm binding project', async () => {
    const result = await generateConfigFormBindings(input())
    expect(result.success).toBe(true)
    if (!result.success)
      return

    expect(result.data.kind).toBe('config-bindings')
    expect(result.data.entry).toBe('src/bindings.ts')
    expect(result.data.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'package.json',
      'src/bindings.ts',
      'src/host.ts',
      'src/demo-values.ts',
      'src/data/datasets.ts',
      'src/data/resources.ts',
      'src/theme.css',
      'src/surfaces/home/Surface.vue',
      'src/surfaces/home/config.ts',
    ]))
    expect(result.data.files.map(file => file.path)).not.toEqual(expect.arrayContaining([
      'index.html',
      'src/App.vue',
      'src/demo-navigation.ts',
      'src/main.ts',
      'src/router.ts',
      'src/styles.css',
    ]))
    const generated = text(result.data)
    expect(generated).toMatch(/import \{ ElementConfigForm \} from ['"]@moluoxixi\/config-form-element['"]/)
    expect(generated).toMatch(/import \{ createConfigFormModel \} from ['"]@moluoxixi\/config-form-headless['"]/)
    expect(generated).toContain('fields')
    expect(generated).not.toMatch(/src\/runtime|prototype-runtime|handlerRegistry|session reducer|overlay host|createDemoNavigation|useDemoNavigation|provideDemoNavigation/)
    const homeConfig = textAt(result.data, 'src/surfaces/home/config.ts')
    expect(homeConfig).toContain('"onClick": handleOpenDetails')
    expect(homeConfig).toContain('await validation.validate({"fieldIds":["name"],"scope":"fields","surfaceId":"home"})')
    expect(homeConfig).toMatch(/import \{ compileRules \} from ['"]@moluoxixi\/zod3-to-rule['"]/)
    expect(homeConfig).toContain('schema: compiledValidation1.schema')
    expect(homeConfig).toContain('valueScope: {')
    expect(homeConfig).toContain('"minItems": 2')
    expect(homeConfig).toContain('actions.open("details"')
    expect(homeConfig).toContain('function handleOpenRowDetailsListener(...demoArgs: unknown[]): Promise<void>')
    expect(homeConfig).toContain('return handleOpenRowDetails(demoArgs[1])')
    expect(homeConfig).toContain('"onRowClick": handleOpenRowDetailsListener')
    expect(homeConfig).not.toContain('"onRowClick": (...demoArgs')
    expect(homeConfig).toContain('readDemoPath(item, ["name"])')
    expect(homeConfig).toContain('"onUpdate:modelValue": handleHomeNameValueChange')
    expect(homeConfig).not.toContain('navigation.')
    expect(textAt(result.data, 'src/bindings.ts')).toContain('import "@moluoxixi/config-form-element/styles"')
    const homeSurface = textAt(result.data, 'src/surfaces/home/Surface.vue')
    expect(homeSurface).toContain('actions: ConfigBindingActions')
    expect(homeSurface).toContain('validation: ConfigBindingValidation')
    expect(homeSurface).toContain('const validation: ConfigBindingValidation')
    expect(homeSurface).toContain('form.validateInstance(instance.address)')
    expect(homeSurface).toContain('actions: surfaceProps.actions, validation')
    expect(homeSurface).not.toContain('surfaceProps.validation')
    expect(homeSurface).toContain(':reaction-projection="reactionProjection"')
    expect(textAt(result.data, 'src/surfaces/details/config.ts')).toContain('"onClick": handleSaveDetails')
    expect(textAt(result.data, 'src/surfaces/details/config.ts')).toContain('actions.closeCurrent({ name: "saved"')
    expect(textAt(result.data, 'src/surfaces/drawer/config.ts')).toContain('actions.closeAll()')
    expect(textAt(result.data, 'src/bindings.ts')).toContain('createFields as createHomeFields')
    const manifestFile = result.data.files.find(file => file.path === 'package.json')
    const manifest = JSON.parse(manifestFile?.kind === 'text' ? manifestFile.content : '{}')
    expect(manifest.dependencies).not.toHaveProperty('vue-router')
    expect(manifest.dependencies).toHaveProperty('@moluoxixi/zod3-to-rule', '^0.1.3')
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

  it('fails both source modes without partial files when a custom validator implementation is missing', async () => {
    const invalidCompilation = compilation()
    const name = invalidCompilation.ir.surfacesById.home?.nodesById.name as unknown as { validation: unknown }
    name.validation = {
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'custom', key: 'missing-source-validator' }],
    }

    const [raw, bindings] = await Promise.all([
      generateVueSource(input({ compilation: invalidCompilation })),
      generateConfigFormBindings(input({ compilation: invalidCompilation })),
    ])
    for (const result of [raw, bindings]) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [{
          code: 'source_input_invalid',
          context: {
            reason: 'rule_diagnostic',
            ruleDiagnostic: { code: 'RULE_CUSTOM_VALIDATOR_MISSING', severity: 'error' },
          },
        }],
      })
      expect('data' in result).toBe(false)
    }
  })

  it('fails closed before emitting files when value rules contain a cycle', async () => {
    const cyclicCompilation = compilation()
    const home = cyclicCompilation.ir.surfacesById.home!
    ;(home.interactions as unknown as unknown[]).push({
      kind: 'valueChange',
      id: 'mirror-to-name-cycle',
      dependencies: ['mirror'],
      action: { kind: 'copy', sourceFieldId: 'mirror', targetFieldId: 'name' },
    })

    const raw = await generateVueSource(input({ compilation: cyclicCompilation }))
    const bindings = await generateConfigFormBindings(input({ compilation: cyclicCompilation }))
    expect(raw).toMatchObject({ success: false, diagnostics: [{ code: 'source_input_invalid' }] })
    expect(bindings).toMatchObject({ success: false, diagnostics: [{ code: 'source_input_invalid' }] })
    if (!raw.success)
      expect(raw.diagnostics[0]?.context?.reason).toContain('contain a cycle')
  })

  it('fails closed when a handler requires an unavailable nested value scope', async () => {
    const invalidCompilation = compilation()
    const home = invalidCompilation.ir.surfacesById.home!
    const layout = home.nodesById.layout as unknown as { valueScope?: unknown }
    layout.valueScope = { kind: 'object', field: 'row' }
    const interaction = home.interactions.find(item => item.kind === 'primaryUiAction') as unknown as {
      action: { parameters: { name: string, value: unknown }[] }
    }
    interaction.action.parameters = [{
      name: 'name',
      value: {
        version: 1,
        ast: { kind: 'reference', scope: 'values', selector: 'parent', path: ['name'] },
      },
    }]

    const raw = await generateVueSource(input({ compilation: invalidCompilation }))
    expect(raw.success).toBe(false)
    if (!raw.success) {
      expect(raw.diagnostics[0]).toMatchObject({ code: 'source_input_invalid' })
      expect(raw.diagnostics[0]?.context?.reason).toContain('scoped values')
    }

    const bindings = await generateConfigFormBindings(input({ compilation: invalidCompilation }))
    expect(bindings.success).toBe(false)
    if (!bindings.success)
      expect(bindings.diagnostics[0]).toMatchObject({ code: 'source_input_invalid' })
  })
})
