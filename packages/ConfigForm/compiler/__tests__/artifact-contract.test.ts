import { describe, expect, it } from 'vitest'
import { hasOnlyCurrentCanonicalPageKeys } from '../index'

function pageFixture(): Record<string, unknown> {
  return {
    form: {},
    id: 'home',
    name: 'Home',
    nodesById: {
      name: {
        bindings: {},
        component: 'element.input',
        componentFingerprint: 'fnv1a:field',
        componentVersion: '1',
        configuredProps: {},
        field: 'name',
        id: 'name',
        kind: 'field',
        placement: { parentId: null, props: {}, slot: null },
        props: {},
        subtreeHash: 'fnv1a:name',
        validateOn: ['submit'],
      },
    },
    props: {},
    rootIds: ['name'],
    route: '/',
    scopedFields: [{ field: 'name', nodeId: 'name' }],
    valueScopes: [],
  }
}

function fieldNode(page: Record<string, unknown>): Record<string, unknown> {
  return (page.nodesById as Record<string, Record<string, unknown>>).name!
}

describe('current Canonical page keys', () => {
  it('accepts current page and node keys', () => {
    expect(hasOnlyCurrentCanonicalPageKeys(pageFixture())).toBe(true)
  })

  it('rejects additive stale page and node keys', () => {
    const pageMetadata = pageFixture()
    pageMetadata.flows = []
    expect(hasOnlyCurrentCanonicalPageKeys(pageMetadata)).toBe(false)

    const nodeEvents = pageFixture()
    fieldNode(nodeEvents).events = {}
    expect(hasOnlyCurrentCanonicalPageKeys(nodeEvents)).toBe(false)

    const nodeFlowEvents = pageFixture()
    fieldNode(nodeFlowEvents).flowEvents = {}
    expect(hasOnlyCurrentCanonicalPageKeys(nodeFlowEvents)).toBe(false)
  })

  it('rejects an unknown node kind', () => {
    const page = pageFixture()
    fieldNode(page).kind = 'unknown'
    expect(hasOnlyCurrentCanonicalPageKeys(page)).toBe(false)
  })
})
