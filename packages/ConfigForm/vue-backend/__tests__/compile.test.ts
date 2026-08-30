import type { CanonicalPageIR, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
} from '@moluoxixi/config-form/renderer'
import type {
  VueRuntimeBindingResolver,
  VueRuntimeComponentBinding,
} from '../index'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { RuntimeSurface } from '@moluoxixi/config-form/renderer'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
      responsive: {
        mobile: { columns: 1, fieldSpan: 1 },
        tablet: { columns: 12, fieldSpan: 12 },
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
        path: ['section'],
        placement: { parentId: null, slot: null, index: 0, props: {} },
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
        path: ['section', 'name'],
        placement: {
          parentId: 'section',
          slot: 'default',
          index: 0,
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

function compilePage(
  page: CanonicalPageIR,
  bindingResolver: VueRuntimeBindingResolver = resolver(),
) {
  return compileCanonicalPageRuntime({
    compilation: compilationFixture(page),
    pageId: page.id,
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
    const compilation = compilationFixture(page)
    const result = compileCanonicalPageRuntime({ compilation, pageId: page.id }, resolver())

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

    const wrapper = mount(RuntimeSurface, {
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

  it('rejects a nested relation whose placement or ancestry path disagrees with the IR', () => {
    const placement = pageFixture()
    placement.nodesById.name!.placement.index = 2
    expect(compilePage(placement)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_IR_PLACEMENT_MISMATCH', nodeId: 'name' }],
    })

    const path = pageFixture()
    path.nodesById.name!.path = ['name']
    expect(compilePage(path)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'VUE_RUNTIME_IR_PATH_MISMATCH', nodeId: 'name' }],
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
})
