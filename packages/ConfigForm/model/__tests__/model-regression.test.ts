import type {
  ComponentContract,
  ProjectDocument,
  ProjectOperation,
  ProjectTransaction,
  SurfaceLayoutNode,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectDraftTransaction,
  applyProjectHistoryTransaction,
  applyProjectTransaction,
  createComponentContractRegistry,
  createMemoryProjectRepository,
  createProjectDraftSnapshot,
  createProjectDraftSnapshotFromTransaction,
  createProjectHistory,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  matchesResourceMediaType,
  parseProjectDocument,
  parseProjectDraftSnapshot,
  parseProjectSnapshot,
  parseRegistryContractSnapshot,
  readSurfaceTransfer,
  redoProjectHistory,
  undoProjectHistory,
  writeSurfaceTransfer,
} from '../index'
import {
  dialogSurface,
  documentFixture,
  embeddedResourceFixture,
  fieldNode,
  pageSurface,
  sha256,
} from './test-fixtures'

function transaction(id: string, operations: ProjectOperation[]): ProjectTransaction {
  return { id, label: id, operations }
}

function expectInverseRoundTrip(document: ProjectDocument, operations: ProjectOperation[]): void {
  const applied = applyProjectTransaction(document, transaction('apply', operations))
  expect(applied.success).toBe(true)
  if (!applied.success)
    return
  expect(applied.changed).toBe(true)
  const reverted = applyProjectTransaction(applied.document, applied.inverse)
  expect(reverted.success).toBe(true)
  expect(reverted.success && reverted.document).toEqual(document)
}

