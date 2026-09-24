import type {
  ProjectCompilation,
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type { DatasetViewQuery } from '@moluoxixi/config-form-model'
import type {
  CanonicalRuntimeSurface,
  VueRuntimeBindingResolver,
  VueRuntimeComponentBinding,
} from '../index'
import { performance } from 'node:perf_hooks'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { compileCanonicalSurfaceRuntime } from '../index'

const RuntimeField = defineComponent({
  name: 'RuntimeFieldFixture',
  inheritAttrs: false,
  props: {
    clearable: Boolean,
    modelValue: String,
    placeholder: String,
  },
  emits: ['update:modelValue'],
  setup(props) {
    return () => h('input', {
      'data-runtime-field': '',
      'data-clearable': String(props.clearable),
      'placeholder': props.placeholder,
      'value': props.modelValue,
    })
  },
})

const RuntimeLayout = defineComponent({
  name: 'RuntimeLayoutFixture',
  setup(_, { slots }) {
    return () => h('section', { 'data-runtime-layout': '' }, slots.default?.())
  },
})

const RuntimeElement = defineComponent({
  name: 'RuntimeElementFixture',
  props: { label: String },
  setup(props) {
    return () => h('button', { 'data-runtime-element': '' }, props.label)
  },
})

const registryUsage = [
  { key: 'field.input', contractFingerprint: 'fnv1a:field', contractVersion: '1', fingerprint: 'fnv1a:field' },
  { key: 'layout.section', contractFingerprint: 'fnv1a:layout', contractVersion: '1', fingerprint: 'fnv1a:layout' },
  { key: 'element.action', contractFingerprint: 'fnv1a:element', contractVersion: '1', fingerprint: 'fnv1a:element' },
] as const

function resolver(compilation: SurfaceCompilation, overrides: Partial<VueRuntimeBindingResolver> = {}): VueRuntimeBindingResolver {
  const identities = Object.fromEntries(compilation.registryUsage.map(item => [item.key, item]))
  const components: Record<string, VueRuntimeComponentBinding> = {
    'field.input': {
      component: RuntimeField,
      contractFingerprint: identities['field.input']?.fingerprint ?? '',
      contractVersion: identities['field.input']?.contractVersion ?? '',
      kind: 'field',
      trigger: 'update:modelValue',
      valueProp: 'modelValue',
    },
    'layout.section': {
      component: RuntimeLayout,
      contractFingerprint: identities['layout.section']?.fingerprint ?? '',
      contractVersion: identities['layout.section']?.contractVersion ?? '',
      kind: 'layout',
    },
    'element.action': {
      component: RuntimeElement,
      contractFingerprint: identities['element.action']?.fingerprint ?? '',
      contractVersion: identities['element.action']?.contractVersion ?? '',
      kind: 'element',
    },
  }
  return {
    components: {},
    resolveBinding: component => components[component],
    ...overrides,
  }
}

function createSurface(id: string, kind: 'page' | 'dialog' | 'drawer' = 'page'): CanonicalRuntimeSurface {
  const presentation = kind === 'dialog'
    ? { kind: 'dialog' as const, title: 'Editor', width: { desktop: { value: 640, unit: 'px' as const } }, mask: true, close: { escape: true, mask: true, button: true } }
    : kind === 'drawer'
      ? { kind: 'drawer' as const, title: 'Details', placement: 'right' as const, size: { desktop: { value: 40, unit: '%' as const } }, mask: true, close: { escape: true, mask: true, button: true } }
      : undefined
  const nodes = {
    'section': {
      id: 'section',
      component: 'layout.section',
      componentVersion: '1',
      componentFingerprint: 'fnv1a:layout',
      kind: 'layout' as const,
      subtreeHash: 'hash:section',
      placement: { parentId: null, slot: null, props: {} },
      configuredProps: {},
      props: { gap: 12 },
      slots: { default: ['name', 'open-editor'] },
    },
    'name': {
      id: 'name',
      component: 'field.input',
      componentVersion: '1',
      componentFingerprint: 'fnv1a:field',
      kind: 'field' as const,
      subtreeHash: 'hash:name',
      placement: { parentId: 'section', slot: 'default', props: { span: 12 } },
      configuredProps: { placeholder: 'Configured name' },
      props: { clearable: true, placeholder: 'Your name' },
      field: 'name',
      label: 'Name',
      defaultValue: 'Ada',
      required: true,
      requiredMessage: 'Name is required',
      validateOn: ['submit' as const],
      validation: { version: 2, base: { type: 'string' as const }, rules: [{ kind: 'minLength' as const, value: 2 }] },
    },
    'open-editor': {
      id: 'open-editor',
      component: 'element.action',
      componentVersion: '1',
      componentFingerprint: 'fnv1a:element',
      kind: 'element' as const,
      subtreeHash: 'hash:open-editor',
      placement: { parentId: 'section', slot: 'default', props: { span: 12 } },
      configuredProps: { label: 'Edit' },
      props: { label: 'Edit' },
    },
  }
  return {
    id,
    name: id,
    kind,
    ...(kind === 'page' ? { route: '/' } : { presentation }),
    props: {},
    form: { columns: 24, fieldSpan: 24, labelWidth: 120 },
    scopedFields: [{ field: 'name', nodeId: 'name' }],
    valueScopes: [],
    rootIds: ['section'],
    nodesById: nodes,
    parameters: [],
    outputs: [],
    interactions: [],
  } as unknown as CanonicalRuntimeSurface
}

function surfaceCompilation(surfaceId = 'home'): SurfaceCompilation {
  const kind = surfaceId === 'editor' ? 'dialog' : surfaceId === 'details' ? 'drawer' : 'page'
  const surface = createSurface(surfaceId, kind)
  const key = {
    irVersion: CANONICAL_PROJECT_IR_VERSION,
    projectId: 'runtime-project',
    surfaceId,
    registryAdapter: 'fixture',
    registryAdapterVersion: '1',
    registryUsageHash: 'hash:usage',
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: 'hash:environment',
    semanticHash: `hash:${surfaceId}`,
  }
  return {
    snapshotIdentity: { source: 'committed', projectId: 'runtime-project', surfaceId, contentHash: 'hash:content', editVersion: 1 },
    registryUsage: registryUsage.map(({ key, contractVersion, fingerprint }) => ({ key, contractVersion, fingerprint })),
    key,
    surface,
    datasetsById: {},
  } as unknown as SurfaceCompilation
}

function projectCompilation(): ProjectCompilation {
  const surfacesById = {
    home: createSurface('home', 'page'),
    editor: createSurface('editor', 'dialog'),
    details: createSurface('details', 'drawer'),
  }
  const key = {
    projectId: 'runtime-project',
    contentHash: 'hash:content',
    registryAdapter: 'fixture',
    registryAdapterVersion: '1',
    registryFingerprint: 'hash:registry',
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: 'hash:environment',
    irHash: 'hash:ir',
  }
  return {
    snapshot: {} as ProjectCompilation['snapshot'],
    registry: {} as ProjectCompilation['registry'],
    origin: { kind: 'committed', editVersion: 1 },
    key,
    ir: { version: CANONICAL_PROJECT_IR_VERSION, identity: key, name: 'Runtime fixture', homeSurfaceId: 'home', surfaceOrder: ['home', 'editor', 'details'], surfacesById, datasetOrder: [], datasetsById: {}, resources: {}, theme: { version: 1 }, settings: {}, environment: { version: '1', features: {} } },
  } as unknown as ProjectCompilation
}

function mutableSurface(compilation = surfaceCompilation()): CanonicalRuntimeSurface {
  return structuredClone(compilation.surface) as unknown as CanonicalRuntimeSurface
}

describe('vue Surface backend', () => {
  it('projects referenced Dataset rows into component props and fails closed on invalid projections', () => {
    const compilation = surfaceCompilation()
    const surface = mutableSurface(compilation)
    const field = surface.nodesById.name
    if (!field || field.kind !== 'field')
      throw new TypeError('Expected the name field fixture.')
    const query: DatasetViewQuery = {
      filter: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['active'] } },
      sort: [{ path: ['rank'], direction: 'desc' }],
      page: { index: 0, size: 2 },
    }
    field.datasetBindings = {
      options: {
        datasetId: 'people',
        projection: { kind: 'options', labelPath: ['label'], valuePath: ['id'] },
        query,
      },
      rows: {
        datasetId: 'people',
        projection: {
          kind: 'table',
          rowKeyPath: ['id'],
          columns: [
            { key: 'name', valuePath: ['label'] },
            { key: 'rank', valuePath: ['rank'] },
          ],
        },
        query,
      },
      items: {
        datasetId: 'people',
        projection: {
          kind: 'list',
          itemKeyPath: ['id'],
          titlePath: ['label'],
          descriptionPath: ['description'],
        },
        query,
      },
    }
    const datasetsById = {
      people: {
        id: 'people',
        name: 'People',
        rows: [
          { id: 'ada', label: 'Ada', active: true, rank: 2, description: 'Second' },
          { id: 'grace', label: 'Grace', active: false, rank: 4, description: 'Hidden' },
          { id: 'linus', label: 'Linus', active: true, rank: 1, description: 'Third' },
          { id: 'alan', label: 'Alan', active: true, rank: 3, description: 'First' },
        ],
      },
    }
    const projected = compileCanonicalSurfaceRuntime({
      compilation: { ...compilation, surface, datasetsById } as unknown as SurfaceCompilation,
    }, resolver(compilation))
    expect(projected.success).toBe(true)
    if (!projected.success)
      return
    const section = projected.artifact.renderer.fields[0]
    const children = section && !('field' in section) && Array.isArray(section.slots?.default)
      ? section.slots.default
      : []
    expect(children[0]?.props).toMatchObject({
      options: [
        { label: 'Alan', value: 'alan' },
        { label: 'Ada', value: 'ada' },
      ],
      optionsTotal: 3,
      rows: [
        { rowKey: 'alan', name: 'Alan', rank: 3 },
        { rowKey: 'ada', name: 'Ada', rank: 2 },
      ],
      rowsTotal: 3,
      items: [
        { itemKey: 'alan', title: 'Alan', description: 'First' },
        { itemKey: 'ada', title: 'Ada', description: 'Second' },
      ],
      itemsTotal: 3,
    })

    field.datasetBindings = {
      options: {
        datasetId: 'people',
        projection: { kind: 'options', labelPath: ['label'], valuePath: ['id'] },
      },
    }
    datasetsById.people.rows[1] = {
      id: 'ada',
      label: 'Duplicate',
      active: false,
      rank: 4,
      description: 'Duplicate',
    }
    expect(compileCanonicalSurfaceRuntime({
      compilation: { ...compilation, surface, datasetsById } as unknown as SurfaceCompilation,
    }, resolver(compilation))).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'VUE_RUNTIME_DATASET_PROJECTION_INVALID',
        nodeId: 'name',
        path: ['datasetsById', 'people', 'rows', 1, 'id'],
      }],
    })
  })

  it('renders field, layout, and element nodes without mutating Canonical IR', () => {
    const compilation = surfaceCompilation()
    const snapshot = structuredClone(compilation.surface)
    const result = compileCanonicalSurfaceRuntime({ compilation }, resolver(compilation))

    expect(result.success, JSON.stringify(result.success ? [] : result.diagnostics)).toBe(true)
    expect(compilation.surface).toEqual(snapshot)
    if (!result.success)
      return

    expect(result.artifact).toMatchObject({
      compilationKey: compilation.key,
      surfaceId: 'home',
      kind: 'page',
    })
    expect(Object.isFrozen(result.artifact)).toBe(true)
    expect(Object.isFrozen(result.artifact.compilationKey)).toBe(true)
    expect(Object.isFrozen(result.artifact.renderer.plan)).toBe(true)
    expect(result.artifact.renderer.plan).toEqual({
      optionBindings: [],
      runtime: { dataSources: [], variables: [] },
      valueSchema: compilation.surface
        ? { scopedFields: compilation.surface.scopedFields, valueScopes: compilation.surface.valueScopes }
        : undefined,
    })

    const root = result.artifact.renderer.fields[0]
    expect(root).toMatchObject({ id: 'section', component: RuntimeLayout })
    const children = root && !('field' in root) && Array.isArray(root.slots?.default)
      ? root.slots.default
      : []
    expect(children).toHaveLength(2)
    const nested = children[0]
    expect(nested).toMatchObject({
      id: 'name',
      field: 'name',
      required: true,
      requiredMessage: 'Name is required',
      valueProp: 'modelValue',
    })
    expect(children[1]).toMatchObject({ id: 'open-editor', component: RuntimeElement })
    expect(nested).not.toHaveProperty('bindings')
    expect(nested).not.toHaveProperty('conditions')
    expect(nested).not.toHaveProperty('reactions')

    const wrapper = mount(ConfigFormRenderer, {
      props: {
        ...result.artifact.renderer,
        model: createConfigFormModel(shallowRef<Record<string, unknown>>({ name: 'Ada' })),
      },
    })
    expect(wrapper.find('[data-runtime-layout]').exists()).toBe(true)
    expect(wrapper.find('[data-runtime-field]').attributes()).toMatchObject({
      'data-clearable': 'true',
      'placeholder': 'Your name',
      'value': 'Ada',
    })
    expect(wrapper.find('[data-runtime-element]').text()).toBe('Edit')
  })

  it('projects dialog and drawer identity without recursively compiling targets', () => {
    for (const surfaceId of ['editor', 'details'] as const) {
      const compilation = surfaceCompilation(surfaceId)
      const runtime = compileCanonicalSurfaceRuntime({ compilation }, resolver(compilation))
      expect(runtime.success).toBe(true)
      if (!runtime.success)
        continue
      expect(runtime.artifact.surfaceId).toBe(surfaceId)
      expect(runtime.artifact.kind).toBe(surfaceId === 'editor' ? 'dialog' : 'drawer')
      expect(runtime.artifact.presentation).toBeDefined()
      expect(JSON.stringify(runtime.artifact)).not.toContain(surfaceId === 'editor' ? 'details-action' : 'editor-action')
    }
  })

  it('supports project compilation lookup and rejects unknown Surface ids', () => {
    const compilation = projectCompilation()
    const surface = compilation.ir.surfacesById.home!
    expect(surface.id).toBe('home')
    const compiledSurface = surfaceCompilation()
    const projectResolver = resolver(compiledSurface)
    expect(compileCanonicalSurfaceRuntime({ compilation, surfaceId: 'home' }, projectResolver).success).toBe(true)
    expect(compileCanonicalSurfaceRuntime({ compilation, surfaceId: 'missing' }, projectResolver)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_IR_SURFACE_UNKNOWN', path: ['surfacesById', 'missing'] }],
    })
  })

  it('fails closed when a binding is missing or identity diverges', () => {
    const compilation = surfaceCompilation()
    const missing = compileCanonicalSurfaceRuntime({ compilation }, resolver(compilation, {
      resolveBinding: component => component === 'layout.section' ? undefined : resolver(compilation).resolveBinding(component),
    }))
    expect(missing).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_BINDING_UNAVAILABLE', nodeId: 'section' }],
    })

    const stale = compileCanonicalSurfaceRuntime({ compilation }, resolver(compilation, {
      resolveBinding(component) {
        const binding = resolver(compilation).resolveBinding(component)
        return binding && component === 'field.input'
          ? { ...binding, contractFingerprint: 'stale' }
          : binding
      },
    }))
    expect(stale).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_BINDING_IDENTITY_MISMATCH', nodeId: 'name' }],
    })
  })

  it('rejects stale, future, and additive Canonical contracts', () => {
    const compilation = surfaceCompilation()
    const cases = [
      CANONICAL_PROJECT_IR_VERSION - 1,
      CANONICAL_PROJECT_IR_VERSION + 1,
      undefined,
    ]
    for (const value of cases) {
      const stale = structuredClone(compilation) as unknown as { key: Record<string, unknown> }
      stale.key.irVersion = value
      expect(compileCanonicalSurfaceRuntime({ compilation: stale as unknown as SurfaceCompilation }, resolver(compilation))).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_IR_VERSION_UNSUPPORTED', path: ['key', 'irVersion'] }],
      })
    }

    const additive = structuredClone(compilation) as unknown as { surface: Record<string, unknown> }
    additive.surface.legacyEvents = []
    expect(compileCanonicalSurfaceRuntime({ compilation: additive as unknown as SurfaceCompilation }, resolver(compilation))).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_IR_SHAPE_UNSUPPORTED', path: ['surface'] }],
    })
  })

  it('reuses unchanged node fragments and handles a large Surface within budget', () => {
    const compilation = surfaceCompilation()
    const surface = mutableSurface(compilation)
    surface.rootIds = []
    surface.nodesById = {}
    for (let index = 0; index < 2_000; index += 1) {
      const id = `field-${index}`
      surface.rootIds.push(id)
      surface.nodesById[id] = {
        id,
        component: 'field.input',
        componentVersion: compilation.registryUsage.find(item => item.key === 'field.input')!.contractVersion,
        componentFingerprint: compilation.registryUsage.find(item => item.key === 'field.input')!.fingerprint,
        kind: 'field',
        subtreeHash: `hash:${id}`,
        placement: { parentId: null, slot: null, props: { span: 6 } },
        configuredProps: {},
        props: {},
        field: id,
        validateOn: ['submit'],
      }
    }
    const large = { ...compilation, surface } as unknown as SurfaceCompilation
    const startedAt = performance.now()
    const result = compileCanonicalSurfaceRuntime({ compilation: large }, resolver(compilation))
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.artifact.renderer.fields).toHaveLength(2_000)
    expect(performance.now() - startedAt).toBeLessThan(750)

    const resolverWithSpy = resolver(compilation)
    const spy = vi.spyOn(resolverWithSpy, 'resolveBinding')
    const first = compileCanonicalSurfaceRuntime({ compilation }, resolverWithSpy)
    const nextSurface = structuredClone(compilation.surface) as unknown as CanonicalRuntimeSurface
    nextSurface.nodesById.name = { ...nextSurface.nodesById.name!, props: { placeholder: 'changed' }, subtreeHash: 'changed' } as typeof nextSurface.nodesById.name
    const second = compileCanonicalSurfaceRuntime({ compilation: { ...compilation, surface: nextSurface } as unknown as SurfaceCompilation }, resolverWithSpy)
    expect(first.success && second.success).toBe(true)
    expect(spy).toHaveBeenCalled()
  })

  it('keeps business-invalid defaults for runtime validation and rejects base mismatches', () => {
    const compilation = surfaceCompilation()
    const surface = mutableSurface(compilation)
    const field = surface.nodesById.name
    if (!field || field.kind !== 'field')
      throw new TypeError('Expected the name field fixture.')
    field.defaultValue = ''
    field.required = true
    field.requiredMessage = 'Name is required'
    field.validation = {
      version: 2,
      base: { type: 'string' },
      rules: [{ kind: 'minLength', value: 2, message: 'Name is too short' }],
    }

    const businessInvalid = compileCanonicalSurfaceRuntime({
      compilation: { ...compilation, surface } as unknown as SurfaceCompilation,
    }, resolver(compilation))
    expect(businessInvalid.success).toBe(true)
    if (!businessInvalid.success)
      return
    const section = businessInvalid.artifact.renderer.fields[0]
    const children = section && !('field' in section) && Array.isArray(section.slots?.default)
      ? section.slots.default
      : []
    const runtimeField = children[0]
    expect(runtimeField).toMatchObject({
      defaultValue: '',
      required: true,
      requiredMessage: 'Name is required',
    })
    if (runtimeField && 'field' in runtimeField)
      expect(runtimeField.schema?.safeParse('').success).toBe(false)

    const mismatchedSurface = structuredClone(surface) as CanonicalRuntimeSurface
    const mismatchedField = mismatchedSurface.nodesById.name
    if (!mismatchedField || mismatchedField.kind !== 'field')
      throw new TypeError('Expected the mismatched name field fixture.')
    mismatchedField.defaultValue = 42
    expect(compileCanonicalSurfaceRuntime({
      compilation: { ...compilation, surface: mismatchedSurface } as unknown as SurfaceCompilation,
    }, resolver(compilation))).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'VUE_RUNTIME_DEFAULT_BASE_INVALID',
        nodeId: 'name',
        path: ['nodesById', 'name', 'defaultValue'],
      }],
    })
  })

  it('rejects a stale nested RuleSet even when the outer Canonical identity is current', () => {
    const compilation = surfaceCompilation()
    const surface = mutableSurface(compilation)
    const field = surface.nodesById.name
    if (!field || field.kind !== 'field' || !field.validation) {
      throw new TypeError('Expected the validated name field fixture.')
    }
    const validation = field.validation as unknown as { version: number }
    validation.version = 1

    expect(compileCanonicalSurfaceRuntime({
      compilation: { ...compilation, surface } as unknown as SurfaceCompilation,
    }, resolver(compilation))).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'RULE_DOCUMENT_INVALID',
        nodeId: 'name',
        path: ['nodesById', 'name', 'validation', 'version'],
      }],
    })
  })

  it('rejects stale compiler identity', () => {
    const compilation = surfaceCompilation()
    const stale = structuredClone(compilation) as unknown as { key: Record<string, unknown> }
    stale.key.compilerVersion = '5.0.0'
    expect(compileCanonicalSurfaceRuntime({ compilation: stale as unknown as SurfaceCompilation }, resolver(compilation))).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_COMPILER_VERSION_UNSUPPORTED', path: ['key', 'compilerVersion'] }],
    })
    expect(CONFIG_FORM_COMPILER_VERSION).toBe('8.0.0')
  })
})
