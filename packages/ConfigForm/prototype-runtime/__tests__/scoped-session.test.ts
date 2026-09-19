import type {
  ModelJsonObject,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeInteraction,
  PrototypeNodeAddressV1,
  PrototypeProjectContextV1,
  PrototypeSurfaceContractV1,
  SafeExpressionV1,
} from '../src/session'
import { describe, expect, it } from 'vitest'
import {
  createPrototypeInstanceRuntimeSnapshot,
  evaluatePrototypeExpression,
  initializePrototypeSession,
  reducePrototypeSession,
} from '../src/session'

function nestedValues() {
  return {
    rootName: 'Root',
    groups: [
      {
        id: 'group-a',
        name: 'Group A',
        items: [
          { id: 'item-a', value: 'A', mirror: '', enabled: true },
          { id: 'item-b', value: 'B', mirror: '', enabled: false },
        ],
      },
      {
        id: 'group-b',
        name: 'Group B',
        items: [{ id: 'item-c', value: 'C', mirror: '', enabled: true }],
      },
    ],
  }
}

function valueReference(
  path: readonly string[],
  selector?: 'current' | 'parent' | 'root',
): SafeExpressionV1 {
  return {
    version: 1,
    ast: {
      kind: 'reference',
      scope: 'values',
      ...(selector ? { selector } : {}),
      path,
    },
  }
}

const projectionRule: PrototypeInteraction = {
  kind: 'stateProjection',
  id: 'project-item-visibility',
  target: { kind: 'state', nodeId: 'itemAction', key: 'visible' },
  value: valueReference(['enabled']),
}

function nestedSurface(interactions: readonly PrototypeInteraction[] = [projectionRule]): PrototypeSurfaceContractV1 {
  return {
    id: 'home',
    kind: 'page',
    route: '/',
    initialValues: nestedValues(),
    parameters: [],
    outputs: [],
    interactions,
    topology: {
      nodeOrder: [
        'rootName',
        'groupsScope',
        'groupName',
        'itemsScope',
        'itemValue',
        'itemMirror',
        'itemAction',
      ],
      ownerScopeIdByNodeId: {
        rootName: null,
        groupsScope: null,
        groupName: 'groupsScope',
        itemsScope: 'groupsScope',
        itemValue: 'itemsScope',
        itemMirror: 'itemsScope',
        itemAction: 'itemsScope',
      },
      valueScopes: [
        { nodeId: 'groupsScope', field: 'groups', kind: 'array', itemKey: 'id' },
        { nodeId: 'itemsScope', field: 'items', kind: 'array', parentId: 'groupsScope', itemKey: 'id' },
      ],
      scopedFields: [
        { nodeId: 'rootName', field: 'rootName' },
        { nodeId: 'groupName', field: 'name', scopeId: 'groupsScope' },
        { nodeId: 'itemValue', field: 'value', scopeId: 'itemsScope' },
        { nodeId: 'itemMirror', field: 'mirror', scopeId: 'itemsScope' },
      ],
    },
  }
}

function context(interactions?: readonly PrototypeInteraction[]): PrototypeProjectContextV1 {
  const home = nestedSurface(interactions)
  return {
    version: 1,
    projectId: 'project',
    homeSurfaceId: home.id,
    surfacesById: { [home.id]: home },
  }
}

function runtime(surface = nestedSurface()): PrototypeInstanceRuntimeSnapshotV1 {
  let nextId = 0
  const result = createPrototypeInstanceRuntimeSnapshot(
    surface,
    nestedValues(),
    () => `row-${++nextId}`,
  )
  expect(result.success).toBe(true)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message)
  return result.data
}

function fieldAddress(
  snapshot: PrototypeInstanceRuntimeSnapshotV1,
  nodeId: string,
  valuePath: readonly (string | number)[],
): PrototypeNodeAddressV1 {
  const expectedPath = JSON.stringify(valuePath)
  const field = snapshot.fieldInstances.find(candidate => (
    candidate.address.nodeId === nodeId && JSON.stringify(candidate.valuePath) === expectedPath
  ))
  if (!field)
    throw new Error(`Missing field address for ${nodeId} at ${expectedPath}.`)
  return field.address
}

function initialized(
  projectContext: PrototypeProjectContextV1,
  snapshot: PrototypeInstanceRuntimeSnapshotV1,
) {
  const result = initializePrototypeSession({
    projectId: projectContext.projectId,
    homeInstance: { instanceId: 'page-1', runtime: snapshot },
  }, projectContext)
  expect(result.diagnostics).toEqual([])
  return result.session
}

