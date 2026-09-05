import type { CanonicalSourceLibraryBinding } from '../export/types'
import type {
  StandaloneSourceComponentDefinition,
  StandaloneSourceNode,
  StandaloneSourceRegistry,
} from '../export/types/source'
import { describe, expect, it } from 'vitest'
import { collectSourceLibraries } from '../export/services/source-libraries'
import { assertPortableNode } from '../export/services/source-portability'

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
    events: [{ name: 'change' }],
  }
}

function field(overrides: Partial<StandaloneSourceNode> = {}): StandaloneSourceNode {
  return {
    bindings: {},
    component: 'provider.input',
    events: {},
    field: 'name',
    flowEvents: [],
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
  it('accepts registered events and bindings recursively', () => {
    const child = field({
      bindings: { value: { source: 'sourceField' } },
      events: { change: [{ action: 'notify' }] },
      flowEvents: ['change'],
    })
    const layout: StandaloneSourceNode = {
      bindings: {},
      component: 'provider.layout',
      events: {},
      flowEvents: [],
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
      events: {},
      flowEvents: [],
      id: 'layout',
      kind: 'layout',
      placement: {},
      props: {},
      slots: { default: [field({ events: { missing: [] } })] },
    }
    const sourceRegistry = registry({
      'provider.input': definition(),
      'provider.layout': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.layout', render: 'layout-flex' },
      },
    })

    expect(() => assertPortableNode(layout, sourceRegistry)).toThrow('uses unregistered event "missing"')
  })

  it.each([
    [field({ component: 'missing.input' }), 'Component "missing.input" is not registered'],
    [field({ events: { missing: [] } }), 'uses unregistered event "missing"'],
    [field({ events: { change: [{ action: ' ' }] } }), 'contains an invalid action ref'],
    [field({ flowEvents: ['missing'] }), 'Flow uses unregistered event "missing"'],
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
      events: {},
      flowEvents: [],
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
      events: {},
      flowEvents: [],
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