describe('surface graph and snapshot regression coverage', () => {
  it('matches exact and wildcard Resource media capabilities', () => {
    expect(matchesResourceMediaType('image/png', ['image/*'])).toBe(true)
    expect(matchesResourceMediaType('IMAGE/SVG+XML; charset=utf-8', ['image/*'])).toBe(true)
    expect(matchesResourceMediaType('application/pdf', ['image/*'])).toBe(false)
    expect(matchesResourceMediaType(undefined, ['image/*'])).toBe(false)
    expect(matchesResourceMediaType(undefined, undefined)).toBe(true)
  })

  it('rejects duplicate placement and cyclic Surface graphs without throwing', () => {
    const duplicate = documentFixture({
      surfacesById: {
        home: pageSurface(
          'home',
          '/',
          { name: fieldNode() },
          [
            { nodeId: 'name', placement: {} },
            { nodeId: 'name', placement: {} },
          ],
        ),
      },
    })
    expect(parseProjectDocument(duplicate)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_graph_invalid' }],
    })

    const first: SurfaceLayoutNode = {
      id: 'first',
      component: 'test.layout',
      kind: 'layout',
      props: {},
      slots: { default: [{ nodeId: 'second', placement: {} }] },
    }
    const second: SurfaceLayoutNode = {
      id: 'second',
      component: 'test.layout',
      kind: 'layout',
      props: {},
      slots: { default: [{ nodeId: 'first', placement: {} }] },
    }
    const cyclic = documentFixture({
      surfacesById: {
        home: pageSurface(
          'home',
          '/',
          { first, second },
          [{ nodeId: 'first', placement: {} }],
        ),
      },
    })
    expect(() => parseProjectDocument(cyclic)).not.toThrow()
    const cyclicResult = parseProjectDocument(cyclic)
    expect(cyclicResult.success).toBe(false)
    expect(cyclicResult.diagnostics.every(diagnostic => diagnostic.code === 'surface_graph_invalid')).toBe(true)
  })

  it('returns diagnostics for circular and excessively deep ProjectDocument input', () => {
    const circular = documentFixture()
    ;(circular.settings as Record<string, unknown>).self = circular.settings
    expect(() => parseProjectDocument(circular)).not.toThrow()
    expect(parseProjectDocument(circular)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'project_structure_invalid' }],
    })

    const deepValue: Record<string, unknown> = {}
    let cursor = deepValue
    for (let depth = 0; depth < 10_000; depth += 1) {
      const child: Record<string, unknown> = {}
      cursor.child = child
      cursor = child
    }
    const deep = documentFixture({ settings: deepValue as ProjectDocument['settings'] })
    expect(() => parseProjectDocument(deep)).not.toThrow()
    expect(parseProjectDocument(deep)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'project_structure_invalid' }],
    })
  })

  it('clones immutable snapshots and rejects stale snapshot and draft hashes', () => {
    const source = documentFixture()
    const snapshot = createProjectSnapshot(source, 7)
    source.name = 'Mutated source'
    expect(snapshot.document.name).toBe('Project')
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.document.surfacesById.home)).toBe(true)

    const staleSnapshot = structuredClone(snapshot) as unknown as { document: ProjectDocument }
    staleSnapshot.document.name = 'Tampered'
    expect(parseProjectSnapshot(staleSnapshot)).toMatchObject({ success: false })

    const draft = createProjectDraftSnapshot(snapshot, {
      ...structuredClone(snapshot.document),
      name: 'Draft name',
    }, 'draft-1')
    const staleDraft = structuredClone(draft) as unknown as { document: ProjectDocument }
    staleDraft.document.name = 'Tampered draft'
    expect(parseProjectDraftSnapshot(staleDraft)).toMatchObject({ success: false })
  })

  it('rejects a forged snapshot wrapper when publishing a transaction draft', () => {
    const snapshot = createProjectSnapshot(documentFixture(), 7)
    const result = applyProjectTransaction(
      snapshot.document as ProjectDocument,
      transaction('rename-for-draft', [{ type: 'surface.rename', surfaceId: 'home', name: 'Draft home' }]),
    )
    expect(result.success).toBe(true)
    if (!result.success || !result.changed)
      return

    const forgedBase = Object.freeze({
      document: snapshot.document,
      editVersion: 999,
      contentHash: 'fnv1a:00000000',
    })
    expect(() => createProjectDraftSnapshotFromTransaction(forgedBase, result, 'forged-draft'))
      .toThrowError('Project draft snapshots require a transaction from the validated base document.')

    const equivalentBase = Object.freeze({
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    })
    const draft = createProjectDraftSnapshotFromTransaction(equivalentBase, result, 'valid-draft')
    expect(draft.base).toEqual({
      projectId: snapshot.document.id,
      editVersion: 7,
      contentHash: snapshot.contentHash,
    })
  })

  it('returns diagnostics for circular or excessively deep snapshot input', () => {
    const snapshot = createProjectSnapshot(documentFixture())
    const circularValue: Record<string, unknown> = {}
    circularValue.self = circularValue
    const circularDocument = {
      ...structuredClone(snapshot.document),
      settings: circularValue,
    }

    expect(() => parseProjectSnapshot({
      ...structuredClone(snapshot),
      document: circularDocument,
    })).not.toThrow()
    expect(parseProjectSnapshot({
      ...structuredClone(snapshot),
      document: circularDocument,
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_SNAPSHOT_INVALID' }],
    })

    const draft = createProjectDraftSnapshot(snapshot, snapshot.document, 'draft-deep')
    const deepValue: Record<string, unknown> = {}
    let cursor = deepValue
    for (let depth = 0; depth < 10_000; depth += 1) {
      const child: Record<string, unknown> = {}
      cursor.child = child
      cursor = child
    }
    expect(() => parseProjectDraftSnapshot({
      ...structuredClone(draft),
      document: {
        ...structuredClone(draft.document),
        settings: deepValue,
      },
    })).not.toThrow()
    expect(parseProjectDraftSnapshot({
      ...structuredClone(draft),
      document: {
        ...structuredClone(draft.document),
        settings: deepValue,
      },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_DRAFT_SNAPSHOT_INVALID' }],
    })
  })

  it('returns diagnostics for circular Registry snapshot input', () => {
    const registry = createComponentContractRegistry([{
      key: 'test.input',
      version: '1',
      kind: 'field',
      props: [],
      bindings: [],
      slots: [],
      allowedParents: [],
      defaults: {},
      semanticTriggers: [],
      stateProjectionProperties: [],
      datasetBindings: [],
      resourceBindings: [],
    }], { adapter: 'test-adapter', version: '1.0.0' })
    const snapshot = createRegistryContractSnapshot(registry)
    const circularDefaults: Record<string, unknown> = {}
    circularDefaults.self = circularDefaults
    const component = structuredClone(snapshot.components[0]!)
    const circularSnapshot = {
      ...structuredClone(snapshot),
      components: [{
        ...component,
        contract: {
          ...component.contract,
          defaults: circularDefaults,
        },
      }],
    }

    expect(() => parseRegistryContractSnapshot(circularSnapshot)).not.toThrow()
    expect(parseRegistryContractSnapshot(circularSnapshot)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_REGISTRY_SNAPSHOT_INVALID' }],
    })
  })
})

