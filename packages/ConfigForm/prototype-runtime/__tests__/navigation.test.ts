import type {
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeProjectContextV1,
  PrototypeSessionV1,
} from '../src/session'
import { describe, expect, it } from 'vitest'
import { initializePrototypeSession, reducePrototypeSession } from '../src/session'

function runtime(...nodeIds: string[]): PrototypeInstanceRuntimeSnapshotV1 {
  return {
    nodeAddresses: nodeIds.map(nodeId => ({ nodeId, scope: [] })),
    fieldInstances: [],
  }
}

const homeRuntime = runtime('openDrawer', 'navigate', 'closeCurrent')
const drawerRuntime = runtime('openDialog')
const dialogRuntime = runtime('dialogBody')
const secondRuntime = runtime('back')

function topology(...nodeIds: string[]) {
  return {
    nodeOrder: nodeIds,
    ownerScopeIdByNodeId: Object.fromEntries(nodeIds.map(nodeId => [nodeId, null])),
    valueScopes: [],
    scopedFields: [],
  }
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
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('openDrawer', 'navigate', 'closeCurrent'),
        interactions: [
          {
            kind: 'primaryUiAction',
            id: 'open-drawer',
            nodeId: 'openDrawer',
            trigger: 'activate',
            action: { kind: 'open', targetSurfaceId: 'drawer', parameters: [] },
          },
          {
            kind: 'primaryUiAction',
            id: 'go-second',
            nodeId: 'navigate',
            trigger: 'activate',
            action: { kind: 'navigate', targetSurfaceId: 'second', parameters: [] },
          },
          {
            kind: 'primaryUiAction',
            id: 'close-page',
            nodeId: 'closeCurrent',
            trigger: 'activate',
            action: { kind: 'closeCurrent' },
          },
        ],
      },
      second: {
        id: 'second',
        kind: 'page',
        route: '/second',
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('back'),
        interactions: [{
          kind: 'primaryUiAction',
          id: 'go-back',
          nodeId: 'back',
          trigger: 'activate',
          action: { kind: 'back' },
        }],
      },
      drawer: {
        id: 'drawer',
        kind: 'drawer',
        presentation: {
          kind: 'drawer',
          title: 'Drawer',
          placement: 'right',
          size: { desktop: { value: 420, unit: 'px' } },
          mask: true,
          close: { escape: false, mask: true, button: true },
        },
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('openDialog'),
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-dialog',
          nodeId: 'openDialog',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
        }],
      },
      dialog: {
        id: 'dialog',
        kind: 'dialog',
        presentation: {
          kind: 'dialog',
          title: 'Dialog',
          width: { desktop: { value: 480, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('dialogBody'),
        interactions: [],
      },
    },
  }
}

function start(projectContext = context()): PrototypeSessionV1 {
  const result = initializePrototypeSession({
    projectId: projectContext.projectId,
    homeInstance: { instanceId: 'page-1', runtime: homeRuntime },
  }, projectContext)
  expect(result.diagnostics).toEqual([])
  return result.session
}

function openDrawer(session: PrototypeSessionV1, instanceId: string, projectContext = context()) {
  return reducePrototypeSession(session, {
    type: 'interaction.activate',
    sourceInstanceId: 'page-1',
    sourceAddress: { nodeId: 'openDrawer', scope: [] },
    interactionId: 'open-drawer',
    nextInstance: { instanceId, runtime: drawerRuntime },
  }, projectContext)
}

