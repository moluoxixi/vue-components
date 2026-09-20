import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { createProjectEditorSession } from '../../project'
import { createProjectDocumentFixture } from '../../project/__tests__/fixtures'
import { createWorkbenchAssetCommands } from '../services/controller-assets'

async function createCommands(document: ProjectDocument = createProjectDocumentFixture()) {
  const repository = createMemoryProjectRepository()
  const persisted = await repository.create({ document, embeddedContents: [] })
  const session = createProjectEditorSession({ project: persisted, repository })
  const snapshot = shallowRef(session.snapshot)
  session.subscribe(next => snapshot.value = next)
  const commands = createWorkbenchAssetCommands({
    busy: ref(false),
    currentProject: computed(() => snapshot.value.document),
    executeProjectActions: (label, actions, mergeKey, embeddedWrites) => session.execute({
      id: `asset-${snapshot.value.editVersion}`,
      label,
      actions,
      ...(mergeKey ? { mergeKey } : {}),
    }, { embeddedWrites }).changed,
    readEmbedded: input => session.readEmbedded(input),
  })
  return { commands, repository, session, snapshot }
}

describe('workbench asset commands', () => {
  it('keeps nested Dataset rows authoritative, imports v1 with copy by default, and supports undo/redo', () => {
    return createCommands().then(({ commands, session, snapshot }) => {
      const id = commands.createDataset('People', [{ id: 1, meta: { name: 'Ada', tags: ['a'] } }])
      expect(id).toBeTruthy()
      expect(snapshot.value.document.datasetsById[id!]?.rows).toEqual([{ id: 1, meta: { name: 'Ada', tags: ['a'] } }])
      expect(commands.replaceDatasetRows(id!, [{ id: 2, meta: { name: 'Grace', tags: ['b'] } }])).toBe(true)
      expect(snapshot.value.document.datasetsById[id!]?.rows[0]?.meta).toEqual({ name: 'Grace', tags: ['b'] })

      const transfer = commands.exportDataset(id!)
      expect(transfer).toMatchObject({ success: true, data: { kind: 'config-form-dataset', version: 1 } })
      if (!transfer?.success)
        return
      const copiedId = commands.importDataset(transfer.data)
      expect(copiedId).toBeTruthy()
      expect(copiedId).not.toBe(id)
      expect(snapshot.value.document.datasetOrder).toHaveLength(2)

      expect(session.undo().changed).toBe(true)
      expect(snapshot.value.document.datasetOrder).toHaveLength(1)
      expect(session.redo().changed).toBe(true)
      expect(snapshot.value.document.datasetOrder).toHaveLength(2)
    })
  })

  it('stages embedded bytes atomically', async () => {
    const { commands, repository, session, snapshot } = await createCommands()
    const resourceId = await commands.createEmbeddedResource({
      name: 'Logo',
      fileName: 'logo.png',
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })
    expect(resourceId).toBeTruthy()
    if (!resourceId)
      return
    const saved = await session.save({ source: 'manual', sealHistoryGroup: true })
    expect(saved.success).toBe(true)
    const resource = snapshot.value.document.resources[resourceId]
    expect(resource?.kind).toBe('embedded')
    if (!resource || resource.kind !== 'embedded')
      return
    expect(await repository.readEmbedded({ projectId: snapshot.value.document.id, resourceId, contentHash: resource.contentHash }))
      .toEqual(new Uint8Array([1, 2, 3]))
    const exported = await commands.exportResource(resourceId)
    expect(exported).toMatchObject({ success: true, data: { kind: 'config-form-resource', version: 1 } })
  })

  it('materializes the complete options projection and prevents deleting referenced assets', async () => {
    const document = createProjectDocumentFixture()
    const home = document.homeSurfaceId
    const nodeId = Object.keys(document.surfacesById[home]!.graph.nodesById)[0]!
    document.datasetOrder = ['referenced-options']
    document.datasetsById = {
      'referenced-options': { id: 'referenced-options', name: 'Referenced', rows: [{ label: 'One', value: 'one', disabled: true }] },
    }
    document.surfacesById[home]!.graph.nodesById[nodeId]!.datasetBindings = {
      options: { datasetId: 'referenced-options', projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'], disabledPath: ['disabled'] } },
    }
    // The Model reference walker rejects deletion before the command can mutate the document.
    const { commands, snapshot } = await createCommands(document)
    expect(commands.deleteDataset('referenced-options')).toBe(false)
    expect(commands.materializeOptionsSnapshot(home, nodeId, 'options')).toBe(true)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.props.options)
      .toEqual([{ label: 'One', value: 'one', disabled: true }])
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.datasetBindings?.options).toBeUndefined()

    const rebound = commands.saveOptionsAsDataset(home, nodeId, 'options', 'Saved options')
    expect(rebound).toBeTruthy()
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.props.options).toBeUndefined()
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.datasetBindings?.options?.datasetId).toBe(rebound)
    expect(commands.deleteDataset(rebound!)).toBe(false)
  })

  it('binds validated Dataset queries and materializes the queried options snapshot', async () => {
    const document = createProjectDocumentFixture()
    const home = document.homeSurfaceId
    const nodeId = Object.keys(document.surfacesById[home]!.graph.nodesById)[0]!
    document.datasetOrder = ['roles']
    document.datasetsById = {
      roles: {
        id: 'roles',
        name: 'Roles',
        rows: [
          { label: 'Designer', value: 'designer', rank: 2 },
          { label: 'Developer', value: 'developer', rank: 1 },
        ],
      },
    }
    const { commands, snapshot } = await createCommands(document)
    const reference = {
      datasetId: 'roles',
      projection: { kind: 'options' as const, labelPath: ['label'], valuePath: ['value'] },
      query: {
        sort: [{ path: ['rank'], direction: 'asc' as const }],
        page: { index: 0, size: 1 },
      },
    }

    expect(commands.setDatasetBinding(home, nodeId, 'options', reference)).toBe(true)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.datasetBindings?.options)
      .toEqual(reference)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.props.options).toBeUndefined()
    expect(commands.materializeOptionsSnapshot(home, nodeId, 'options')).toBe(true)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.props.options)
      .toEqual([{ label: 'Developer', value: 'developer' }])
  })

  it('sets and removes Resource bindings without mutating other binding keys', async () => {
    const document = createProjectDocumentFixture()
    const home = document.homeSurfaceId
    const nodeId = Object.keys(document.surfacesById[home]!.graph.nodesById)[0]!
    document.resources = {
      logo: { id: 'logo', name: 'Logo', kind: 'url', url: '/logo.png', mediaType: 'image/png' },
    }
    document.surfacesById[home]!.graph.nodesById[nodeId]!.resourceBindings = {
      fallback: { resourceId: 'logo' },
    }
    const { commands, snapshot } = await createCommands(document)

    expect(commands.setResourceBinding(home, nodeId, 'src', 'logo')).toBe(true)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.resourceBindings)
      .toEqual({ fallback: { resourceId: 'logo' }, src: { resourceId: 'logo' } })
    expect(commands.setResourceBinding(home, nodeId, 'src')).toBe(true)
    expect(snapshot.value.document.surfacesById[home]!.graph.nodesById[nodeId]!.resourceBindings)
      .toEqual({ fallback: { resourceId: 'logo' } })
  })
})
