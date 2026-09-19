import { describe, expect, it } from 'vitest'
import { hasOnlyCurrentCanonicalSurfaceKeys } from '../index'

function surfaceFixture(): Record<string, unknown> {
  return {
    form: {},
    id: 'home',
    interactions: [],
    kind: 'page',
    name: 'Home',
    nodesById: {
      name: {
        component: 'field.input',
        componentFingerprint: 'fnv1a:field',
        componentVersion: '1',
        configuredProps: {},
        defaultValue: 'Ada',
        field: 'name',
        id: 'name',
        kind: 'field',
        placement: { parentId: null, props: {}, slot: null },
        props: {},
        subtreeHash: 'fnv1a:name',
        validateOn: ['submit'],
      },
    },
    outputs: [],
    parameters: [],
    props: {},
    rootIds: ['name'],
    route: '/',
    scopedFields: [{ field: 'name', nodeId: 'name' }],
    valueScopes: [],
  }
}

function fieldNode(surface: Record<string, unknown>): Record<string, unknown> {
  return (surface.nodesById as Record<string, Record<string, unknown>>).name!
}

describe('current Canonical Surface keys', () => {
  it('accepts current page and node keys, including element nodes', () => {
    const surface = surfaceFixture()
    expect(hasOnlyCurrentCanonicalSurfaceKeys(surface)).toBe(true)
    const element = fieldNode(surface)
    element.kind = 'element'
    delete element.field
    delete element.validateOn
    delete element.defaultValue
    expect(hasOnlyCurrentCanonicalSurfaceKeys(surface)).toBe(true)
  })

  it('accepts dialog and drawer presentation keys', () => {
    for (const kind of ['dialog', 'drawer'] as const) {
      const surface = surfaceFixture()
      delete surface.route
      surface.kind = kind
      surface.presentation = { kind, title: kind, mask: true, close: { escape: true, mask: true, button: true } }
      expect(hasOnlyCurrentCanonicalSurfaceKeys(surface)).toBe(true)
    }
  })

  it('rejects removed event and low-code fields', () => {
    const surfaceMetadata = surfaceFixture()
    surfaceMetadata.flows = []
    expect(hasOnlyCurrentCanonicalSurfaceKeys(surfaceMetadata)).toBe(false)

    for (const key of ['bindings', 'conditions', 'reactions', 'optionSource', 'runtime']) {
      const stale = surfaceFixture()
      fieldNode(stale)[key] = {}
      expect(hasOnlyCurrentCanonicalSurfaceKeys(stale), key).toBe(false)
    }
  })

  it('rejects an unknown node kind and missing node table', () => {
    const surface = surfaceFixture()
    fieldNode(surface).kind = 'unknown'
    expect(hasOnlyCurrentCanonicalSurfaceKeys(surface)).toBe(false)
    expect(hasOnlyCurrentCanonicalSurfaceKeys({ ...surface, nodesById: undefined })).toBe(false)
  })
})
