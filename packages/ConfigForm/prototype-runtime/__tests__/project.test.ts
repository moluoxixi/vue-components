import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import { describe, expect, it } from 'vitest'
import {
  createPrototypeProjectContext,
  initializePrototypeProjectSession,
} from '../src/session'

function compilation(): ProjectCompilation {
  return {
    key: { projectId: 'project' },
    ir: {
      homeSurfaceId: 'home',
      surfaceOrder: ['home', 'drawer'],
      surfacesById: {
        home: {
          id: 'home',
          kind: 'page',
          route: '/',
          parameters: [],
          outputs: [],
          interactions: [],
          nodesById: {
            rows: {
              id: 'rows',
              kind: 'layout',
              placement: { parentId: null },
              valueScope: { field: 'rows', kind: 'array', minItems: 1 },
            },
            name: {
              id: 'name',
              kind: 'field',
              placement: { parentId: 'rows' },
            },
            action: {
              id: 'action',
              kind: 'element',
              placement: { parentId: 'rows' },
            },
          },
          valueScopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 1 }],
          scopedFields: [{ nodeId: 'name', field: 'name', scopeId: 'rows', defaultValue: 'Ada' }],
        },
        drawer: {
          id: 'drawer',
          kind: 'drawer',
          presentation: {
            kind: 'drawer',
            title: 'Details',
            placement: 'right',
            size: { desktop: { value: 40, unit: '%' } },
            mask: true,
            close: { escape: true, mask: true, button: true },
          },
          parameters: [],
          outputs: [],
          interactions: [],
          nodesById: {},
          valueScopes: [],
          scopedFields: [],
        },
      },
    },
  } as unknown as ProjectCompilation
}

describe('ProjectCompilation Prototype projection', () => {
  it('projects strict Surface contracts and derives scoped initial values and owners', () => {
    const result = createPrototypeProjectContext(compilation())

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.surfacesById.home).toMatchObject({
      id: 'home',
      kind: 'page',
      route: '/',
      initialValues: { rows: [{ name: 'Ada' }] },
      topology: {
        nodeOrder: ['rows', 'name', 'action'],
        ownerScopeIdByNodeId: { rows: null, name: 'rows', action: 'rows' },
      },
    })
    expect(result.data.surfacesById.drawer).toMatchObject({
      id: 'drawer',
      kind: 'drawer',
      presentation: { placement: 'right' },
    })
  })

  it('creates a strict initial session with caller-owned row identities', () => {
    let nextRow = 0
    const result = initializePrototypeProjectSession({
      compilation: compilation(),
      homeInstanceId: 'page-1',
      createRowId: () => `fixture-row-${++nextRow}`,
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.pageHistory).toEqual(['page-1'])
    expect(result.data.instancesById['page-1']).toMatchObject({
      instanceId: 'page-1',
      surfaceId: 'home',
      values: { rows: [{ name: 'Ada' }] },
      runtime: {
        nodeAddresses: [
          { nodeId: 'rows', scope: [] },
          { nodeId: 'name', scope: [{ scopeId: 'rows', rowId: 'fixture-row-1' }] },
          { nodeId: 'action', scope: [{ scopeId: 'rows', rowId: 'fixture-row-1' }] },
        ],
      },
    })
  })

  it('fails closed when the compiler map and Surface identity disagree', () => {
    const input = compilation() as unknown as {
      ir: { surfacesById: { home: { id: string } } }
    }
    input.ir.surfacesById.home.id = 'other'

    expect(createPrototypeProjectContext(input as unknown as ProjectCompilation)).toEqual(
      expect.objectContaining({
        success: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'prototype_session_invalid' }),
        ]),
      }),
    )
  })
})