describe('transaction and history regression coverage', () => {
  it('keeps trusted incremental validation strict and never trusts plain documents', () => {
    const contract: ComponentContract = {
      key: 'test.input',
      version: '1',
      kind: 'field',
      props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
      bindings: [],
      slots: [],
      allowedParents: [],
      defaults: {},
      semanticTriggers: [],
      stateProjectionProperties: [],
      datasetBindings: [],
      resourceBindings: [],
    }
    const registry = createComponentContractRegistry([contract], {
      adapter: 'test-adapter',
      version: '1.0.0',
    })
    const trusted = createProjectSnapshot(documentFixture({ registryLock: registry.lock })).document as ProjectDocument
    const insert = (id: string, field: string, extras: Partial<ReturnType<typeof fieldNode>> = {}) => (
      applyProjectDraftTransaction(trusted, transaction(`insert-${id}`, [{
        type: 'node.insert',
        surfaceId: 'home',
        target: { parentId: null },
        subgraph: {
          root: [{ nodeId: id, placement: {} }],
          nodesById: { [id]: fieldNode(id, field, extras) },
        },
      }]), { registry })
    )

    expect(insert('duplicate', 'name')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_graph_invalid' }],
    })
    expect(insert('dangling', 'dangling', {
      datasetBindings: {
        options: {
          datasetId: 'missing',
          projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
        },
      },
    })).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'dataset_reference_invalid' })]),
    })
    expect(insert('unknown-prop', 'unknownProp', { props: { unknown: true } })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_COMPONENT_PROP_UNKNOWN' }],
    })
    expect(applyProjectDraftTransaction(trusted, transaction('insert-unreachable', [{
      type: 'node.insert',
      surfaceId: 'home',
      target: { parentId: null },
      subgraph: {
        root: [{ nodeId: 'visible', placement: {} }],
        nodesById: {
          visible: fieldNode('visible', 'visible'),
          unreachable: fieldNode('unreachable', 'unreachable'),
        },
      },
    }]), { registry })).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({
        code: 'surface_graph_invalid',
        nodeId: 'unreachable',
      })]),
    })

    const untrusted = documentFixture()
    untrusted.surfacesById.home!.graph.root.push({ nodeId: 'name', placement: {} })
    const untrustedResult = applyProjectDraftTransaction(untrusted, transaction('untrusted', [{
      type: 'node.placement',
      surfaceId: 'home',
      nodeId: 'name',
      placement: { span: 2 },
    }]))
    expect(untrustedResult).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_graph_invalid' }],
    })
    expect(untrustedResult.document).toBe(untrusted)

    const externallyFrozen = structuredClone(untrusted)
    const freeze = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Object.isFrozen(value))
        return
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    freeze(externallyFrozen)
    const externallyFrozenResult = applyProjectDraftTransaction(
      externallyFrozen,
      transaction('externally-frozen', [{
        type: 'node.placement',
        surfaceId: 'home',
        nodeId: 'name',
        placement: { span: 3 },
      }]),
    )
    expect(externallyFrozenResult).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_graph_invalid' }],
    })
    expect(externallyFrozenResult.document).toBe(externallyFrozen)

    const invalidGlobalReference = applyProjectDraftTransaction(trusted, transaction('mixed-global', [
      {
        type: 'node.props',
        surfaceId: 'home',
        nodeId: 'name',
        props: { placeholder: 'Valid local change' },
      },
      {
        type: 'surface.interactions',
        surfaceId: 'home',
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-missing',
          nodeId: 'name',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'missing-dialog', parameters: [] },
        }],
      },
    ]), { registry })
    expect(invalidGlobalReference).toMatchObject({
      success: false,
      diagnostics: [{ code: 'invalid_surface_reference' }],
    })
    expect(invalidGlobalReference.document).toBe(trusted)
  })

  it('deep-freezes trusted incremental publications and their inverse payloads', () => {
    const contract: ComponentContract = {
      key: 'test.input',
      version: '1',
      kind: 'field',
      props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
      bindings: [],
      slots: [],
      allowedParents: [],
      defaults: {},
      semanticTriggers: [],
      stateProjectionProperties: [],
      datasetBindings: [],
      resourceBindings: [],
    }
    const registry = createComponentContractRegistry([contract], {
      adapter: 'test-adapter',
      version: '1.0.0',
    })
    const trusted = createProjectSnapshot(documentFixture({ registryLock: registry.lock })).document as ProjectDocument
    const result = applyProjectDraftTransaction(trusted, transaction('nested-props', [{
      type: 'node.props',
      surfaceId: 'home',
      nodeId: 'name',
      props: { placeholder: { nested: { value: 'next' } } },
    }]), { registry })
    expect(result.success).toBe(true)
    if (!result.success || !result.changed)
      return

    const nested = result.document.surfacesById.home!.graph.nodesById.name!.props.placeholder as Record<string, unknown>
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.document)).toBe(true)
    expect(Object.isFrozen(nested)).toBe(true)
    expect(Object.isFrozen(nested.nested)).toBe(true)
    expect(Object.isFrozen(result.inverse)).toBe(true)
    expect(Object.isFrozen(result.inverse.operations[0])).toBe(true)
  })

  it('rolls back every earlier operation when a later operation fails', () => {
    const source = documentFixture()
    const result = applyProjectTransaction(source, transaction('atomic-failure', [
      { type: 'surface.rename', surfaceId: 'home', name: 'Landing' },
      { type: 'node.props', surfaceId: 'home', nodeId: 'missing', props: { invalid: true } },
    ]))
    expect(result).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_NODE_UNKNOWN' }],
    })
    expect(result.document).toBe(source)
    expect(source.surfacesById.home!.name).toBe('Home')
  })

  it('returns the original identity for a transaction with no semantic change', () => {
    const source = documentFixture()
    const result = applyProjectTransaction(source, transaction('net-no-op', [
      { type: 'surface.rename', surfaceId: 'home', name: 'Landing' },
      { type: 'surface.rename', surfaceId: 'home', name: 'Home' },
    ]))
    expect(result).toMatchObject({
      success: true,
      changed: false,
      changeSet: {
        project: false,
        surfaceIds: [],
        datasetIds: [],
        resourceIds: [],
        nodeChanges: [],
      },
    })
    expect(result.document).toBe(source)
  })

  it('cancels an inserted-then-removed node from a changed transaction change set', () => {
    const source = documentFixture()
    const result = applyProjectTransaction(source, transaction('cancel-insert', [
      {
        type: 'node.insert',
        surfaceId: 'home',
        target: { parentId: null },
        subgraph: {
          root: [{ nodeId: 'temporary', placement: {} }],
          nodesById: { temporary: fieldNode('temporary') },
        },
      },
      { type: 'node.remove', surfaceId: 'home', nodeId: 'temporary' },
      { type: 'surface.rename', surfaceId: 'home', name: 'Landing' },
    ]))

    expect(result).toMatchObject({
      success: true,
      changed: true,
      document: { surfacesById: { home: { name: 'Landing' } } },
      changeSet: { surfaceIds: ['home'], nodeChanges: [] },
    })
    expect(result.document.surfacesById.home!.graph.nodesById).not.toHaveProperty('temporary')
  })

  it('round-trips Dataset and Resource operation families through their inverse', () => {
    const source = documentFixture({
      datasetOrder: ['first', 'second'],
      datasetsById: {
        first: { id: 'first', name: 'First', rows: [{ id: 1 }] },
        second: { id: 'second', name: 'Second', rows: [{ id: 2 }] },
      },
      resources: {
        first: { id: 'first', kind: 'url', name: 'First', url: '/first.png' },
        second: { id: 'second', kind: 'url', name: 'Second', url: '/second.png' },
      },
    })
    expectInverseRoundTrip(source, [
      { type: 'dataset.move', datasetId: 'second', index: 0 },
      { type: 'dataset.rename', datasetId: 'first', name: 'Renamed' },
      { type: 'dataset.replaceRows', datasetId: 'first', rows: [{ id: 3, nested: { ok: true } }] },
      {
        type: 'dataset.setDefaultProjection',
        datasetId: 'first',
        projection: { kind: 'options', labelPath: ['id'], valuePath: ['id'] },
      },
      { type: 'dataset.copy', dataset: { id: 'copy', name: 'Copy', rows: [] }, index: 1 },
      { type: 'resource.rename', resourceId: 'first', name: 'Renamed resource' },
      {
        type: 'resource.replace',
        resourceId: 'second',
        resource: { id: 'second', kind: 'url', name: 'Replacement', url: '/replacement.png' },
      },
      { type: 'resource.add', resource: { id: 'third', kind: 'url', name: 'Third', url: '/third.png' } },
    ])
    expectInverseRoundTrip(source, [{
      type: 'dataset.replace',
      datasetId: 'first',
      dataset: {
        id: 'first',
        name: 'Imported people',
        description: 'Complete replacement without breaking references',
        rows: [{ id: 9, label: 'Nine' }],
        defaultProjection: { kind: 'options', labelPath: ['label'], valuePath: ['id'] },
      },
    }])
    expectInverseRoundTrip(source, [
      { type: 'dataset.remove', datasetId: 'second' },
      { type: 'resource.remove', resourceId: 'second' },
    ])
  })

  it('blocks deletion of Surface, field, Dataset, and Resource interaction dependencies', () => {
    const dialog = dialogSurface()
    const home = pageSurface('home', '/', {
      name: fieldNode('name', 'name', {
        datasetBindings: {
          options: {
            datasetId: 'options',
            projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
          },
        },
        resourceBindings: { icon: { resourceId: 'icon' } },
      }),
    })
    home.interactions = [
      {
        kind: 'stateProjection',
        id: 'show-name',
        target: { kind: 'state', nodeId: 'name', key: 'visible' },
        value: { version: 1, ast: { kind: 'literal', value: true } },
      },
      {
        kind: 'primaryUiAction',
        id: 'open-dialog',
        nodeId: 'name',
        trigger: 'activate',
        action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
      },
    ]
    const source = documentFixture({
      surfaceOrder: ['home', 'dialog'],
      surfacesById: { home, dialog },
      datasetOrder: ['options'],
      datasetsById: { options: { id: 'options', name: 'Options', rows: [] } },
      resources: { icon: { id: 'icon', kind: 'url', name: 'Icon', url: '/icon.png' } },
    })
    const cases: Array<[ProjectOperation, string]> = [
      [{ type: 'surface.remove', surfaceId: 'dialog' }, 'surface_in_use'],
      [{ type: 'node.remove', surfaceId: 'home', nodeId: 'name' }, 'invalid_surface_reference'],
      [{ type: 'dataset.remove', datasetId: 'options' }, 'dataset_reference_invalid'],
      [{ type: 'resource.remove', resourceId: 'icon' }, 'resource_reference_invalid'],
    ]
    cases.forEach(([operation, code], index) => {
      const result = applyProjectTransaction(source, transaction(`blocked-${index}`, [operation]))
      expect(result.success).toBe(false)
      expect(result.diagnostics.map(diagnostic => diagnostic.code)).toContain(code)
      expect(result.document).toBe(source)
    })
  })

  it('replaces a Dataset atomically without allowing its stable id to change', () => {
    const source = documentFixture({
      datasetOrder: ['people'],
      datasetsById: { people: { id: 'people', name: 'People', rows: [{ id: 1 }] } },
    })
    const result = applyProjectTransaction(source, transaction('replace-dataset', [{
      type: 'dataset.replace',
      datasetId: 'people',
      dataset: { id: 'contacts', name: 'Contacts', rows: [] },
    }]))

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_DATASET_ID_CHANGE_INVALID' }],
    })
    expect(result.document).toBe(source)
  })

  it('merges, undoes, redoes, and branches history deterministically', () => {
    let now = 1000
    let history = createProjectHistory(documentFixture(), { mergeWindowMs: 100 })
    const first = applyProjectHistoryTransaction(history, {
      ...transaction('first', [{ type: 'surface.rename', surfaceId: 'home', name: 'First' }]),
      mergeKey: 'surface-name',
    }, { nowMs: () => now })
    history = first.history
    now += 50
    const second = applyProjectHistoryTransaction(history, {
      ...transaction('second', [{ type: 'surface.rename', surfaceId: 'home', name: 'Second' }]),
      mergeKey: 'surface-name',
    }, { nowMs: () => now })
    history = second.history
    expect(history.past).toHaveLength(1)
    expect(history.snapshot.document.surfacesById.home!.name).toBe('Second')

    const undone = undoProjectHistory(history, { nowMs: () => now + 1 })
    expect(undone.history.snapshot.document.surfacesById.home!.name).toBe('Home')
    expect(undone.history.future).toHaveLength(1)
    const redone = redoProjectHistory(undone.history, { nowMs: () => now + 2 })
    expect(redone.history.snapshot.document.surfacesById.home!.name).toBe('Second')

    const branchBase = undoProjectHistory(redone.history, { nowMs: () => now + 3 }).history
    const branch = applyProjectHistoryTransaction(
      branchBase,
      transaction('branch', [{ type: 'surface.rename', surfaceId: 'home', name: 'Branch' }]),
      { nowMs: () => now + 4 },
    )
    expect(branch.history.future).toEqual([])
    expect(branch.history.snapshot.document.surfacesById.home!.name).toBe('Branch')
  })

  it('preserves history identity and edit version after a failed transaction', () => {
    const history = createProjectHistory(documentFixture(), { editVersion: 9 })
    const result = applyProjectHistoryTransaction(
      history,
      transaction('failed', [{ type: 'surface.route', surfaceId: 'missing', route: '/missing' }]),
    )
    expect(result.changed).toBe(false)
    expect(result.history).toBe(history)
    expect(result.history.snapshot.editVersion).toBe(9)
  })
})

