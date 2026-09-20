import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ContractResult,
  DatasetProjection,
  DatasetViewQuery,
  ModelJsonObject,
  ProjectDataset,
  ProjectDocument,
  ProjectTheme,
} from '@moluoxixi/config-form-model'
import type {
  GenerateConfigFormBindingsInput,
  GenerateVueSourceInput,
  RawSourceFileSetV1,
  SourceComponentRequest,
  SourceComponentResolver,
  SourceConfigFormBindingResolver,
  SourceResourceReader,
  SourceStyleTarget,
} from '../types'
import { createHash } from 'node:crypto'
import { CANONICAL_PROJECT_IR_VERSION } from '@moluoxixi/config-form-compiler'
import {
  getProjectDocumentContentHash,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  queryDatasetView,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
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

type TestProviderId = 'antd-vue' | 'element-plus'

function projectSnapshot(providerId: TestProviderId): ProjectCompilation['snapshot'] {
  const components = {}
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'demo-project',
    name: 'Source Demo',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: {},
          root: [],
          nodesById: {},
        },
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: {
      adapter: providerId,
      version: '3',
      fingerprint: registryLockFingerprint(components),
      components,
    },
    settings: {},
  }
  return {
    document,
    editVersion: 1,
    contentHash: getProjectDocumentContentHash(document),
  }
}

