// @vitest-environment happy-dom
import type { CanonicalSourceLibraryBinding } from '../export/types'
import type {
  StandaloneSourceComponentDefinition,
  StandaloneSourceNode,
  StandaloneSourceRegistry,
} from '../export/types/source'
import { getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createStandaloneDataSourceRequestSource } from '../export/services/source-data'
import { collectSourceLibraries } from '../export/services/source-libraries'
import { appSource, standalonePageRuntimeSource } from '../export/services/source-page'
import { assertPortableNode } from '../export/services/source-portability'
import { createStandaloneValidationRuntimeSource } from '../export/services/source-validation'
import { createGeneratedModuleLoader } from './generated-runtime-module'

const baseLibrary: CanonicalSourceLibraryBinding = {
  packageName: 'provider-ui',
  plugin: 'ProviderUi',
  stylesheet: 'provider-ui/styles.css',
  version: '^1.0.0',
}

function definition(library: CanonicalSourceLibraryBinding | null = baseLibrary): StandaloneSourceComponentDefinition {
  return {
    binding: {
      component: 'provider.input',
      configComponent: 'text',
      contractFingerprint: 'fnv1a:test',
      contractVersion: '1.0.0',
      ...(library ? { library } : {}),
      render: 'component',
      tag: 'ProviderInput',
    },
    bindings: [{ name: 'value', trigger: 'update:modelValue', valueProp: 'modelValue' }],
  }
}

function field(overrides: Partial<StandaloneSourceNode> = {}): StandaloneSourceNode {
  return {
    bindings: {},
    component: 'provider.input',
    field: 'name',
    id: 'name',
    kind: 'field',
    placement: {},
    props: {},
    ...overrides,
  } as StandaloneSourceNode
}

function registry(entries: Record<string, StandaloneSourceComponentDefinition> = {
  'provider.input': definition(),
}): StandaloneSourceRegistry {
  return { get: component => entries[component] }
}

describe('standalone source portability', () => {
  it('accepts registered bindings recursively', () => {
    const child = field({
      bindings: { value: { source: 'sourceField' } },
    })
    const layout: StandaloneSourceNode = {
      bindings: {},
      component: 'provider.layout',
      id: 'layout',
      kind: 'layout',
      placement: {},
      props: {},
      slots: { default: [child] },
    }
    const sourceRegistry = registry({
      'provider.input': definition(),
      'provider.layout': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.layout', render: 'layout-flex' },
      },
    })

    expect(() => assertPortableNode(layout, sourceRegistry)).not.toThrow()
  })

  it('rejects a non-portable nested child', () => {
    const layout: StandaloneSourceNode = {
      bindings: {},
      component: 'provider.layout',
      id: 'layout',
      kind: 'layout',
      placement: {},
      props: {},
      slots: { default: [field({ bindings: { missing: { source: 'field' } } })] },
    }
    const sourceRegistry = registry({
      'provider.input': definition(),
      'provider.layout': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.layout', render: 'layout-flex' },
      },
    })

    expect(() => assertPortableNode(layout, sourceRegistry)).toThrow('uses unregistered binding "missing"')
  })

  it.each([
    [field({ component: 'missing.input' }), 'Component "missing.input" is not registered'],
    [field({ bindings: { missing: { source: 'field' } } }), 'uses unregistered binding "missing"'],
    [field({ bindings: { value: { source: ' ' } } }), 'contains an invalid source ref'],
  ])('rejects non-portable node contract %#', (node, message) => {
    expect(() => assertPortableNode(node, registry())).toThrow(message)
  })
})

