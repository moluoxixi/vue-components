import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
} from '@moluoxixi/config-form'
import type {
  CanonicalPageIR,
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  VueRuntimeBindingResolver,
  VueRuntimeComponentBinding,
} from '../index'
import { performance } from 'node:perf_hooks'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { compileCanonicalPageRuntime } from '../index'

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
      'data-clearable': String(props.clearable),
      'data-runtime-field': '',
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

const bindings: Record<string, VueRuntimeComponentBinding> = {
  'layout.section': {
    component: RuntimeLayout,
    contractFingerprint: 'fnv1a:layout',
    contractVersion: '1',
    kind: 'layout',
  },
  'element.input': {
    component: RuntimeField,
    contractFingerprint: 'fnv1a:field',
    contractVersion: '2',
    kind: 'field',
    readonlyRender: ({ componentProps, node, value }) => (
      `${node.id}:${String(value)}:${String(componentProps.placeholder)}`
    ),
    trigger: 'update:modelValue',
    valueProp: 'modelValue',
  },
}

function resolver(overrides: Partial<VueRuntimeBindingResolver> = {}): VueRuntimeBindingResolver {
  return {
    components: {},
    resolveBinding: component => bindings[component],
    ...overrides,
  }
}

function pageFixture(): CanonicalPageIR {
  return {
    id: 'home',
    name: 'Home',
    route: '/',
    props: {},
    form: {
      columns: 24,
      fieldSpan: 24,
      labelWidth: 120,
      responsive: {
        mobile: { columns: 1, fieldSpan: 1, labelWidth: 72 },
        tablet: { columns: 12, fieldSpan: 12, labelWidth: 96 },
      },
    },
    rootIds: ['section'],
    nodesById: {
      section: {
        id: 'section',
        component: 'layout.section',
        componentVersion: '1',
        componentFingerprint: 'fnv1a:layout',
        kind: 'layout',
        subtreeHash: 'fnv1a:section',
        placement: { parentId: null, slot: null, props: {} },
        configuredProps: {},
        props: { gap: 12 },
        events: {},
        bindings: {},
        slots: { default: ['name'] },
      },
      name: {
        id: 'name',
        component: 'element.input',
        componentVersion: '2',
        componentFingerprint: 'fnv1a:field',
        kind: 'field',
        subtreeHash: 'fnv1a:name',
        placement: {
          parentId: 'section',
          slot: 'default',
          props: { span: 12 },
        },
        configuredProps: { placeholder: 'Configured name' },
        props: { clearable: true, placeholder: 'Configured name' },
        events: { change: [{ action: 'track' }] },
        bindings: { model: { source: 'profile.name' } },
        field: 'name',
        label: 'Name',
        defaultValue: 'Ada',
        validation: {
          version: 1,
          base: { type: 'string' },
          rules: [{ kind: 'minLength', value: 2 }],
        },
        conditions: {
          visible: { kind: 'literal', value: true },
        },
      },
    },
    flows: [],
  }
}

function compilationFixture(page = pageFixture()): ProjectCompilation {
  const key = {
    projectId: 'runtime-project',
    contentHash: 'fnv1a:content',
    registryAdapter: 'runtime-fixture',
    registryAdapterVersion: '1',
    registryFingerprint: 'fnv1a:registry',
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: 'fnv1a:environment',
    irHash: 'fnv1a:ir',
  } satisfies ProjectCompilation['key']

  return {
    snapshot: {} as ProjectCompilation['snapshot'],
    registry: {} as ProjectCompilation['registry'],
    origin: { kind: 'committed', editVersion: 7 },
    key,
    ir: {
      version: CANONICAL_PROJECT_IR_VERSION,
      identity: key,
      name: 'Runtime fixture',
      homePageId: page.id,
      pageOrder: [page.id],
      pagesById: { [page.id]: page },
      settings: {},
      resources: {},
      environment: { version: '1', features: {} },
    },
  }
}

function pageCompilationFixture(page = pageFixture()): PageCompilation {
  return {
    snapshotIdentity: {
      source: 'committed',
      projectId: 'runtime-project',
      pageId: page.id,
      contentHash: 'fnv1a:content',
      editVersion: 7,
    },
    registryUsage: [
      { key: 'element.input', contractVersion: '2', fingerprint: 'fnv1a:field' },
      { key: 'layout.section', contractVersion: '1', fingerprint: 'fnv1a:layout' },
    ],
    key: {
      irVersion: CANONICAL_PROJECT_IR_VERSION,
      projectId: 'runtime-project',
      pageId: page.id,
      registryAdapter: 'runtime-fixture',
      registryAdapterVersion: '1',
      registryUsageHash: 'fnv1a:usage',
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash: 'fnv1a:environment',
      semanticHash: 'fnv1a:page',
    },
    page,
  }
}