describe('repository regression coverage', () => {
  it('rejects stale CAS without replacing state and isolates returned documents', async () => {
    const repository = createMemoryProjectRepository()
    const created = await repository.create({ document: documentFixture(), embeddedContents: [] })
    await repository.commit({
      commandId: 'first',
      document: documentFixture({ name: 'Committed' }),
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })
    await expect(repository.commit({
      commandId: 'stale',
      document: documentFixture({ name: 'Stale' }),
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    const firstRead = await repository.get('project')
    expect(firstRead?.document.name).toBe('Committed')
    firstRead!.document.name = 'Mutated result'
    expect((await repository.get('project'))?.document.name).toBe('Committed')
  })

  it('retains labeled exact-hash bytes and removes them after the version becomes unreachable', async () => {
    const firstBytes = new Uint8Array([1, 2, 3])
    const secondBytes = new Uint8Array([4, 5, 6])
    const first = await embeddedResourceFixture(firstBytes)
    const secondHash = await sha256(secondBytes)
    const repository = createMemoryProjectRepository({
      receiptLimit: 1,
      now: (() => {
        let day = 18
        return () => `2026-09-${day++}T00:00:00.000Z`
      })(),
    })
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    const nextDocument = structuredClone(first.document)
    const asset = nextDocument.resources.asset
    if (!asset || asset.kind !== 'embedded')
      throw new TypeError('Expected embedded Resource fixture.')
    asset.contentHash = secondHash
    asset.byteLength = secondBytes.byteLength
    const committed = await repository.commit({
      commandId: 'replace-bytes',
      document: nextDocument,
      embeddedWrites: [{ resourceId: 'asset', contentHash: secondHash, bytes: secondBytes }],
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })

    await repository.setVersionLabel({
      projectId: 'project',
      revision: 0,
      label: 'baseline',
      expectedRepositoryRevision: committed.project.repositoryRevision,
    })
    await repository.pruneVersions('project', {
      keepLatestAutosaves: 0,
      keepDailyForDays: 0,
      now: '2026-10-30T00:00:00.000Z',
    })
    expect(await repository.getVersion('project', 0)).toBeDefined()
    expect(await repository.readEmbedded({
      projectId: 'project',
      resourceId: 'asset',
      contentHash: first.write.contentHash,
    })).toEqual(firstBytes)

    await repository.setVersionLabel({
      projectId: 'project',
      revision: 0,
      expectedRepositoryRevision: committed.project.repositoryRevision,
    })
    await repository.pruneVersions('project', {
      keepLatestAutosaves: 0,
      keepDailyForDays: 0,
      now: '2026-10-30T00:00:00.000Z',
    })
    expect(await repository.getVersion('project', 0)).toBeUndefined()
    expect(await repository.readEmbedded({
      projectId: 'project',
      resourceId: 'asset',
      contentHash: first.write.contentHash,
    })).toBeUndefined()
    expect(await repository.readEmbedded({
      projectId: 'project',
      resourceId: 'asset',
      contentHash: secondHash,
    })).toEqual(secondBytes)
  })

  it('fails closed when exact-hash stored bytes are corrupt', async () => {
    const fixture = await embeddedResourceFixture()
    const repository = createMemoryProjectRepository()
    await repository.create({ document: fixture.document, embeddedContents: [fixture.write] })
    const internals = repository as unknown as {
      projects: Map<string, { embedded: Map<string, { bytes: Uint8Array }> }>
    }
    const record = [...internals.projects.get('project')!.embedded.values()][0]!
    record.bytes[0] = 255
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'asset',
      contentHash: fixture.write.contentHash,
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })
})

describe('surface transfer closure regression coverage', () => {
  it('returns diagnostics for circular Surface transfer input', async () => {
    const written = await writeSurfaceTransfer({
      document: documentFixture(),
      rootSurfaceId: 'home',
      readEmbedded: async () => undefined,
    })
    expect(written.success).toBe(true)
    if (!written.success)
      return

    const home = structuredClone(written.data.surfacesById.home!)
    const circularProps: Record<string, unknown> = {}
    circularProps.self = circularProps
    const circularTransfer = {
      ...structuredClone(written.data),
      surfacesById: {
        home: {
          ...home,
          graph: {
            ...home.graph,
            props: circularProps,
          },
        },
      },
    }

    await expect(readSurfaceTransfer(circularTransfer)).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_graph_invalid' }],
    })
  })

  it('rejects missing and extra closure assets or embedded contents', async () => {
    const fixture = await embeddedResourceFixture()
    const home = pageSurface('home', '/', {
      name: fieldNode('name', 'name', {
        datasetBindings: {
          options: {
            datasetId: 'options',
            projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
          },
        },
        resourceBindings: { asset: { resourceId: 'asset' } },
      }),
    })
    home.interactions = [{
      kind: 'primaryUiAction',
      id: 'open-dialog',
      nodeId: 'name',
      trigger: 'activate',
      action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
    }]
    const source: ProjectDocument = {
      ...fixture.document,
      surfaceOrder: ['home', 'dialog'],
      surfacesById: { home, dialog: dialogSurface() },
      datasetOrder: ['options'],
      datasetsById: { options: { id: 'options', name: 'Options', rows: [{ label: 'A', value: 'a' }] } },
    }
    const written = await writeSurfaceTransfer({
      document: source,
      rootSurfaceId: 'home',
      readEmbedded: async () => new Uint8Array(fixture.write.bytes),
    })
    expect(written.success).toBe(true)
    if (!written.success)
      return
    expect(written.data).toMatchObject({
      surfaceOrder: ['home', 'dialog'],
      datasetOrder: ['options'],
      resources: { asset: { id: 'asset' } },
    })

    const missingSurface = structuredClone(written.data)
    missingSurface.surfaceOrder = ['home']
    delete missingSurface.surfacesById.dialog
    expect(await readSurfaceTransfer(missingSurface)).toMatchObject({ success: false })

    const extraSurface = structuredClone(written.data)
    extraSurface.surfaceOrder.push('extra')
    extraSurface.surfacesById.extra = pageSurface('extra', '/extra')
    expect(await readSurfaceTransfer(extraSurface)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_reference_invalid' }],
    })

    const missingDataset = structuredClone(written.data)
    missingDataset.datasetOrder = []
    delete missingDataset.datasetsById.options
    expect(await readSurfaceTransfer(missingDataset)).toMatchObject({ success: false })

    const extraResource = structuredClone(written.data)
    extraResource.resources.extra = { id: 'extra', kind: 'url', name: 'Extra', url: '/extra.png' }
    expect(await readSurfaceTransfer(extraResource)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'surface_reference_invalid' }],
    })

    const missingBytes = structuredClone(written.data)
    missingBytes.embeddedContents = []
    expect(await readSurfaceTransfer(missingBytes)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'resource_content_invalid' }],
    })

    const extraBytes = structuredClone(written.data)
    extraBytes.embeddedContents.push(structuredClone(extraBytes.embeddedContents[0]!))
    expect(await readSurfaceTransfer(extraBytes)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'resource_content_invalid' }],
    })
  })
})
