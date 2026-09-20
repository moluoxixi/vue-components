import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { MaterialSemanticTrigger } from '@moluoxixi/config-form-model'
import type {
  SourceComponentResolution,
  SourceComponentResolver,
  SourceConfigFormBindingResolver,
  SourceSemanticListenerMap,
} from '../types'
import { describe, expect, it } from 'vitest'
import { resolveConfigFormBinding, resolveSourceComponents } from '../services/resolution'

function compilation(trigger: MaterialSemanticTrigger): ProjectCompilation {
  return {
    ir: {
      surfaceOrder: ['home'],
      surfacesById: {
        home: {
          id: 'home',
          nodesById: {
            action: {
              id: 'action',
              component: 'fixture.action',
              componentVersion: '1',
              componentFingerprint: 'fixture-fingerprint',
            },
          },
          interactions: [{
            kind: 'primaryUiAction',
            id: 'interaction',
            nodeId: 'action',
            trigger,
            action: { kind: 'back' },
          }],
        },
      },
    },
  } as unknown as ProjectCompilation
}

function componentResolution(
  semanticListeners?: SourceSemanticListenerMap,
): SourceComponentResolution {
  return {
    moduleSpecifier: '',
    importName: '',
    tag: 'button',
    configComponent: 'button',
    render: 'component',
    styleImports: [],
    dependencies: {},
    ...(semanticListeners ? { semanticListeners } : {}),
  }
}

function resolver(resolution: SourceComponentResolution): SourceComponentResolver {
  return {
    adapter: { adapter: 'fixture', adapterVersion: '1', registryFingerprint: 'registry' },
    resolveComponent: () => ({ success: true, value: resolution }),
  }
}

describe('source semantic listener resolution', () => {
  it('accepts explicit scalar and item semantic listener mappings', () => {
    const activate = resolveSourceComponents(compilation('activate'), resolver(componentResolution({
      activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'none' } },
    })))
    const rowActivate = resolveSourceComponents(compilation('rowActivate'), resolver(componentResolution({
      rowActivate: { event: 'row-click', listenerProp: 'onRowClick', item: { kind: 'argument', index: 0 } },
    })))
    const itemActivate = resolveSourceComponents(compilation('itemActivate'), resolver(componentResolution({
      itemActivate: { event: 'item-click', listenerProp: 'onItemClick', item: { kind: 'argument', index: 1 } },
    })))

    expect(activate.success).toBe(true)
    expect(rowActivate.success).toBe(true)
    expect(itemActivate.success).toBe(true)
  })

  it('rejects a used semantic trigger without a provider mapping', () => {
    const result = resolveSourceComponents(compilation('activate'), resolver(componentResolution()))

    expect(result).toEqual({
      success: false,
      diagnostics: [{
        code: 'source_resolution_failed',
        message: 'Component "fixture.action" does not resolve the used semantic trigger "activate".',
        context: {
          componentKey: 'fixture.action',
          nodeId: 'action',
          surfaceId: 'home',
          trigger: 'activate',
        },
      }],
    })
  })

  it.each([
    ['directive event', { activate: { event: 'click.prevent', listenerProp: 'onClick', item: { kind: 'none' } } }],
    ['mismatched listener prop', { activate: { event: 'click', listenerProp: 'onActivate', item: { kind: 'none' } } }],
    ['argument extraction for a scalar trigger', { activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'argument', index: 0 } } }],
    ['missing argument extraction for an item trigger', { rowActivate: { event: 'row-click', listenerProp: 'onRowClick', item: { kind: 'none' } } }],
    ['negative argument index', { rowActivate: { event: 'row-click', listenerProp: 'onRowClick', item: { kind: 'argument', index: -1 } } }],
    ['unknown trigger key', { hover: { event: 'mouseenter', listenerProp: 'onMouseenter', item: { kind: 'none' } } }],
  ])('rejects invalid %s metadata', (_case, semanticListeners) => {
    const trigger = Object.hasOwn(semanticListeners, 'rowActivate') ? 'rowActivate' : 'activate'
    const result = resolveSourceComponents(
      compilation(trigger),
      resolver(componentResolution(semanticListeners as unknown as SourceSemanticListenerMap)),
    )

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.diagnostics[0]).toMatchObject({ code: 'source_resolution_failed' })
  })

  it.each([
    ['component style import', {
      ...componentResolution({
        activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'none' } },
      }),
      styleImports: ['fixture-theme/styles.css'],
    }],
    ['library stylesheet', {
      ...componentResolution({
        activate: { event: 'click', listenerProp: 'onClick', item: { kind: 'none' } },
      }),
      moduleSpecifier: 'fixture-ui',
      importName: 'FixturePlugin',
      styleImports: [],
      dependencies: { 'fixture-ui': '1.0.0' },
      library: {
        packageName: 'fixture-ui',
        plugin: 'FixturePlugin',
        version: '1.0.0',
        stylesheet: 'fixture-theme/styles.css',
      },
    }],
  ])('rejects an undeclared package used by a %s', (_case, resolution) => {
    const result = resolveSourceComponents(compilation('activate'), resolver(resolution))

    expect(result).toEqual({
      success: false,
      diagnostics: [{
        code: 'source_resolution_failed',
        message: 'Component "fixture.action" style import "fixture-theme/styles.css" does not declare a version for "fixture-theme".',
        context: { componentKey: 'fixture.action' },
      }],
    })
  })
})

describe('config form binding resolution', () => {
  it('returns a stable diagnostic for malformed successful resolver results', () => {
    const resolver: SourceConfigFormBindingResolver = {
      resolveConfigFormBinding: () => ({ success: true, value: null } as unknown as never),
    }
    const result = resolveConfigFormBinding(resolver)

    expect(result).toEqual({
      success: false,
      diagnostics: [{
        code: 'source_resolution_failed',
        message: 'ConfigForm binding resolution is invalid.',
      }],
    })
  })

  it('rejects a binding style import whose package dependency is undeclared', () => {
    const result = resolveConfigFormBinding({
      resolveConfigFormBinding: () => ({
        success: true,
        value: {
          component: { moduleSpecifier: '@moluoxixi/config-form-element', importName: 'ElementConfigForm' },
          model: { moduleSpecifier: '@moluoxixi/config-form-headless', importName: 'createConfigFormModel' },
          styleImports: ['fixture-theme/styles.css'],
          dependencies: {
            '@moluoxixi/config-form-element': '1.0.0',
            '@moluoxixi/config-form-headless': '1.0.0',
          },
        },
      }),
    })

    expect(result).toEqual({
      success: false,
      diagnostics: [{
        code: 'source_resolution_failed',
        message: 'ConfigForm binding style import "fixture-theme/styles.css" does not declare a version for "fixture-theme".',
      }],
    })
  })
})
