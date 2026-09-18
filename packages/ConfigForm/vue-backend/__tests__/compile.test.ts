import type {
  ConfigFormRendererField,
  ConfigFormRendererNode,
} from '@moluoxixi/config-form'
import type {
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  CanonicalRuntimePage,
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

function pageFixture(): CanonicalRuntimePage {
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
    scopedFields: [{ field: 'name', nodeId: 'name' }],
    valueScopes: [],
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
        bindings: { model: { source: 'profile.name' } },
        field: 'name',
        label: 'Name',
        defaultValue: 'Ada',
        validateOn: ['submit'],
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
  page: CanonicalRuntimePage,
  bindingResolver: VueRuntimeBindingResolver = resolver(),
) {
  return compileCanonicalPageRuntime({
    compilation: pageCompilationFixture(page),
  }, bindingResolver)
}

function mutableProjectCompilation() {
  const compilation = structuredClone(compilationFixture()) as unknown as {
    ir: Record<string, unknown> & { identity: Record<string, unknown> }
    key: Record<string, unknown>
  }
  compilation.key = { ...compilation.key }
  compilation.ir.identity = { ...compilation.ir.identity }
  return compilation
}

function addUnexpectedCanonicalKey(
  page: Record<string, unknown>,
  target: 'node' | 'page',
  key: string,
): void {
  const targetRecord = target === 'page'
    ? page
    : Object.values(page.nodesById as Record<string, Record<string, unknown>>)[0]!
  targetRecord[key] = target === 'page' ? [] : {}
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
    expect(Object.isFrozen(result.artifact.renderer.plan)).toBe(true)
    expect(Object.isFrozen(result.artifact.renderer)).toBe(true)
    expect(result.artifact.renderer.labelWidth).toBe(120)
    expect(result.artifact.renderer.responsive).toEqual({
      mobile: { columns: 1, fieldSpan: 1, labelWidth: 72 },
      tablet: { columns: 12, fieldSpan: 12, labelWidth: 96 },
    })

    const root = result.artifact.renderer.fields[0]!
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
        bindings: { model: { source: 'profile.name' } },
      },
    })
    expect(field).not.toHaveProperty('eventNames')
    expect(field.extensions?.['mx.low-code']).not.toHaveProperty('events')
    expect(result.artifact.renderer.plan).not.toHaveProperty('flows')
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
        ...result.artifact.renderer,
        model: createConfigFormModel(shallowRef<Record<string, unknown>>({ name: 'Ada' })),
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
    const nextPage: CanonicalRuntimePage = {
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
    expect(second.artifact.renderer.fields[0]).not.toBe(first.artifact.renderer.fields[0])
    expect(second.artifact.renderer.fields[1]).toBe(first.artifact.renderer.fields[1])
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

  it('rejects stale, future, and missing IR versions for page and project inputs', () => {
    const cases = [
      { name: 'stale', value: CANONICAL_PROJECT_IR_VERSION - 1 },
      { name: 'future', value: CANONICAL_PROJECT_IR_VERSION + 1 },
      { name: 'missing', value: undefined },
    ]

    for (const { name, value } of cases) {
      const pageCompilation = structuredClone(pageCompilationFixture()) as unknown as {
        key: Record<string, unknown>
      }
      pageCompilation.key.irVersion = value
      expect(compileCanonicalPageRuntime({
        compilation: pageCompilation as unknown as PageCompilation,
      }, resolver()), `${name} page IR version`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_IR_VERSION_UNSUPPORTED', path: ['key', 'irVersion'] }],
      })

      const projectCompilation = structuredClone(compilationFixture()) as unknown as {
        ir: Record<string, unknown>
      }
      projectCompilation.ir.version = value
      expect(compileCanonicalPageRuntime({
        compilation: projectCompilation as unknown as ProjectCompilation,
        pageId: 'home',
      }, resolver()), `${name} project IR version`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_IR_VERSION_UNSUPPORTED', path: ['ir', 'version'] }],
      })
    }
  })

  it('rejects stale, future, missing, and mixed compiler identities', () => {
    const cases = [
      { name: 'stale', value: '4.0.0' },
      { name: 'future', value: `${CONFIG_FORM_COMPILER_VERSION}-future` },
      { name: 'missing', value: undefined },
    ]

    for (const { name, value } of cases) {
      const pageCompilation = structuredClone(pageCompilationFixture()) as unknown as {
        key: Record<string, unknown>
      }
      pageCompilation.key.compilerVersion = value
      expect(compileCanonicalPageRuntime({
        compilation: pageCompilation as unknown as PageCompilation,
      }, resolver()), `${name} page compiler version`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_COMPILER_VERSION_UNSUPPORTED', path: ['key', 'compilerVersion'] }],
      })

      const projectWithKeyMismatch = mutableProjectCompilation()
      projectWithKeyMismatch.key.compilerVersion = value
      expect(compileCanonicalPageRuntime({
        compilation: projectWithKeyMismatch as unknown as ProjectCompilation,
        pageId: 'home',
      }, resolver()), `${name} project key compiler version`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_COMPILER_VERSION_UNSUPPORTED', path: ['key', 'compilerVersion'] }],
      })

      const projectWithIdentityMismatch = mutableProjectCompilation()
      projectWithIdentityMismatch.ir.identity.compilerVersion = value
      expect(compileCanonicalPageRuntime({
        compilation: projectWithIdentityMismatch as unknown as ProjectCompilation,
        pageId: 'home',
      }, resolver()), `${name} project IR identity compiler version`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_COMPILER_VERSION_UNSUPPORTED', path: ['ir', 'identity', 'compilerVersion'] }],
      })
    }
  })

  it('rejects additive page and node fields for page and project inputs', () => {
    const cases = [
      { key: 'flows', target: 'page' },
      { key: 'events', target: 'node' },
      { key: 'flowEvents', target: 'node' },
    ] as const

    for (const { key, target } of cases) {
      const pageCompilation = structuredClone(pageCompilationFixture()) as unknown as {
        page: Record<string, unknown>
      }
      addUnexpectedCanonicalKey(pageCompilation.page, target, key)
      expect(compileCanonicalPageRuntime({
        compilation: pageCompilation as unknown as PageCompilation,
      }, resolver()), `${key} in page compilation`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_IR_SHAPE_UNSUPPORTED', path: ['page'] }],
      })

      const projectCompilation = structuredClone(compilationFixture()) as unknown as {
        ir: { pagesById: Record<string, Record<string, unknown>> }
      }
      addUnexpectedCanonicalKey(projectCompilation.ir.pagesById.home!, target, key)
      expect(compileCanonicalPageRuntime({
        compilation: projectCompilation as unknown as ProjectCompilation,
        pageId: 'home',
      }, resolver()), `${key} in project compilation`).toMatchObject({
        success: false,
        diagnostics: [{ code: 'VUE_RUNTIME_IR_SHAPE_UNSUPPORTED', path: ['ir', 'pagesById', 'home'] }],
      })
    }
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
        bindings: {},
        field: id,
        validateOn: ['submit'],
      }
    }

    const startedAt = performance.now()
    const result = compilePage(page)
    const duration = performance.now() - startedAt

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.artifact.renderer.fields).toHaveLength(2_000)
    expect(duration).toBeLessThan(750)
  })
})