describe('prototype navigation and overlay lifecycle', () => {
  it('backs through nested overlays, closes all, and restores the live opener', () => {
    const projectContext = context()
    const drawer = openDrawer(start(projectContext), 'drawer-1', projectContext)
    const dialog = reducePrototypeSession(drawer.session, {
      type: 'interaction.activate',
      sourceInstanceId: 'drawer-1',
      sourceAddress: { nodeId: 'openDialog', scope: [] },
      interactionId: 'open-dialog',
      nextInstance: { instanceId: 'dialog-1', runtime: dialogRuntime },
    }, projectContext)

    expect(dialog.session.overlayStack).toEqual(['drawer-1', 'dialog-1'])
    const backed = reducePrototypeSession(dialog.session, { type: 'history.back' }, projectContext)
    expect(backed.session.overlayStack).toEqual(['drawer-1'])
    expect(backed.session.instancesById['dialog-1']).toBeUndefined()
    expect(backed.effects).toMatchObject([
      { type: 'instance.dispose', instanceId: 'dialog-1' },
      { type: 'focus.restore', instanceId: 'drawer-1', address: { nodeId: 'openDialog', scope: [] } },
    ])

    const closed = reducePrototypeSession(backed.session, { type: 'overlay.closeAll' }, projectContext)
    expect(closed.session.overlayStack).toEqual([])
    expect(Object.keys(closed.session.instancesById)).toEqual(['page-1'])
    expect(closed.effects).toMatchObject([
      { type: 'instance.dispose', instanceId: 'drawer-1' },
      { type: 'focus.restore', instanceId: 'page-1', address: { nodeId: 'openDrawer', scope: [] } },
    ])
  })

  it('navigation clears overlays while preserving page history, then back removes the current page', () => {
    const projectContext = context()
    const drawer = openDrawer(start(projectContext), 'drawer-1', projectContext)
    const navigated = reducePrototypeSession(drawer.session, {
      type: 'interaction.activate',
      sourceInstanceId: 'page-1',
      sourceAddress: { nodeId: 'navigate', scope: [] },
      interactionId: 'go-second',
      nextInstance: { instanceId: 'page-2', runtime: secondRuntime },
    }, projectContext)

    expect(navigated.diagnostics).toEqual([])
    expect(navigated.session.pageHistory).toEqual(['page-1', 'page-2'])
    expect(navigated.session.overlayStack).toEqual([])
    expect(Object.keys(navigated.session.instancesById)).toEqual(['page-1', 'page-2'])
    expect(navigated.effects.map(effect => `${effect.type}:${effect.instanceId}`)).toEqual([
      'instance.dispose:drawer-1',
      'instance.mount:page-2',
      'instance.projection.replace:page-2',
    ])

    const backed = reducePrototypeSession(navigated.session, { type: 'history.back' }, projectContext)
    expect(backed.session.pageHistory).toEqual(['page-1'])
    expect(Object.keys(backed.session.instancesById)).toEqual(['page-1'])
    expect(backed.effects).toEqual([{ type: 'instance.dispose', instanceId: 'page-2' }])
  })

  it('enforces dismiss policy and rejects closeCurrent on a Page', () => {
    const projectContext = context()
    const session = start(projectContext)
    const pageClose = reducePrototypeSession(session, {
      type: 'interaction.activate',
      sourceInstanceId: 'page-1',
      sourceAddress: { nodeId: 'closeCurrent', scope: [] },
      interactionId: 'close-page',
    }, projectContext)
    expect(pageClose.session).toBe(session)
    expect(pageClose.diagnostics).toMatchObject([{ code: 'prototype_action_invalid' }])

    const drawer = openDrawer(session, 'drawer-1', projectContext)
    const blocked = reducePrototypeSession(drawer.session, {
      type: 'overlay.dismiss',
      instanceId: 'drawer-1',
      reason: 'escape',
    }, projectContext)
    expect(blocked.session).toBe(drawer.session)
    expect(blocked.effects).toEqual([])

    const dismissed = reducePrototypeSession(drawer.session, {
      type: 'overlay.dismiss',
      instanceId: 'drawer-1',
      reason: 'mask',
    }, projectContext)
    expect(dismissed.diagnostics).toEqual([])
    expect(dismissed.session.overlayStack).toEqual([])
    expect(dismissed.session.instancesById['drawer-1']).toBeUndefined()
  })
})