describe('prototype nested value scopes', () => {
  it('resolves current, parent, root, and root-parent without crossing row boundaries', () => {
    const surface = nestedSurface()
    const snapshot = runtime(surface)
    const values = nestedValues()
    const itemAddress = fieldAddress(snapshot, 'itemValue', ['groups', 0, 'items', 0, 'value'])
    const expression: SafeExpressionV1 = {
      version: 1,
      ast: {
        kind: 'array',
        items: [
          { kind: 'reference', scope: 'values', path: ['value'] },
          { kind: 'reference', scope: 'values', selector: 'parent', path: ['name'] },
          { kind: 'reference', scope: 'values', selector: 'root', path: ['rootName'] },
        ],
      },
    }

    expect(evaluatePrototypeExpression({
      surface,
      values,
      parameters: {},
      runtime: snapshot,
      address: itemAddress,
      expression,
    })).toEqual({ success: true, value: ['A', 'Group A', 'Root'] })

    const rootAddress = fieldAddress(snapshot, 'rootName', ['rootName'])
    expect(evaluatePrototypeExpression({
      surface,
      values,
      parameters: {},
      runtime: snapshot,
      address: rootAddress,
      expression: valueReference(['rootName'], 'parent'),
    })).toEqual({ success: true, value: 'Root' })
  })

  it('projects the same node independently for every nested row address', () => {
    const projectContext = context()
    const snapshot = runtime(projectContext.surfacesById.home)
    const session = initialized(projectContext, snapshot)
    const projections = session.instancesById['page-1']!.projection
      .filter(entry => entry.address.nodeId === 'itemAction')

    expect(projections).toHaveLength(3)
    expect(projections.map(entry => entry.states.visible)).toEqual([true, false, true])
    expect(new Set(projections.map(entry => JSON.stringify(entry.address.scope))).size).toBe(3)
  })

  it('rejects a stale row address without publishing command values', () => {
    const projectContext = context()
    const snapshot = runtime(projectContext.surfacesById.home)
    const session = initialized(projectContext, snapshot)
    const current = fieldAddress(snapshot, 'itemValue', ['groups', 0, 'items', 0, 'value'])
    const stale = {
      nodeId: current.nodeId,
      scope: current.scope.map((entry, index) => index === current.scope.length - 1
        ? { ...entry, rowId: 'removed-row' }
        : { ...entry }),
    }

    const result = reducePrototypeSession(session, {
      type: 'instance.valuesChanged',
      instanceId: 'page-1',
      values: nestedValues(),
      runtime: snapshot,
      originScope: stale.scope,
      changedAddresses: [stale],
    }, projectContext)

    expect(result.session).toBe(session)
    expect(result.effects).toEqual([])
    expect(result.diagnostics).toMatchObject([{ code: 'prototype_action_invalid' }])
  })
})

describe('prototype value transactions', () => {
  it('settles a value rule only inside the changed row', () => {
    const rule: PrototypeInteraction = {
      kind: 'valueChange',
      id: 'copy-item-value',
      dependencies: ['itemValue'],
      action: { kind: 'set', targetFieldId: 'itemMirror', value: valueReference(['value']) },
    }
    const projectContext = context([projectionRule, rule])
    const snapshot = runtime(projectContext.surfacesById.home)
    const session = initialized(projectContext, snapshot)
    const changedAddress = fieldAddress(snapshot, 'itemValue', ['groups', 0, 'items', 0, 'value'])
    const values = nestedValues()
    values.groups[0]!.items[0]!.value = 'Changed'

    const result = reducePrototypeSession(session, {
      type: 'instance.valuesChanged',
      instanceId: 'page-1',
      values,
      runtime: snapshot,
      originScope: changedAddress.scope,
      changedAddresses: [changedAddress],
    }, projectContext)

    expect(result.diagnostics).toEqual([])
    const nextValues = result.session.instancesById['page-1']!.values as ModelJsonObject & {
      groups: { items: { value: string, mirror: string }[] }[]
    }
    expect(nextValues.groups[0]!.items[0]).toMatchObject({ value: 'Changed', mirror: 'Changed' })
    expect(nextValues.groups[0]!.items[1]).toMatchObject({ value: 'B', mirror: '' })
    expect(nextValues.groups[1]!.items[0]).toMatchObject({ value: 'C', mirror: '' })
  })

  it('rolls back the complete transition on a reachable value-rule cycle', () => {
    const projectContext = context([
      {
        kind: 'valueChange',
        id: 'value-to-mirror',
        dependencies: ['itemValue'],
        action: { kind: 'copy', sourceFieldId: 'itemValue', targetFieldId: 'itemMirror' },
      },
      {
        kind: 'valueChange',
        id: 'mirror-to-value',
        dependencies: ['itemMirror'],
        action: { kind: 'copy', sourceFieldId: 'itemMirror', targetFieldId: 'itemValue' },
      },
    ])
    const snapshot = runtime(projectContext.surfacesById.home)
    const session = initialized(projectContext, snapshot)
    const changedAddress = fieldAddress(snapshot, 'itemValue', ['groups', 0, 'items', 0, 'value'])
    const values = nestedValues()
    values.groups[0]!.items[0]!.value = 'Uncommitted'

    const result = reducePrototypeSession(session, {
      type: 'instance.valuesChanged',
      instanceId: 'page-1',
      values,
      runtime: snapshot,
      originScope: changedAddress.scope,
      changedAddresses: [changedAddress],
    }, projectContext)

    expect(result.session).toBe(session)
    expect(result.effects).toEqual([])
    expect(result.diagnostics).toMatchObject([{ code: 'interaction_cycle' }])
  })

  it('rolls back command values when a value expression is invalid', () => {
    const projectContext = context([{
      kind: 'valueChange',
      id: 'invalid-value',
      dependencies: ['itemValue'],
      action: { kind: 'set', targetFieldId: 'itemMirror', value: valueReference(['missing']) },
    }])
    const snapshot = runtime(projectContext.surfacesById.home)
    const session = initialized(projectContext, snapshot)
    const changedAddress = fieldAddress(snapshot, 'itemValue', ['groups', 0, 'items', 0, 'value'])
    const values = nestedValues()
    values.groups[0]!.items[0]!.value = 'Uncommitted'

    const result = reducePrototypeSession(session, {
      type: 'instance.valuesChanged',
      instanceId: 'page-1',
      values,
      runtime: snapshot,
      originScope: changedAddress.scope,
      changedAddresses: [changedAddress],
    }, projectContext)

    expect(result.session).toBe(session)
    expect(result.effects).toEqual([])
    expect(result.diagnostics).toMatchObject([{ code: 'interaction_expression_invalid' }])
  })
})