function compilation(providerId: TestProviderId = 'element-plus'): ProjectCompilation {
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
      required: true,
      requiredMessage: 'Name is required',
      validateOn: ['blur', 'submit'],
      validation: {
        version: 2,
        base: { type: 'string' },
        rules: [
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
    registryAdapter: providerId,
    registryAdapterVersion: '3',
    registryFingerprint: 'sha256:registry',
    compilerVersion: '8.0.0',
    environmentHash: 'sha256:environment',
    irHash: 'sha256:ir',
  }
  return {
    snapshot: projectSnapshot(providerId),
    registry: {},
    origin: { kind: 'committed', editVersion: 1 },
    key,
    ir: {
      version: CANONICAL_PROJECT_IR_VERSION,
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

const DELETE_COMPILATION_VALUE = Symbol('delete-compilation-value')

function compilationWithValue(
  path: readonly string[],
  value: unknown | typeof DELETE_COMPILATION_VALUE,
): ProjectCompilation {
  const candidate = structuredClone(compilation()) as unknown as Record<string, unknown>
  let parent = candidate
  for (const segment of path.slice(0, -1)) {
    const child = parent[segment]
    if (!child || typeof child !== 'object' || Array.isArray(child))
      throw new TypeError(`Cannot mutate compilation path: ${path.join('.')}`)
    parent = child as Record<string, unknown>
  }
  const key = path.at(-1)
  if (!key)
    throw new TypeError('Compilation mutation path cannot be empty.')
  if (value === DELETE_COMPILATION_VALUE)
    delete parent[key]
  else
    parent[key] = value
  return candidate as unknown as ProjectCompilation
}

function componentResolver(
  requests: SourceComponentRequest[] = [],
  providerId: TestProviderId = 'element-plus',
): SourceComponentResolver {
  const isAntd = providerId === 'antd-vue'
  const uiPackage = isAntd ? 'ant-design-vue' : 'element-plus'
  const plugin = isAntd ? 'Antd' : 'ElementPlus'
  const stylesheet = isAntd ? 'ant-design-vue/dist/reset.css' : 'element-plus/dist/index.css'
  const version = isAntd ? '^4.2.6' : '^2.9.0'
  return {
    adapter: { adapter: providerId, adapterVersion: '3', registryFingerprint: 'sha256:registry' },
    resolveComponent(request) {
      requests.push(request)
      const render = request.componentKey === 'layout.flex'
        ? 'layout-flex'
        : request.componentKey === 'element.table'
          ? 'dataset-table'
          : request.componentKey === 'element.list'
            ? 'dataset-list'
            : 'component'
      const isNative = render !== 'component'
      const dependencies: Readonly<Record<string, string>> = isNative
        ? {}
        : { [uiPackage]: version }
      return {
        success: true,
        value: {
          moduleSpecifier: isNative ? '' : uiPackage,
          importName: isNative ? '' : plugin,
          tag: isNative
            ? 'div'
            : request.componentKey === 'field.input'
              ? (isAntd ? 'a-input' : 'el-input')
              : request.componentKey === 'field.select'
                ? (isAntd ? 'a-select' : 'el-select')
                : request.componentKey === 'element.image'
                  ? (isAntd ? 'a-image' : 'el-image')
                  : request.componentKey === 'element.table'
                    ? (isAntd ? 'a-table' : 'el-table')
                    : (isAntd ? 'a-button' : 'el-button'),
          configComponent: request.componentKey,
          render,
          styleImports: isNative ? [] : [stylesheet],
          dependencies,
          semanticListeners: {
            activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'none' } },
            ...(request.componentKey === 'element.table'
              ? { rowActivate: { event: 'row-click', listenerProp: 'onRowClick', item: { kind: 'argument' as const, index: 0 } } }
              : {}),
            ...(request.componentKey === 'element.list'
              ? { itemActivate: { event: 'item-click', listenerProp: 'onItemClick', item: { kind: 'argument' as const, index: 0 } } }
              : {}),
          },
          ...(isNative ? {} : { library: { packageName: uiPackage, plugin, version, stylesheet } }),
          ...(request.componentKey === 'field.select' ? { options: { mode: 'prop' as const } } : {}),
          ...(request.componentKey.startsWith('field.')
            ? {
                valueProp: isAntd ? 'value' : 'modelValue',
                trigger: isAntd ? 'update:value' : 'update:modelValue',
                blurTrigger: 'blur',
              }
            : {}),
        },
      }
    },
  }
}

function bindingResolver(): SourceConfigFormBindingResolver {
  return {
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

function rawInput(overrides: Partial<GenerateVueSourceInput> = {}): GenerateVueSourceInput {
  return {
    compilation: compilation(),
    componentResolver: componentResolver(),
    resourceReader: resourceReader(),
    ...overrides,
  }
}

function bindingInput(
  overrides: Partial<GenerateConfigFormBindingsInput> = {},
): GenerateConfigFormBindingsInput {
  return {
    ...rawInput(),
    bindingResolver: bindingResolver(),
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

function generatedConst(
  fileSet: { files: readonly { kind: string, path: string, content?: string }[] },
  path: string,
  name: string,
): unknown {
  const source = textAt(fileSet, path)
  const prefix = `export const ${name} = `
  const start = source.indexOf(prefix)
  const end = source.indexOf(' as const', start + prefix.length)
  if (start < 0 || end < 0)
    throw new Error(`Expected generated const ${name} in ${path}.`)
  return JSON.parse(source.slice(start + prefix.length, end))
}

describe('source generators', () => {
  it('generates deterministic raw Vue source that directly uses provider UI', async () => {
    const requests: SourceComponentRequest[] = []
    const reader = resourceReader()
    const sourceInput = rawInput({ componentResolver: componentResolver(requests), resourceReader: reader })
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
      'src/components/DemoDatasetTable.vue',
      'src/data/datasets.ts',
      'src/data/resources.ts',
      'src/main.ts',
      'src/router.ts',
      'src/demo-navigation.ts',
      'src/demo-values.ts',
      'src/surfaces/home/Surface.vue',
      'src/surfaces/home/validation.ts',
      'src/surfaces/details/Surface.vue',
      'src/surfaces/details/validation.ts',
      'src/surfaces/drawer/Surface.vue',
      'src/surfaces/summary/Surface.vue',
      'src/assets/brand-logo.png',
    ]))
    expect(first.data.files.some(file => file.path.startsWith('src/runtime/'))).toBe(false)
    expect(text(first.data)).not.toMatch(/@moluoxixi\/|@config-form\/|(?:^|[/'"])zod(?:[/'"]|$)|prototype-runtime|handlerRegistry|handler registry/m)
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
    expect(homeSource).toContain('return handleOpenRowDetails(demoArgs[0])')
    expect(homeSource).not.toContain('@row-click="(...demoArgs')
    expect(homeSource).toContain('readDemoPath(item, ["name"])')
    expect(homeSource).toContain('\'aria-required\': \'true\'')
    expect(homeSource).toContain('demo-field__required')
    expect(homeSource).toContain('reactionProjection.states')
    expect(homeSource).toContain('import { demoFieldValidators, type DemoFieldValidator } from \'./validation.ts\'')
    expect(homeSource).toContain('@blur="void validateDemoFields([\'name\'])"')
    expect(homeSource).toMatch(/validateOn: \[\s*"blur",\s*"submit"\s*\]/u)
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
    expect(manifest.dependencies).toEqual({
      'vue': '3.5.33',
      'vue-router': '^4.6.4',
      'element-plus': '^2.9.0',
    })
    const validationSource = textAt(first.data, 'src/surfaces/home/validation.ts')
    expect(validationSource).toContain('export function validateName(')
    expect(validationSource).toContain('new RegExp("^[A-Za-z]+$", "")')
    expect(validationSource).not.toMatch(/compileRules|RuleSet|@moluoxixi|\bzod\b/)
    assertGeneratedVueFilesCompile(first.data)
    assertGeneratedRuntimeBoundary(first.data)
    await verifyGeneratedConsumer(first.data)
  }, 30_000)

  it('does not emit a self-redirect when the home page route is root', async () => {
    const rootCompilation = compilation()
    const home = rootCompilation.ir.surfacesById.home as unknown as { route: string }
    home.route = '/'

    const result = await generateVueSource(rawInput({ compilation: rootCompilation }))
    expect(result.success).toBe(true)
    if (!result.success)
      return

    const router = textAt(result.data, 'src/router.ts')
    expect(router).toContain('{ path: "/", name: "home"')
    expect(router).not.toContain('{ path: "/", redirect:')
  })

  it('builds standalone Ant Design Vue source with the same dependency boundary', async () => {
    const result = await generateVueSource(rawInput({
      compilation: compilation('antd-vue'),
      componentResolver: componentResolver([], 'antd-vue'),
    }))
    expect(result.success).toBe(true)
    if (!result.success)
      return

    const manifest = JSON.parse(textAt(result.data, 'package.json')) as {
      dependencies: Record<string, string>
    }
    expect(manifest.dependencies).toEqual({
      'ant-design-vue': '^4.2.6',
      'vue': '3.5.33',
      'vue-router': '^4.6.4',
    })
    expect(textAt(result.data, 'src/main.ts')).toContain('.use(Antd)')
    expect(textAt(result.data, 'src/surfaces/home/Surface.vue')).toContain('<a-input')
    assertGeneratedVueFilesCompile(result.data)
    assertGeneratedRuntimeBoundary(result.data)
    await verifyGeneratedConsumer(result.data)
  }, 30_000)

  it('generates a separate public ConfigForm binding project', async () => {
    const result = await generateConfigFormBindings(bindingInput())
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
    ]))
    expect(textAt(result.data, 'src/bindings.ts')).toContain('import \'./styles.css\'')
    const generated = text(result.data)
    expect(generated).toMatch(/import \{ ElementConfigForm \} from ['"]@moluoxixi\/config-form-element['"]/)
    expect(generated).toMatch(/import \{ createConfigFormModel \} from ['"]@moluoxixi\/config-form-headless['"]/)
    expect(generated).toContain('fields')
    expect(generated).not.toMatch(/src\/runtime|prototype-runtime|handlerRegistry|session reducer|overlay host|createDemoNavigation|useDemoNavigation|provideDemoNavigation/)
    const homeConfig = textAt(result.data, 'src/surfaces/home/config.ts')
    expect(homeConfig).toContain('"onClick": handleOpenDetails')
    expect(homeConfig).toContain('await validation.validate({"fieldIds":["name"],"scope":"fields","surfaceId":"home"})')
    expect(homeConfig).toMatch(/import \{ compileRules \} from ['"]@moluoxixi\/zod3-to-rule['"]/)
    expect(homeConfig).toContain('required: true')
    expect(homeConfig).toContain('requiredMessage: "Name is required"')
    expect(homeConfig).toContain('schema: compiledValidation1.schema')
    expect(homeConfig).toContain('valueScope: {')
    expect(homeConfig).toContain('"minItems": 2')
    expect(homeConfig).toContain('actions.open("details"')
    expect(homeConfig).toContain('function handleOpenRowDetailsListener(...demoArgs: unknown[]): Promise<void>')
    expect(homeConfig).toContain('return handleOpenRowDetails(demoArgs[0])')
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

  it('normalizes CSS defaults and fails closed for invalid style targets in both APIs', async () => {
    const [implicitRaw, explicitRaw, implicitBinding, explicitBinding] = await Promise.all([
      generateVueSource(rawInput()),
      generateVueSource(rawInput({ styleTarget: 'css' })),
      generateConfigFormBindings(bindingInput()),
      generateConfigFormBindings(bindingInput({ styleTarget: 'css' })),
    ])
    expect(implicitRaw).toEqual(explicitRaw)
    expect(implicitBinding).toEqual(explicitBinding)

    const [invalidRaw, invalidBinding] = await Promise.all([
      generateVueSource(rawInput({ styleTarget: 'less' as SourceStyleTarget })),
      generateConfigFormBindings(bindingInput({ styleTarget: 'less' as SourceStyleTarget })),
    ])
    for (const invalid of [invalidRaw, invalidBinding]) {
      expect(invalid).toMatchObject({
        success: false,
        diagnostics: [{ code: 'source_input_invalid', context: { path: ['styleTarget'] } }],
      })
      expect('data' in invalid).toBe(false)
    }
  })

  it('uses the shared queried Dataset view for Raw and Config Binding output', async () => {
    const datasetCompilation = compilation()
    const dataset: ProjectDataset = {
      id: 'statuses',
      name: 'Statuses',
      rows: [
        { value: 'draft', label: { second: 2, first: 1 }, rowKey: 'row-a', title: 'Alpha', description: 'Second', active: true, rank: 2 },
        { value: 2, label: true, rowKey: 'row-b', title: 'Beta', description: 'Hidden', active: false, rank: 4 },
        { value: 'review', label: 'Review', rowKey: 'row-c', title: 'Gamma', description: 'Third', active: true, rank: 1 },
        { value: 'done', label: 'Done', rowKey: 'row-d', title: 'Delta', description: 'First', active: true, rank: 3 },
      ],
    }
    const datasetsById = datasetCompilation.ir.datasetsById as Record<string, ProjectDataset>
    datasetsById.statuses = dataset
    const nodes = datasetCompilation.ir.surfacesById.home!.nodesById as unknown as Record<string, {
      component: string
      componentFingerprint: string
      datasetBindings?: Record<string, { datasetId: string, projection: DatasetProjection, query?: DatasetViewQuery }>
      resourceBindings?: Record<string, unknown>
    }>
    const query: DatasetViewQuery = {
      filter: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['active'] } },
      sort: [{ path: ['rank'], direction: 'desc' }],
      page: { index: 0, size: 2 },
    }
    const projections = {
      options: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
      table: {
        kind: 'table',
        rowKeyPath: ['rowKey'],
        columns: [
          { key: 'value', valuePath: ['value'] },
          { key: 'missing', valuePath: ['missing'] },
        ],
      },
      list: {
        kind: 'list',
        itemKeyPath: ['rowKey'],
        titlePath: ['title'],
        descriptionPath: ['description'],
      },
    } satisfies Record<string, DatasetProjection>
    nodes.status!.datasetBindings = { options: { datasetId: dataset.id, projection: projections.options, query } }
    nodes.rows!.datasetBindings = { rows: { datasetId: dataset.id, projection: projections.table, query } }
    nodes.logo!.component = 'element.list'
    nodes.logo!.componentFingerprint = 'fingerprint:element.list'
    delete nodes.logo!.resourceBindings
    nodes.logo!.datasetBindings = { items: { datasetId: dataset.id, projection: projections.list, query } }

    const [raw, binding] = await Promise.all([
      generateVueSource(rawInput({ compilation: datasetCompilation })),
      generateConfigFormBindings(bindingInput({ compilation: datasetCompilation })),
    ])
    expect(raw.success).toBe(true)
    expect(binding.success).toBe(true)
    if (!raw.success || !binding.success)
      return
    const rawViews = generatedConst(raw.data, 'src/data/datasets.ts', 'datasetViews') as Record<string, unknown>
    const bindingViews = generatedConst(binding.data, 'src/data/datasets.ts', 'datasetViews') as Record<string, unknown>
    for (const [viewKey, projection] of [
      ['home/status/options', projections.options],
      ['home/rows/rows', projections.table],
      ['home/logo/items', projections.list],
    ] as const) {
      const projected = queryDatasetView(dataset, projection, query)
      expect(projected.success).toBe(true)
      if (projected.success) {
        expect(rawViews[viewKey]).toEqual(projected.data)
        expect(bindingViews[viewKey]).toEqual(projected.data)
      }
    }
    expect(raw.data.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'src/components/DemoDatasetList.vue',
      'src/components/DemoDatasetTable.vue',
    ]))
    const rawSurface = textAt(raw.data, 'src/surfaces/home/Surface.vue')
    expect(rawSurface).toContain('import DemoDatasetList')
    expect(rawSurface).toContain('import DemoDatasetTable')
    expect(rawSurface).toContain('datasetViews[\'home/rows/rows\'].items')
    expect(rawSurface).toContain('datasetViews[\'home/rows/rows\'].total')
    expect(rawSurface).toContain('datasetViews[\'home/logo/items\'].items')
    expect(rawSurface).toContain('datasetViews[\'home/logo/items\'].total')
    expect(binding.data.files.some(file => file.path.startsWith('src/components/DemoDataset'))).toBe(false)
    const bindingConfig = textAt(binding.data, 'src/surfaces/home/config.ts')
    expect(bindingConfig).toContain('datasetViews[\'home/rows/rows\'].items')
    expect(bindingConfig).toContain('datasetViews[\'home/rows/rows\'].total')
    expect(bindingConfig).toContain('datasetViews[\'home/logo/items\'].items')
    expect(bindingConfig).toContain('datasetViews[\'home/logo/items\'].total')
    assertGeneratedVueFilesCompile(raw.data)
    assertGeneratedVueFilesCompile(binding.data)
  })

  it('propagates shared Dataset projection failures from both APIs without reading resources', async () => {
    const invalidCompilation = compilation()
    const statuses = invalidCompilation.ir.datasetsById.statuses as unknown as { rows: ModelJsonObject[] }
    statuses.rows = [
      { label: 'First', value: 'duplicate' },
      { label: 'Second', value: 'duplicate' },
    ]
    const rawReader = resourceReader()
    const bindingReader = resourceReader()
    const [raw, binding] = await Promise.all([
      generateVueSource(rawInput({ compilation: invalidCompilation, resourceReader: rawReader })),
      generateConfigFormBindings(bindingInput({ compilation: invalidCompilation, resourceReader: bindingReader })),
    ])
    for (const result of [raw, binding]) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [{ code: 'dataset_projection_invalid', datasetId: 'statuses', context: { reason: 'option_value_duplicate' } }],
      })
      expect('data' in result).toBe(false)
    }
    expect(rawReader.readEmbedded).not.toHaveBeenCalled()
    expect(bindingReader.readEmbedded).not.toHaveBeenCalled()
  })

  it('emits deterministic Tailwind v4 projects with complete theme and semantic parity', async () => {
    const themedCompilation = compilation()
    const themedIr = themedCompilation.ir as { theme: ProjectTheme }
    const themedLayout = themedCompilation.ir.surfacesById.home!.nodesById.layout as unknown as {
      props: Record<string, unknown>
    }
    themedLayout.props = {
      ...themedLayout.props,
      align: 'flex-start',
      justify: 'flex-end',
    }
    themedIr.theme = {
      version: PROJECT_THEME_VERSION,
      colors: { warning: '#F59E0B', canvas: '#F5F7FA', primary: '#336699' },
      typography: {
        family: 'monospace',
        baseSize: 15,
        lineHeight: 1.6,
        bodyWeight: 500,
        headingWeight: 700,
      },
      spacing: { xl: 32, xs: 4, md: 16 },
      border: { width: 2, style: 'dashed' },
      radius: { lg: 12, sm: 4, md: 8 },
      shadows: {
        sm: { x: 0, y: 1, blur: 3, spread: 0, color: '#112233' },
        lg: { x: 0, y: 18, blur: 48, spread: -2, color: 'rgb(15 23 42 / 22%)' },
      },
    }
    const [cssRaw, firstRaw, secondRaw, cssBinding, firstBinding, secondBinding] = await Promise.all([
      generateVueSource(rawInput({ compilation: themedCompilation })),
      generateVueSource(rawInput({ compilation: themedCompilation, styleTarget: 'tailwind-v4' })),
      generateVueSource(rawInput({ compilation: themedCompilation, styleTarget: 'tailwind-v4' })),
      generateConfigFormBindings(bindingInput({ compilation: themedCompilation })),
      generateConfigFormBindings(bindingInput({ compilation: themedCompilation, styleTarget: 'tailwind-v4' })),
      generateConfigFormBindings(bindingInput({ compilation: themedCompilation, styleTarget: 'tailwind-v4' })),
    ])
    expect(firstRaw).toEqual(secondRaw)
    expect(firstBinding).toEqual(secondBinding)
    expect(cssRaw.success && firstRaw.success && cssBinding.success && firstBinding.success).toBe(true)
    if (!cssRaw.success || !firstRaw.success || !cssBinding.success || !firstBinding.success)
      return

    const manifest = JSON.parse(textAt(firstRaw.data, 'package.json')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(manifest.dependencies).not.toHaveProperty('tailwindcss')
    expect(manifest.dependencies).not.toHaveProperty('@tailwindcss/vite')
    expect(manifest.devDependencies).toMatchObject({ '@tailwindcss/vite': '^4.1.13', 'tailwindcss': '^4.1.13' })
    expect(textAt(firstRaw.data, 'vite.config.ts')).toContain('import Tailwind from \'@tailwindcss/vite\'')
    expect(textAt(firstRaw.data, 'src/styles.css')).toContain('@import \'tailwindcss\'')
    const homeSurface = textAt(firstRaw.data, 'src/surfaces/home/Surface.vue')
    expect(homeSurface).toContain('mx-auto w-[min(960px,calc(100%_-_32px))]')
    expect(homeSurface).toContain('items-start justify-end')
    const appSource = textAt(firstRaw.data, 'src/App.vue')
    expect(appSource).toContain('[&[open]]:grid')
    expect(appSource).toContain('[&_.demo-surface]:w-full')

    const theme = textAt(firstRaw.data, 'src/theme.css')
    expect(theme).toContain('--demo-font-family: ui-monospace, monospace;')
    expect(theme).toContain('--demo-font-size: 15px;')
    expect(theme).toContain('--demo-line-height: 1.6;')
    expect(theme).toContain('--demo-font-body-weight: 500;')
    expect(theme).toContain('--demo-font-heading-weight: 700;')
    expect(theme).toContain('--demo-border-width: 2px;')
    expect(theme).toContain('--demo-border-style: dashed;')
    expect(theme).toContain('--demo-radius-lg: 12px;')
    expect(theme).toContain('--demo-shadow-lg: 0px 18px 48px -2px rgb(15 23 42 / 22%);')
    expect(theme).toContain('@theme inline {')
    expect(theme).toContain('--font-body: var(--demo-font-family);')
    expect(theme).toContain('--text-base: var(--demo-font-size);')
    expect(theme).toContain('--leading-normal: var(--demo-line-height);')
    expect(theme).toContain('--font-weight-body: var(--demo-font-body-weight);')
    expect(theme).toContain('--font-weight-heading: var(--demo-font-heading-weight);')
    expect(theme).toContain('--border-width-demo: var(--demo-border-width);')
    expect(theme).toContain('--border-style-demo: var(--demo-border-style);')
    expect(theme).toContain('--shadow-sm: var(--demo-shadow-sm);')

    const cssTheme = textAt(cssRaw.data, 'src/theme.css')
    expect(cssTheme).toContain('--demo-font-family: ui-monospace, monospace;')
    expect(cssTheme).toContain('--demo-font-body-weight: 500;')
    expect(cssTheme).toContain('--demo-font-heading-weight: 700;')
    expect(cssTheme).toContain('--demo-border-width: 2px;')
    expect(cssTheme).toContain('--demo-border-style: dashed;')
    expect(cssTheme).toContain('--demo-shadow-lg: 0px 18px 48px -2px rgb(15 23 42 / 22%);')
    expect(cssTheme).not.toContain('@theme')
    expect(textAt(cssRaw.data, 'src/styles.css')).toContain('font-family: var(--demo-font-family')

    expect(textAt(firstBinding.data, 'src/bindings.ts')).toContain('import \'./styles.css\'')
    expect(textAt(firstBinding.data, 'src/surfaces/home/config.ts')).toContain('fieldAttrs')
    expect(textAt(firstBinding.data, 'vite.config.ts')).toContain('import Tailwind from \'@tailwindcss/vite\'')
    for (const path of ['src/data/datasets.ts', 'src/data/resources.ts', 'src/demo-values.ts', 'src/demo-navigation.ts', 'src/router.ts'])
      expect(textAt(firstRaw.data, path)).toBe(textAt(cssRaw.data, path))
    for (const path of ['src/data/datasets.ts', 'src/data/resources.ts', 'src/demo-values.ts', 'src/host.ts'])
      expect(textAt(firstBinding.data, path)).toBe(textAt(cssBinding.data, path))
  })

  it('typechecks and builds Element Plus Raw and ConfigForm binding Tailwind consumers', async () => {
    const [raw, binding] = await Promise.all([
      generateVueSource(rawInput({ styleTarget: 'tailwind-v4' })),
      generateConfigFormBindings(bindingInput({ styleTarget: 'tailwind-v4' })),
    ])
    expect(raw.success && binding.success).toBe(true)
    if (!raw.success || !binding.success)
      return
    assertGeneratedVueFilesCompile(raw.data)
    assertGeneratedRuntimeBoundary(raw.data)
    assertGeneratedVueFilesCompile(binding.data)
    assertGeneratedRuntimeBoundary(binding.data)
    await verifyGeneratedConsumer(raw.data)
    await verifyGeneratedConsumer(binding.data)
  }, 30_000)

  it('typechecks and builds an Ant Design Vue Raw Tailwind consumer', async () => {
    const result = await generateVueSource(rawInput({
      compilation: compilation('antd-vue'),
      componentResolver: componentResolver([], 'antd-vue'),
      styleTarget: 'tailwind-v4',
    }))
    expect(result.success).toBe(true)
    if (!result.success)
      return
    assertGeneratedVueFilesCompile(result.data)
    assertGeneratedRuntimeBoundary(result.data)
    await verifyGeneratedConsumer(result.data)
  }, 30_000)

  it.each([
    { label: 'an old ProjectDocument version', path: ['snapshot', 'document', 'version'], value: PROJECT_DOCUMENT_VERSION - 1 },
    { label: 'a future ProjectDocument version', path: ['snapshot', 'document', 'version'], value: PROJECT_DOCUMENT_VERSION + 1 },
    { label: 'a missing ProjectDocument version', path: ['snapshot', 'document', 'version'], value: DELETE_COMPILATION_VALUE },
    { label: 'an old SurfaceGraph version', path: ['snapshot', 'document', 'surfacesById', 'home', 'graph', 'version'], value: SURFACE_GRAPH_VERSION - 1 },
    { label: 'a future SurfaceGraph version', path: ['snapshot', 'document', 'surfacesById', 'home', 'graph', 'version'], value: SURFACE_GRAPH_VERSION + 1 },
    { label: 'a missing SurfaceGraph version', path: ['snapshot', 'document', 'surfacesById', 'home', 'graph', 'version'], value: DELETE_COMPILATION_VALUE },
    { label: 'an old Canonical Project IR version', path: ['ir', 'version'], value: CANONICAL_PROJECT_IR_VERSION - 1 },
    { label: 'a future Canonical Project IR version', path: ['ir', 'version'], value: CANONICAL_PROJECT_IR_VERSION + 1 },
    { label: 'a missing Canonical Project IR version', path: ['ir', 'version'], value: DELETE_COMPILATION_VALUE },
    { label: 'an old compiler key version', path: ['key', 'compilerVersion'], value: '6.0.0' },
    { label: 'mixed compiler versions', path: ['ir', 'identity', 'compilerVersion'], value: '6.0.0' },
    { label: 'a missing compiler identity version', path: ['ir', 'identity', 'compilerVersion'], value: DELETE_COMPILATION_VALUE },
    { label: 'a future Canonical Surface field', path: ['ir', 'surfacesById', 'home', 'futureContractField'], value: true },
  ])('rejects $label in both source modes without partial files', async ({ path, value }) => {
    const invalidCompilation = compilationWithValue(path, value)
    const [raw, bindings] = await Promise.all([
      generateVueSource(rawInput({ compilation: invalidCompilation })),
      generateConfigFormBindings(bindingInput({ compilation: invalidCompilation })),
    ])

    for (const result of [raw, bindings]) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [{ code: 'source_input_invalid' }],
      })
      expect('data' in result).toBe(false)
    }
  })

  it('fails closed on adapter identity or component resolution failures', async () => {
    const mismatched = componentResolver()
    Object.assign(mismatched.adapter, { registryFingerprint: 'sha256:other' })
    const adapterResult = await generateVueSource(rawInput({ componentResolver: mismatched }))
    expect(adapterResult.success).toBe(false)
    if (!adapterResult.success)
      expect(adapterResult.diagnostics[0]?.code).toBe('source_resolution_failed')

    const unresolved = componentResolver()
    unresolved.resolveComponent = () => ({ success: false, reason: 'not published' })
    const componentResult = await generateVueSource(rawInput({ componentResolver: unresolved }))
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
    const missing = await generateVueSource(rawInput({ resourceReader: missingReader }))
    expect(missing.success).toBe(false)
    if (!missing.success)
      expect(missing.diagnostics[0]?.code).toBe('source_resource_read_failed')

    const corrupt = await generateVueSource(rawInput({ resourceReader: resourceReader(new TextEncoder().encode('wrong')) }))
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
    const readResult = await generateVueSource(rawInput({ resourceReader: throwing }))
    expect(readResult.success).toBe(false)
    if (!readResult.success)
      expect(readResult.diagnostics[0]?.code).toBe('source_resource_read_failed')

    const nonPortable = componentResolver()
    const resolve = nonPortable.resolveComponent
    nonPortable.resolveComponent = (request) => {
      const result = resolve(request)
      return result.success
        ? { ...result, value: { ...result.value, dependencies: { 'element-plus': 'workspace:*' } } }
        : result
    }
    const dependencyResult = await generateVueSource(rawInput({ componentResolver: nonPortable }))
    expect(dependencyResult.success).toBe(false)
    if (!dependencyResult.success)
      expect(dependencyResult.diagnostics[0]?.code).toBe('source_resolution_failed')
  })

  it('keeps Raw generation independent from the optional binding resolver', async () => {
    const raw = await generateVueSource(rawInput())
    const bindings = await generateConfigFormBindings(bindingInput({
      bindingResolver: {
        resolveConfigFormBinding: () => ({ success: false, reason: 'binding package unavailable' }),
      },
    }))

    expect(raw.success).toBe(true)
    expect(bindings).toMatchObject({
      success: false,
      diagnostics: [{ code: 'source_resolution_failed' }],
    })
  })

  it.each(['@moluoxixi/hidden-runtime', '@config-form/private-runtime', 'zod']) (
    'rejects forbidden Raw dependency %s before emitting files',
    async (dependency) => {
      const resolver = componentResolver()
      const resolve = resolver.resolveComponent
      resolver.resolveComponent = (request) => {
        const result = resolve(request)
        return result.success
          ? { ...result, value: { ...result.value, dependencies: { ...result.value.dependencies, [dependency]: '1.0.0' } } }
          : result
      }
      const generated = await generateVueSource(rawInput({ componentResolver: resolver }))
      expect(generated).toMatchObject({
        success: false,
        diagnostics: [{ code: 'source_resolution_failed' }],
      })
      expect('data' in generated).toBe(false)
    },
  )

  it.each([
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const)('rejects forbidden Raw packages from manifest %s', (section) => {
    const fileSet: RawSourceFileSetV1 = {
      version: 1,
      kind: 'raw-source',
      entry: 'src/main.ts',
      files: [{
        kind: 'text',
        path: 'package.json',
        language: 'json',
        content: JSON.stringify({ [section]: { '@moluoxixi/hidden-runtime': '1.0.0' } }),
      }],
    }

    expect(() => assertGeneratedRuntimeBoundary(fileSet)).toThrow(
      'raw-source emitted forbidden dependencies: @moluoxixi/hidden-runtime.',
    )
  })

  it('fails both source modes without partial files when a custom validator implementation is missing', async () => {
    const invalidCompilation = compilation()
    const name = invalidCompilation.ir.surfacesById.home?.nodesById.name as unknown as { validation: unknown }
    name.validation = {
      version: 2,
      base: { type: 'string' },
      rules: [{ kind: 'custom', key: 'missing-source-validator' }],
    }

    const [raw, bindings] = await Promise.all([
      generateVueSource(rawInput({ compilation: invalidCompilation })),
      generateConfigFormBindings(bindingInput({ compilation: invalidCompilation })),
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

    const raw = await generateVueSource(rawInput({ compilation: cyclicCompilation }))
    const bindings = await generateConfigFormBindings(bindingInput({ compilation: cyclicCompilation }))
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

    const raw = await generateVueSource(rawInput({ compilation: invalidCompilation }))
    expect(raw.success).toBe(false)
    if (!raw.success) {
      expect(raw.diagnostics[0]).toMatchObject({ code: 'source_input_invalid' })
      expect(raw.diagnostics[0]?.context?.reason).toContain('scoped values')
    }

    const bindings = await generateConfigFormBindings(bindingInput({ compilation: invalidCompilation }))
    expect(bindings.success).toBe(false)
    if (!bindings.success)
      expect(bindings.diagnostics[0]).toMatchObject({ code: 'source_input_invalid' })
  })
})
