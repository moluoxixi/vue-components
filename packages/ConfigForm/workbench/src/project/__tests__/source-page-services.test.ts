// @vitest-environment happy-dom
import type {
  ModelJsonObject,
  PrototypeProjectContextV1,
  PrototypeSurfaceContractV1,
  SurfaceInstanceV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { PrototypeVueSurfaceRendererBindings } from '@moluoxixi/config-form-prototype-runtime/vue'
import type { CanonicalSourceLibraryBinding } from '../export/types'
import type {
  StandaloneSourceComponentDefinition,
  StandaloneSourceElementNode,
  StandaloneSourceFieldNode,
  StandaloneSourceLayoutNode,
  StandaloneSourceRegistry,
  StandaloneSourceSurface,
} from '../export/types/source'
import { getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { collectSourceLibraries } from '../export/services/source-libraries'
import { appSource, standaloneSurfaceRuntimeSource } from '../export/services/source-page'
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

function field(overrides: Partial<StandaloneSourceFieldNode> = {}): StandaloneSourceFieldNode {
  return {
    component: 'provider.input',
    field: 'name',
    id: 'name',
    kind: 'field',
    placement: {},
    props: {},
    validateOn: ['submit'],
    ...overrides,
  }
}

function element(overrides: Partial<StandaloneSourceElementNode> = {}): StandaloneSourceElementNode {
  return {
    component: 'provider.output',
    id: 'output',
    kind: 'element',
    placement: {},
    props: {},
    ...overrides,
  }
}

function layout(
  children: Array<StandaloneSourceElementNode | StandaloneSourceFieldNode | StandaloneSourceLayoutNode>,
  overrides: Partial<StandaloneSourceLayoutNode> = {},
): StandaloneSourceLayoutNode {
  return {
    component: 'provider.layout',
    id: 'layout',
    kind: 'layout',
    placement: {},
    props: {},
    slots: { default: children },
    ...overrides,
  }
}

function registry(entries: Record<string, StandaloneSourceComponentDefinition> = {
  'provider.input': definition(),
}): StandaloneSourceRegistry {
  return { get: component => entries[component] }
}

function nativeRegistry(): StandaloneSourceRegistry {
  return registry({
    'provider.input': {
      ...definition(null),
      binding: { ...definition(null).binding, tag: 'input', valueProp: 'value' },
    },
    'provider.layout': {
      ...definition(null),
      binding: {
        ...definition(null).binding,
        component: 'provider.layout',
        render: 'section',
        tag: 'section',
      },
    },
    'provider.output': {
      ...definition(null),
      binding: {
        ...definition(null).binding,
        component: 'provider.output',
        tag: 'output',
      },
    },
  })
}

function sourceSurface(
  kind: StandaloneSourceSurface['kind'],
  name: string,
  root: StandaloneSourceSurface['root'],
): StandaloneSourceSurface {
  const base = {
    form: {},
    id: `${kind}-surface`,
    kind,
    name,
    root,
    scopedFields: root.length > 0
      ? [{ nodeId: 'name', field: 'name', defaultValue: name }]
      : [],
    valueScopes: [],
  }
  if (kind === 'page')
    return { ...base, kind, route: `/${kind}` }
  if (kind === 'dialog') {
    return {
      ...base,
      kind,
      presentation: {
        kind,
        title: `Dialog: ${name}`,
        width: { desktop: { value: 640, unit: 'px' } },
        mask: true,
        close: { escape: true, mask: true, button: true },
      },
    }
  }
  return {
    ...base,
    kind,
    presentation: {
      kind,
      title: `Drawer: ${name}`,
      placement: 'right',
      size: { desktop: { value: 40, unit: '%' } },
      mask: false,
      close: { escape: true, mask: false, button: true },
    },
  }
}

function flattenedNodes(nodes: readonly StandaloneSourceSurface['root'][number][]): StandaloneSourceSurface['root'] {
  return nodes.flatMap(node => node.kind === 'layout'
    ? [node, ...flattenedNodes(Object.values(node.slots).flat())]
    : [node])
}

function prototypeBindings(surface: StandaloneSourceSurface): PrototypeVueSurfaceRendererBindings {
  const nodes = flattenedNodes(surface.root)
  const values = Object.fromEntries(surface.scopedFields.flatMap(field => (
    field.defaultValue === undefined ? [] : [[field.field, structuredClone(field.defaultValue)]]
  ))) as ModelJsonObject
  const topology = {
    nodeOrder: nodes.map(node => node.id),
    ownerScopeIdByNodeId: Object.fromEntries(nodes.map(node => [node.id, null])),
    valueScopes: [],
    scopedFields: surface.scopedFields,
  }
  const contractBase = {
    id: surface.id,
    initialValues: values,
    parameters: [],
    outputs: [],
    interactions: [],
    topology,
  }
  const contract: PrototypeSurfaceContractV1 = surface.kind === 'page'
    ? {
        ...contractBase,
        kind: 'page',
        route: surface.route,
      }
    : surface.kind === 'dialog'
      ? {
          ...contractBase,
          kind: 'dialog',
          presentation: surface.presentation,
        }
      : {
          ...contractBase,
          kind: 'drawer',
          presentation: surface.presentation,
        }
  const runtime = {
    nodeAddresses: nodes.map(node => ({ nodeId: node.id, scope: [] })),
    fieldInstances: nodes.flatMap(node => node.kind === 'field'
      ? [{ address: { nodeId: node.id, scope: [] }, valuePath: [node.field] }]
      : []),
  }
  const instance: SurfaceInstanceV1 = {
    instanceId: 'surface-instance',
    surfaceId: surface.id,
    parameters: {},
    values,
    runtime,
    projection: [],
  }
  const context: PrototypeProjectContextV1 = {
    version: 1,
    projectId: 'source-project',
    homeSurfaceId: surface.kind === 'page' ? surface.id : 'home',
    surfacesById: { [surface.id]: contract },
  }
  const session = {
    version: 1 as const,
    projectId: context.projectId,
    pageHistory: surface.kind === 'page' ? [instance.instanceId] : [],
    overlayStack: surface.kind === 'page' ? [] : [instance.instanceId],
    instancesById: { [instance.instanceId]: instance },
  }
  const snapshot = { session, diagnostics: [] }
  return {
    instance,
    surface: contract,
    values,
    projection: [],
    createRowIdFactory: () => input => `${input.scopeId}-${input.attempt}`,
    registerController: () => () => {},
    activate: async () => ({ status: 'invalid', snapshot }),
    valuesChanged: () => snapshot,
  }
}

async function generatedSurfaceLoader(
  surfaces: readonly StandaloneSourceSurface[],
  sourceRegistry: StandaloneSourceRegistry,
) {
  const files: Record<string, string> = {
    ...Object.fromEntries(Object.entries(getConfigFormRuntimeSources()).map(([path, source]) => [`src/runtime/${path}`, source])),
    'src/runtime/source-page.ts': standaloneSurfaceRuntimeSource(),
  }
  surfaces.forEach((surface) => {
    const directory = `src/surfaces/${surface.id}`
    files[`${directory}/Surface.vue`] = appSource(surface, sourceRegistry)
    files[`${directory}/validation.ts`] = createStandaloneValidationRuntimeSource(surface.root)
  })
  return createGeneratedModuleLoader(files)
}

describe('standalone source portability', () => {
  it('accepts registered field, layout, and element nodes recursively', () => {
    const root = layout([field(), element()])
    expect(() => assertPortableNode(root, nativeRegistry())).not.toThrow()
  })

  it('rejects a non-portable nested child', () => {
    const root = layout([field({ component: 'missing.input' })])
    expect(() => assertPortableNode(root, nativeRegistry()))
      .toThrow('Component "missing.input" is not registered')
  })

  it.each([
    [field({ component: 'missing.input' }), 'Component "missing.input" is not registered'],
    [field({ props: { innerHTML: '<strong>unsafe</strong>' } }), 'uses blocked DOM sink prop "innerHTML"'],
  ])('rejects non-portable node contract %#', (node, message) => {
    expect(() => assertPortableNode(node, registry())).toThrow(message)
  })
})

describe('standalone source libraries', () => {
  it('collects nested libraries once and returns clones', () => {
    const root = layout([field(), element({ component: 'provider.input', id: 'summary' })])
    const sourceRegistry = registry({
      'provider.input': definition(),
      'provider.layout': {
        ...definition(null),
        binding: { ...definition(null).binding, component: 'provider.layout', render: 'layout-flex' },
      },
    })

    const libraries = collectSourceLibraries([root], sourceRegistry)

    expect(libraries).toEqual(new Map([[baseLibrary.packageName, baseLibrary]]))
    expect(libraries.get(baseLibrary.packageName)).not.toBe(baseLibrary)
  })

  it('rejects conflicting bindings for one package', () => {
    const root = layout([field({ component: 'provider.other', field: 'other', id: 'other' })])
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

    expect(() => collectSourceLibraries([root], sourceRegistry))
      .toThrow('Source library "provider-ui" has conflicting plugin bindings.')
  })
})

describe('standalone Surface source', () => {
  it('does not generate removed authoring or request runtime channels', () => {
    const root = [layout([field(), element()])]
    const sourceRegistry = nativeRegistry()
    const componentSource = appSource(sourceSurface('page', 'Home', root), sourceRegistry)
    const rendererSource = standaloneSurfaceRuntimeSource()

    expect(componentSource).not.toMatch(/createSourceDataSourceRequest|data-source-host|globalThis\.fetch/)
    expect(componentSource).not.toMatch(/defineEmits|emit\(['"]submit/)
    expect(componentSource).toContain(`from '@moluoxixi/config-form-prototype-runtime/session'`)
    expect(rendererSource).not.toMatch(/\b(?:conditions|dataSources|optionSource|reactions|variables)\b/)
    expect(rendererSource).not.toMatch(/\bruntime\s*:/)
    expect(rendererSource).not.toContain('evaluateConfigFormReactionCondition')
  })

  it.each([
    '{{ ({}).constructor.constructor("globalThis.__sourceTemplateExecuted = true")() }}',
    '</script><img src=x onerror="globalThis.__sourceTemplateExecuted = true">',
    '{{ 7 * 6 }} & <tag> "quotes" \\ \u2028 \u2029',
  ])('renders field, layout, and element configuration as literal text: %s', async (text) => {
    const root = [layout([
      field({ label: text, defaultValue: text, props: { placeholder: text } }),
      element({ props: { 'data-content': text, 'title': text } }),
    ], { props: { title: text } })]
    const surface = sourceSurface('page', text, root)
    const load = await generatedSurfaceLoader([surface], nativeRegistry())
    const marker = globalThis as typeof globalThis & { __sourceTemplateExecuted?: boolean }
    marker.__sourceTemplateExecuted = false
    const wrapper = mount(load(`src/surfaces/${surface.id}/Surface.vue`).default, {
      props: { prototype: prototypeBindings(surface) },
    })
    try {
      expect(wrapper.get('h2').element.textContent).toBe(text)
      expect(wrapper.get('label').element.textContent).toBe(text)
      expect(wrapper.get('input').attributes('placeholder')).toBe(text)
      expect((wrapper.get('input').element as HTMLInputElement).value).toBe(text)
      expect(wrapper.get('output').attributes('data-content')).toBe(text)
      expect(wrapper.get('output').attributes('title')).toBe(text)
      expect(wrapper.find('img').exists()).toBe(false)
      expect(marker.__sourceTemplateExecuted).toBe(false)
    }
    finally {
      wrapper.unmount()
      delete marker.__sourceTemplateExecuted
    }
  })

  it('uses one renderer while delegating Page, Dialog, and Drawer chrome to the Prototype host', async () => {
    const surfaces = [
      sourceSurface('page', 'Home', [element({ props: { 'data-marker': 'page' } })]),
      sourceSurface('dialog', 'Editor', [element({ props: { 'data-marker': 'dialog' } })]),
      sourceSurface('drawer', 'Details', [element({ props: { 'data-marker': 'drawer' } })]),
    ] as const
    const load = await generatedSurfaceLoader(surfaces, nativeRegistry())

    for (const surface of surfaces) {
      const wrapper = mount(load(`src/surfaces/${surface.id}/Surface.vue`).default, {
        props: { prototype: prototypeBindings(surface) },
      })
      try {
        expect(wrapper.element.tagName).toBe('DIV')
        expect(wrapper.attributes('class')).toBe('source-surface')
        expect(wrapper.attributes('data-surface-id')).toBe(surface.id)
        expect(wrapper.attributes('data-surface-kind')).toBe(surface.kind)
        expect(wrapper.get('output').attributes('data-marker')).toBe(surface.kind)
        expect(wrapper.find('[data-field]').exists()).toBe(false)
        expect(wrapper.attributes('role')).toBeUndefined()
        expect(wrapper.attributes('aria-modal')).toBeUndefined()
      }
      finally {
        wrapper.unmount()
      }
    }
  })
})