function compilePage(
  page: CanonicalPageIR,
  bindingResolver: VueRuntimeBindingResolver = resolver(),
) {
  return compileCanonicalPageRuntime({
    compilation: pageCompilationFixture(page),
  }, bindingResolver)
}

function nestedField(root: ConfigFormRendererNode): ConfigFormRendererField {
  const slot = root.slots?.default
  const child = Array.isArray(slot) ? slot[0] : undefined
  if (!child || !('field' in child))
    throw new Error('Expected a field inside the default layout slot.')
  return child
}

describe('vue Runtime backend', () => {
  it('renders resolved Canonical IR through real Vue components without mutating the IR', () => {
    const page = pageFixture()
    const snapshot = structuredClone(page)
    const compilation = pageCompilationFixture(page)
    const result = compileCanonicalPageRuntime({ compilation }, resolver())

    expect(result.success, JSON.stringify(result.success ? [] : result.diagnostics)).toBe(true)
    expect(page).toEqual(snapshot)
    if (!result.success)
      return

    expect(result.artifact).toMatchObject({
      compilationKey: compilation.key,
      pageId: 'home',
    })
    expect(Object.isFrozen(result.artifact)).toBe(true)
    expect(Object.isFrozen(result.artifact.compilationKey)).toBe(true)
    expect(Object.isFrozen(result.artifact.plan)).toBe(true)
    expect(result.artifact.plan.renderer.labelWidth).toBe(120)
    expect(result.artifact.plan.renderer.responsive).toEqual({
      mobile: { columns: 1, fieldSpan: 1, labelWidth: 72 },
      tablet: { columns: 12, fieldSpan: 12, labelWidth: 96 },
    })

    const root = result.artifact.plan.renderer.fields[0]!
    const field = nestedField(root)
    expect(field).toMatchObject({
      id: 'name',
      field: 'name',
      props: { clearable: true, placeholder: 'Configured name' },
      span: 12,
      valueProp: 'modelValue',
      trigger: 'update:modelValue',
    })
    expect(field.extensions).toMatchObject({
      'mx.low-code': {
        events: { change: [{ action: 'track' }] },
        bindings: { model: { source: 'profile.name' } },
      },
    })
    expect(field.schema?.safeParse('A').success).toBe(false)
    expect(field.schema?.safeParse('Ada').success).toBe(true)
    expect(field.readonlyRender?.({
      componentProps: field.props ?? {},
      field,
      model: { name: 'Ada' },
      value: 'Ada',
    })).toBe('name:Ada:Configured name')

    const wrapper = mount(ConfigFormRenderer, {
      props: {
        ...result.artifact.plan.renderer,
        modelValue: { name: 'Ada' },
      },
    })
    expect(wrapper.find('[data-runtime-layout]').exists()).toBe(true)
    expect(wrapper.find('[data-runtime-field]').attributes()).toMatchObject({
      'data-clearable': 'true',
      'placeholder': 'Configured name',
      'value': 'Ada',
    })
  })

  it('fails closed when a binding is missing or its semantic identity diverges', () => {
    const missing = compilePage(pageFixture(), resolver({
      resolveBinding: component => component === 'layout.section' ? bindings[component] : undefined,
    }))
    expect(missing).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_BINDING_UNAVAILABLE', nodeId: 'name' }],
    })

    const mismatch = compilePage(pageFixture(), resolver({
      resolveBinding(component) {
        const binding = bindings[component]
        return binding && component === 'element.input'
          ? { ...binding, contractFingerprint: 'fnv1a:stale' }
          : binding
      },
    }))
    expect(mismatch).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_BINDING_IDENTITY_MISMATCH', nodeId: 'name' }],
    })
  })

  it('forwards only component events projected onto the canonical node listener set', () => {
    const page = pageFixture()
    page.nodesById.name!.flowEvents = ['click']
    page.flows = [{
      semanticHash: 'fnv1a:component-click',
      plan: {
        version: 1,
        flowId: 'field-click-flow',
        name: 'Field click',
        trigger: { kind: 'component.event', nodeId: 'name', event: 'click' },
        triggerNodeId: 'trigger',
        topologicalOrder: ['trigger'],
        nodes: [{ id: 'trigger', type: 'trigger', incoming: [], outgoing: [] }],
      },
    }]

    const result = compilePage(page)
    expect(result.success).toBe(true)
    if (!result.success)
      return

    expect(nestedField(result.artifact.plan.renderer.fields[0]!).extensions).toMatchObject({
      'mx.low-code': { flowEvents: ['click'] },
    })
  })

  it('does not reinterpret Flow plans when the canonical node listener projection is absent', () => {
    const page = pageFixture()
    page.flows = [{
      semanticHash: 'fnv1a:component-click',
      plan: {
        version: 1,
        flowId: 'field-click-flow',
        name: 'Field click',
        trigger: { kind: 'component.event', nodeId: 'name', event: 'click' },
        triggerNodeId: 'trigger',
        topologicalOrder: ['trigger'],
        nodes: [{ id: 'trigger', type: 'trigger', incoming: [], outgoing: [] }],
      },
    }]

    const result = compilePage(page)
    expect(result.success).toBe(true)
    if (!result.success)
      return
    const metadata = nestedField(result.artifact.plan.renderer.fields[0]!).extensions?.['mx.low-code']
    expect(metadata).not.toHaveProperty('flowEvents')
  })

  it('reuses unchanged Runtime fragments across incremental page compilations', () => {
    const page = pageFixture()
    const name = page.nodesById.name!
    if (name.kind !== 'field')
      throw new TypeError('Expected field fixture.')
    page.rootIds.push('other')
    page.nodesById.other = {
      ...name,
      id: 'other',
      field: 'other',
      subtreeHash: 'fnv1a:other',
      placement: { parentId: null, slot: null, props: {} },
      props: { placeholder: 'Unchanged root' },
    }
    const resolveBinding = vi.fn((component: string) => bindings[component])
    const stableResolver = resolver({ resolveBinding })
    const first = compilePage(page, stableResolver)
    expect(first.success).toBe(true)
    if (!first.success)
      return
    expect(resolveBinding).toHaveBeenCalledTimes(3)

    const nextName = {
      ...name,
      props: { ...name.props, placeholder: 'Changed name' },
      subtreeHash: 'fnv1a:name-next',
    }
    const section = page.nodesById.section!
    const nextSection = { ...section, subtreeHash: 'fnv1a:section-next' }
    const nextPage: CanonicalPageIR = {
      ...page,
      nodesById: {
        ...page.nodesById,
        name: nextName,
        section: nextSection,
      },
    }
    const second = compilePage(nextPage, stableResolver)
    expect(second.success).toBe(true)
    if (!second.success)
      return

    expect(resolveBinding).toHaveBeenCalledTimes(5)
    expect(second.artifact.plan.renderer.fields[0]).not.toBe(first.artifact.plan.renderer.fields[0])
    expect(second.artifact.plan.renderer.fields[1]).toBe(first.artifact.plan.renderer.fields[1])
  })

  it('rejects a nested relation whose parent placement disagrees with the IR', () => {
    const placement = pageFixture()
    placement.nodesById.name!.placement.parentId = null
    expect(compilePage(placement)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_IR_PLACEMENT_MISMATCH', nodeId: 'name' }],
    })
  })

  it('fails closed when the requested page is absent from the compilation', () => {
    const compilation = compilationFixture()
    expect(compileCanonicalPageRuntime({ compilation, pageId: 'missing' }, resolver())).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'VUE_RUNTIME_IR_PAGE_UNKNOWN',
        path: ['pagesById', 'missing'],
      }],
    })
  })

  it('binds a 2000-node page plan within the page-scoped production budget', () => {
    const page = pageFixture()
    page.rootIds = []
    page.nodesById = {}
    for (let index = 0; index < 2_000; index += 1) {
      const id = `field-${index}`
      page.rootIds.push(id)
      page.nodesById[id] = {
        id,
        component: 'element.input',
        componentVersion: '2',
        componentFingerprint: 'fnv1a:field',
        kind: 'field',
        subtreeHash: `fnv1a:${id}`,
        placement: { parentId: null, slot: null, props: { span: 6 } },
        configuredProps: {},
        props: {},
        events: {},
        bindings: {},
        field: id,
      }
    }

    const startedAt = performance.now()
    const result = compilePage(page)
    const duration = performance.now() - startedAt

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.artifact.plan.renderer.fields).toHaveLength(2_000)
    expect(duration).toBeLessThan(750)
  })
})
