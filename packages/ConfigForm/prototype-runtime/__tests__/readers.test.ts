import type {
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeProjectContextV1,
  PrototypeSessionV1,
} from '../src/session'
import { describe, expect, it } from 'vitest'
import {
  initializePrototypeSession,
  PROTOTYPE_SESSION_VERSION,
  readPrototypeSession,
  readPrototypeSessionCommand,
} from '../src/session'

const runtime: PrototypeInstanceRuntimeSnapshotV1 = {
  nodeAddresses: [{ nodeId: 'panel', scope: [] }],
  fieldInstances: [],
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
        topology: {
          nodeOrder: ['panel'],
          ownerScopeIdByNodeId: { panel: null },
          valueScopes: [],
          scopedFields: [],
        },
        interactions: [{
          kind: 'stateProjection',
          id: 'hide-panel',
          target: { kind: 'state', nodeId: 'panel', key: 'visible' },
          value: { version: 1, ast: { kind: 'literal', value: false } },
        }],
      },
    },
  }
}

function session(projectContext = context()): PrototypeSessionV1 {
  const initialized = initializePrototypeSession({
    projectId: projectContext.projectId,
    homeInstance: { instanceId: 'page-1', runtime },
  }, projectContext)
  expect(initialized.diagnostics).toEqual([])
  return initialized.session
}

describe('prototype contract readers', () => {
  it('accepts only a current exact session with an active Page', () => {
    const projectContext = context()
    const base = session(projectContext)
    expect(readPrototypeSession(base, projectContext).success).toBe(true)
    expect(readPrototypeSession({ ...base, version: 0 }, projectContext)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'unsupported_contract_version' }],
    })
    expect(readPrototypeSession({ ...base, legacy: true }, projectContext).success).toBe(false)
    expect(readPrototypeSession({
      version: PROTOTYPE_SESSION_VERSION,
      projectId: 'project',
      pageHistory: [],
      overlayStack: [],
      instancesById: {},
    }, projectContext)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'prototype_session_invalid', path: ['pageHistory'] }],
    })
  })

  it('rejects stale runtime snapshots and changed Surface topology', () => {
    const projectContext = context()
    const base = session(projectContext)
    const instance = base.instancesById['page-1']!
    expect(readPrototypeSession({
      ...base,
      instancesById: {
        'page-1': {
          ...instance,
          runtime: { nodeAddresses: [], fieldInstances: [] },
        },
      },
    }, projectContext).success).toBe(false)

    const changedContext: PrototypeProjectContextV1 = {
      ...projectContext,
      surfacesById: {
        home: {
          ...projectContext.surfacesById.home!,
          topology: {
            ...projectContext.surfacesById.home!.topology,
            nodeOrder: ['panel', 'late-node'],
            ownerScopeIdByNodeId: { panel: null, 'late-node': null },
          },
        },
      },
    }
    expect(readPrototypeSession(base, changedContext).success).toBe(false)
  })

  it('rejects a projection that is not the canonical recomputation', () => {
    const projectContext = context()
    const base = session(projectContext)
    const instance = base.instancesById['page-1']!
    expect(instance.projection).toHaveLength(1)
    expect(readPrototypeSession({
      ...base,
      instancesById: {
        'page-1': { ...instance, projection: [] },
      },
    }, projectContext)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'prototype_session_invalid', path: ['instancesById', 'page-1', 'projection'] }],
    })
  })

  it('rejects item on non-item triggers at the strict command boundary', () => {
    expect(readPrototypeSessionCommand({
      type: 'interaction.activate',
      sourceInstanceId: 'page-1',
      sourceAddress: { nodeId: 'button', scope: [] },
      interactionId: 'open',
      item: { id: 1 },
    }, { trigger: 'activate', actionKind: 'closeAll' })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'prototype_command_invalid' }],
    })
  })
})
