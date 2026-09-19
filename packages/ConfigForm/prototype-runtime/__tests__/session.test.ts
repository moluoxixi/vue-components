import type {
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeProjectContextV1,
  PrototypeSessionV1,
} from '../src/session'
import { describe, expect, it } from 'vitest'
import {
  initializePrototypeSession,
  reducePrototypeSession,
} from '../src/session'

const rootRuntime: PrototypeInstanceRuntimeSnapshotV1 = {
  nodeAddresses: [
    { nodeId: 'open', scope: [] },
    { nodeId: 'name', scope: [] },
  ],
  fieldInstances: [{
    address: { nodeId: 'name', scope: [] },
    valuePath: ['name'],
  }],
}

const dialogRuntime: PrototypeInstanceRuntimeSnapshotV1 = {
  nodeAddresses: [{ nodeId: 'close', scope: [] }, { nodeId: 'value', scope: [] }],
  fieldInstances: [{ address: { nodeId: 'value', scope: [] }, valuePath: ['value'] }],
}

function context(): PrototypeProjectContextV1 {
  return {
    version: 1,
    projectId: 'project',
    homeSurfaceId: 'home',
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        route: '/',
        initialValues: { name: '' },
        parameters: [],
        outputs: [],
        topology: {
          nodeOrder: ['open', 'name'],
          ownerScopeIdByNodeId: { open: null, name: null },
          valueScopes: [],
          scopedFields: [{ nodeId: 'name', field: 'name' }],
        },
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-editor',
          nodeId: 'open',
          trigger: 'activate',
          action: {
            kind: 'open',
            targetSurfaceId: 'editor',
            parameters: [],
            onResults: [{
              resultName: 'saved',
              assignments: [{
                targetFieldId: 'name',
                value: { version: 1, ast: { kind: 'reference', scope: 'result', path: [] } },
              }],
            }],
          },
        }],
      },
      editor: {
        id: 'editor',
        kind: 'dialog',
        presentation: {
          kind: 'dialog',
          title: 'Editor',
          width: { desktop: { value: 480, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        initialValues: { value: 'Ada' },
        parameters: [],
        outputs: [{ name: 'saved' }],
        topology: {
          nodeOrder: ['close', 'value'],
          ownerScopeIdByNodeId: { close: null, value: null },
          valueScopes: [],
          scopedFields: [{ nodeId: 'value', field: 'value' }],
        },
        interactions: [{
          kind: 'primaryUiAction',
          id: 'save',
          nodeId: 'close',
          trigger: 'activate',
          action: {
            kind: 'closeCurrent',
            result: {
              name: 'saved',
              value: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['value'] } },
            },
          },
        }],
      },
    },
  }
}

function start(): PrototypeSessionV1 {
  const result = initializePrototypeSession({
    projectId: 'project',
    homeInstance: { instanceId: 'page-1', runtime: rootRuntime },
  }, context())
  expect(result.diagnostics).toEqual([])
  return result.session
}

describe('prototype session v1', () => {
  it('opens repeated isolated instances and closes the top result atomically', () => {
    const opened = reducePrototypeSession(start(), {
      type: 'interaction.activate',
      sourceInstanceId: 'page-1',
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-editor',
      nextInstance: { instanceId: 'dialog-1', runtime: dialogRuntime },
    }, context())
    expect(opened.diagnostics).toEqual([])
    expect(opened.session.overlayStack).toEqual(['dialog-1'])
    expect(opened.session.instancesById['dialog-1']).toMatchObject({
      surfaceId: 'editor',
      parentInstanceId: 'page-1',
      openerInteractionId: 'open-editor',
    })

    const repeated = reducePrototypeSession(opened.session, {
      type: 'interaction.activate',
      sourceInstanceId: 'page-1',
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-editor',
      nextInstance: { instanceId: 'dialog-2', runtime: dialogRuntime },
    }, context())
    expect(repeated.session.overlayStack).toEqual(['dialog-1', 'dialog-2'])
    expect(repeated.session.instancesById['dialog-1']).not.toBe(repeated.session.instancesById['dialog-2'])

    const closed = reducePrototypeSession(repeated.session, {
      type: 'interaction.activate',
      sourceInstanceId: 'dialog-2',
      sourceAddress: { nodeId: 'close', scope: [] },
      interactionId: 'save',
    }, context())
    expect(closed.diagnostics).toEqual([])
    expect(closed.session.overlayStack).toEqual(['dialog-1'])
    expect(closed.session.instancesById['dialog-2']).toBeUndefined()
    expect(closed.session.instancesById['page-1']?.values).toEqual({ name: 'Ada' })
    expect(closed.effects.map(effect => effect.type)).toEqual([
      'instance.values.replace',
      'instance.projection.replace',
      'instance.dispose',
      'focus.restore',
    ])
  })

  it('returns the identical session on invalid instance commands', () => {
    const session = start()
    const result = reducePrototypeSession(session, {
      type: 'interaction.activate',
      sourceInstanceId: 'missing',
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-editor',
      nextInstance: { instanceId: 'dialog-1', runtime: dialogRuntime },
    }, context())
    expect(result.session).toBe(session)
    expect(result.effects).toEqual([])
    expect(result.diagnostics).toMatchObject([{ code: 'prototype_instance_not_found' }])
  })
})