describe('standalone source libraries', () => {
  it('collects nested libraries once and returns clones', () => {
    const child = field()
    const layout: StandaloneSourceNode = {
      bindings: {},
      component: 'provider.layout',
      id: 'layout',
      kind: 'layout',
      placement: {},
      props: {},
      slots: { default: [child] },
    }
    const sourceRegistry = registry({
      'provider.input': definition(),
      'provider.layout': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.layout', render: 'layout-flex' },
      },
    })

    const libraries = collectSourceLibraries([layout], sourceRegistry)

    expect(libraries).toEqual(new Map([[baseLibrary.packageName, baseLibrary]]))
    expect(libraries.get(baseLibrary.packageName)).not.toBe(baseLibrary)
  })

  it('rejects conflicting bindings for one package', () => {
    const child = field({ component: 'provider.other', field: 'other', id: 'other' })
    const layout: StandaloneSourceNode = {
      bindings: {},
      component: 'provider.layout',
      id: 'layout',
      kind: 'layout',
      placement: {},
      props: {},
      slots: { default: [child] },
    }
    const sourceRegistry = registry({
      'provider.layout': {
        ...definition(),
        binding: { ...definition().binding, component: 'provider.layout', render: 'layout-flex' },
      },
      'provider.other': {
        ...definition({ ...baseLibrary, version: '^2.0.0' }),
        binding: {
          ...definition({ ...baseLibrary, version: '^2.0.0' }).binding,
          component: 'provider.other',
        },
      },
    })

    expect(() => collectSourceLibraries([layout], sourceRegistry))
      .toThrow('Source library "provider-ui" has conflicting plugin bindings.')
  })
})

describe('standalone source configuration text', () => {
  it.each([
    '{{ ({}).constructor.constructor("globalThis.__sourceTemplateExecuted = true")() }}',
    '</script><img src=x onerror="globalThis.__sourceTemplateExecuted = true">',
    '{{ 7 * 6 }} & <tag> "quotes" \\ \u2028 \u2029',
  ])('renders configuration as literal text after real SFC compilation: %s', async (text) => {
    const sourceRegistry = registry({
      'provider.input': {
        ...definition(null),
        binding: { ...definition(null).binding, tag: 'input', valueProp: 'value' },
      },
      'provider.section': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.section', tag: 'section', render: 'section' },
      },
    })
    const root: StandaloneSourceNode[] = [{
      id: 'section',
      kind: 'layout',
      component: 'provider.section',
      props: { title: text },
      bindings: {},
      placement: {},
      slots: { default: [field({ label: text, defaultValue: text, props: { placeholder: text }, validateOn: ['submit'] })] },
    }]
    const load = await createGeneratedModuleLoader({
      ...Object.fromEntries(Object.entries(getConfigFormRuntimeSources()).map(([path, source]) => [`src/runtime/${path}`, source])),
      'src/runtime/source-page.ts': standalonePageRuntimeSource(),
      'src/data/index.ts': createStandaloneDataSourceRequestSource(),
      'src/pages/home/validation.ts': createStandaloneValidationRuntimeSource(root),
      'src/pages/home/Page.vue': appSource({
        id: 'home',
        name: text,
        route: '/',
        root,
        form: {},
        runtime: { variables: [], dataSources: [] },
        scopedFields: [{ nodeId: 'name', field: 'name', defaultValue: text }],
        valueScopes: [],
        optionBindings: [],
      }, sourceRegistry),
    })
    const marker = globalThis as typeof globalThis & { __sourceTemplateExecuted?: boolean }
    marker.__sourceTemplateExecuted = false
    const wrapper = mount(load('src/pages/home/Page.vue').default)
    try {
      expect(wrapper.get('h1').element.textContent).toBe(text)
      expect(wrapper.get('h2').element.textContent).toBe(text)
      expect(wrapper.get('label').element.textContent).toBe(text)
      expect(wrapper.get('input').attributes('placeholder')).toBe(text)
      expect((wrapper.get('input').element as HTMLInputElement).value).toBe(text)
      expect(wrapper.find('img').exists()).toBe(false)
      expect(marker.__sourceTemplateExecuted).toBe(false)
    }
    finally {
      wrapper.unmount()
      delete marker.__sourceTemplateExecuted
    }
  })
})
