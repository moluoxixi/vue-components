import type {
  DatasetProjection,
  DatasetReference,
  DatasetViewQuery,
  DeepReadonly,
  ModelJsonObject,
  ModelJsonValue,
  ProjectCommandAction,
  ProjectDataset,
  ProjectEmbeddedResource,
  ProjectEmbeddedResourceRead,
  ProjectEmbeddedResourceWrite,
  ProjectOperation,
  ProjectResource,
  ProjectUrlResource,
  ReadonlyProjectDocument,
  StaticResourceReference,
} from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type {
  AssetImportConflictStrategy,
  EmbeddedResourceInput,
  UrlResourceInput,
} from '../types'
import {
  createDatasetFromRows,
  projectDatasetRows,
  queryDatasetView,
  readDatasetTransfer,
  readResourceTransfer,
  writeDatasetTransfer,
  writeResourceTransfer,
} from '@moluoxixi/config-form-model'

type ExecuteActions = (
  label: string,
  actions: ProjectCommandAction[],
  mergeKey?: string,
  embeddedWrites?: readonly ProjectEmbeddedResourceWrite[],
) => boolean

function nextAssetId(kind: 'dataset' | 'resource', source: string): string {
  const token = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const prefix = source.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || kind
  return `${prefix.slice(0, 80)}-${token}`
}

async function contentHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    throw new Error('SHA-256 is unavailable in this runtime.')
  const digest = new Uint8Array(await subtle.digest('SHA-256', new Uint8Array(bytes).buffer))
  return `sha256:${[...digest].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

function copiedName(name: string): string {
  return `${name.trim() || 'Asset'} copy`
}

function optionsProjection(): DatasetProjection {
  return { kind: 'options', labelPath: ['label'], valuePath: ['value'] }
}

export function createWorkbenchAssetCommands(options: {
  busy: Ref<boolean>
  currentProject: ComputedRef<ReadonlyProjectDocument | undefined>
  executeProjectActions: ExecuteActions
  readEmbedded: (input: ProjectEmbeddedResourceRead) => Promise<Uint8Array | undefined>
}) {
  const { busy, currentProject, executeProjectActions, readEmbedded } = options

  function canEdit(): boolean {
    return !busy.value && currentProject.value !== undefined
  }

  function createDataset(name: string, rows: unknown = []): string | undefined {
    if (!canEdit())
      return undefined
    const id = nextAssetId('dataset', name)
    const created = createDatasetFromRows({ id, name, rows })
    if (!created.success)
      return undefined
    return executeProjectActions('Create Dataset', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.add', dataset: created.data }],
    }])
      ? id
      : undefined
  }

  function replaceDatasetRows(datasetId: string, rows: unknown): boolean {
    if (!canEdit())
      return false
    const current = currentProject.value!.datasetsById[datasetId]
    if (!current)
      return false
    const candidate = createDatasetFromRows({
      id: current.id,
      name: current.name,
      ...(current.description ? { description: current.description } : {}),
      rows,
    })
    if (!candidate.success)
      return false
    return executeProjectActions('Update Dataset rows', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.replaceRows', datasetId, rows: candidate.data.rows }],
    }])
  }

  function renameDataset(datasetId: string, name: string): boolean {
    return canEdit() && executeProjectActions('Rename Dataset', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.rename', datasetId, name }],
    }])
  }

  function deleteDataset(datasetId: string): boolean {
    return canEdit() && executeProjectActions('Delete Dataset', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.remove', datasetId }],
    }])
  }

  function setDatasetDefaultProjection(datasetId: string, projection?: DatasetProjection): boolean {
    return canEdit() && executeProjectActions('Set Dataset projection', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.setDefaultProjection', datasetId, ...(projection ? { projection } : {}) }],
    }])
  }

  function exportDataset(datasetId: string) {
    const dataset = currentProject.value?.datasetsById[datasetId]
    return dataset ? writeDatasetTransfer(dataset) : undefined
  }

  function importDataset(input: unknown, strategy: AssetImportConflictStrategy = 'copy'): string | undefined {
    if (!canEdit())
      return undefined
    const imported = readDatasetTransfer(input)
    if (!imported.success)
      return undefined
    const incoming = imported.data.dataset
    const existing = currentProject.value!.datasetsById[incoming.id]
    if (existing && strategy === 'skip')
      return undefined
    const dataset: ProjectDataset = existing && strategy === 'copy'
      ? { ...structuredClone(incoming), id: nextAssetId('dataset', incoming.name), name: copiedName(incoming.name) }
      : structuredClone(incoming)
    const operation: ProjectOperation = existing && strategy === 'overwrite'
      ? { type: 'dataset.replace' as const, datasetId: incoming.id, dataset }
      : { type: 'dataset.add' as const, dataset }
    return executeProjectActions('Import Dataset', [{ type: 'operation.apply', operations: [operation] }])
      ? dataset.id
      : undefined
  }

  async function createEmbeddedResource(input: EmbeddedResourceInput): Promise<string | undefined> {
    if (!canEdit())
      return undefined
    const id = nextAssetId('resource', input.name || input.fileName)
    const bytes = new Uint8Array(input.bytes)
    const resource: ProjectEmbeddedResource = {
      id,
      name: input.name,
      kind: 'embedded',
      fileName: input.fileName,
      mediaType: input.mediaType,
      byteLength: bytes.byteLength,
      contentHash: await contentHash(bytes),
    }
    return executeProjectActions('Create Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.add', resource }],
    }], undefined, [{ resourceId: id, contentHash: resource.contentHash, bytes }])
      ? id
      : undefined
  }

  function createUrlResource(input: UrlResourceInput): string | undefined {
    if (!canEdit())
      return undefined
    const id = nextAssetId('resource', input.name)
    const resource: ProjectUrlResource = {
      id,
      name: input.name,
      kind: 'url',
      url: input.url,
      ...(input.mediaType?.trim() ? { mediaType: input.mediaType.trim() } : {}),
      ...(input.integrity?.trim() ? { integrity: input.integrity.trim() } : {}),
    }
    return executeProjectActions('Create Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.add', resource }],
    }])
      ? id
      : undefined
  }

  function renameResource(resourceId: string, name: string): boolean {
    return canEdit() && executeProjectActions('Rename Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.rename', resourceId, name }],
    }])
  }

  function deleteResource(resourceId: string): boolean {
    return canEdit() && executeProjectActions('Delete Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.remove', resourceId }],
    }])
  }

  async function replaceEmbeddedResource(resourceId: string, input: EmbeddedResourceInput): Promise<boolean> {
    if (!canEdit())
      return false
    const current = currentProject.value!.resources[resourceId]
    if (!current)
      return false
    const bytes = new Uint8Array(input.bytes)
    const resource: ProjectEmbeddedResource = {
      id: resourceId,
      name: input.name,
      kind: 'embedded',
      fileName: input.fileName,
      mediaType: input.mediaType,
      byteLength: bytes.byteLength,
      contentHash: await contentHash(bytes),
    }
    return executeProjectActions('Replace Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.replace', resourceId, resource }],
    }], undefined, [{ resourceId, contentHash: resource.contentHash, bytes }])
  }

  function replaceUrlResource(resourceId: string, input: UrlResourceInput): boolean {
    if (!canEdit())
      return false
    const resource: ProjectUrlResource = {
      id: resourceId,
      name: input.name,
      kind: 'url',
      url: input.url,
      ...(input.mediaType?.trim() ? { mediaType: input.mediaType.trim() } : {}),
      ...(input.integrity?.trim() ? { integrity: input.integrity.trim() } : {}),
    }
    return executeProjectActions('Replace Resource', [{
      type: 'operation.apply',
      operations: [{ type: 'resource.replace', resourceId, resource }],
    }])
  }

  async function exportResource(resourceId: string) {
    const resource = currentProject.value?.resources[resourceId]
    if (!resource)
      return undefined
    if (resource.kind === 'url')
      return await writeResourceTransfer({ resource })
    const bytes = await readEmbedded({
      projectId: currentProject.value!.id,
      resourceId: resource.id,
      contentHash: resource.contentHash,
    })
    return bytes ? await writeResourceTransfer({ resource, bytes }) : undefined
  }

  async function importResource(input: unknown, strategy: AssetImportConflictStrategy = 'copy'): Promise<string | undefined> {
    if (!canEdit())
      return undefined
    const imported = await readResourceTransfer(input)
    if (!imported.success)
      return undefined
    const existing = currentProject.value!.resources[imported.data.resource.id]
    if (existing && strategy === 'skip')
      return undefined
    const id = existing && strategy === 'copy'
      ? nextAssetId('resource', imported.data.resource.name)
      : imported.data.resource.id
    const resource: ProjectResource = {
      ...structuredClone(imported.data.resource),
      id,
      ...(existing && strategy === 'copy' ? { name: copiedName(imported.data.resource.name) } : {}),
    }
    const operation = existing && strategy === 'overwrite'
      ? { type: 'resource.replace' as const, resourceId: id, resource }
      : { type: 'resource.add' as const, resource }
    const writes = resource.kind === 'embedded' && 'bytes' in imported.data
      ? [{ resourceId: id, contentHash: resource.contentHash, bytes: new Uint8Array(imported.data.bytes) }]
      : []
    return executeProjectActions('Import Resource', [{ type: 'operation.apply', operations: [operation] }], undefined, writes)
      ? id
      : undefined
  }

  function setDatasetBinding(
    surfaceId: string,
    nodeId: string,
    bindingKey: string,
    reference?: DatasetReference,
  ): boolean {
    if (!canEdit())
      return false
    const project = currentProject.value!
    const node = project.surfacesById[surfaceId]?.graph.nodesById[nodeId]
    if (!node)
      return false
    if (reference) {
      const dataset = project.datasetsById[reference.datasetId]
      if (!dataset || !queryDatasetView(dataset, reference.projection, reference.query).success)
        return false
    }
    const bindings = cloneDatasetBindings(node.datasetBindings)
    if (reference)
      bindings[bindingKey] = cloneDatasetReference(reference)
    else
      delete bindings[bindingKey]
    const actions: ProjectCommandAction[] = [{
      type: 'node.patch',
      surfaceId,
      nodeId,
      patch: Object.keys(bindings).length
        ? { set: { datasetBindings: bindings } }
        : { unset: ['datasetBindings'] },
    }]
    if (reference?.projection.kind === 'options' && Object.hasOwn(node.props, 'options')) {
      const props = cloneJsonObject(node.props)
      delete props.options
      actions.push({
        type: 'operation.apply',
        operations: [{ type: 'node.props', surfaceId, nodeId, props }],
      })
    }
    return executeProjectActions(reference ? 'Bind Dataset' : 'Remove Dataset binding', actions)
  }

  function setResourceBinding(
    surfaceId: string,
    nodeId: string,
    bindingKey: string,
    resourceId?: string,
  ): boolean {
    if (!canEdit())
      return false
    const project = currentProject.value!
    const node = project.surfacesById[surfaceId]?.graph.nodesById[nodeId]
    if (!node || (resourceId && !project.resources[resourceId]))
      return false
    const bindings = cloneResourceBindings(node.resourceBindings)
    if (resourceId)
      bindings[bindingKey] = { resourceId }
    else
      delete bindings[bindingKey]
    const actions: ProjectCommandAction[] = [{
      type: 'node.patch',
      surfaceId,
      nodeId,
      patch: Object.keys(bindings).length
        ? { set: { resourceBindings: bindings } }
        : { unset: ['resourceBindings'] },
    }]
    if (resourceId && Object.hasOwn(node.props, bindingKey)) {
      const props = cloneJsonObject(node.props)
      delete props[bindingKey]
      actions.push({
        type: 'operation.apply',
        operations: [{ type: 'node.props', surfaceId, nodeId, props }],
      })
    }
    return executeProjectActions(resourceId ? 'Bind Resource' : 'Remove Resource binding', actions)
  }

  function saveOptionsAsDataset(surfaceId: string, nodeId: string, bindingKey: string, name: string): string | undefined {
    if (!canEdit())
      return undefined
    const node = currentProject.value!.surfacesById[surfaceId]?.graph.nodesById[nodeId]
    const rawOptions = node?.props.options
    if (!node || !Array.isArray(rawOptions))
      return undefined
    const id = nextAssetId('dataset', name)
    const created = createDatasetFromRows({ id, name, rows: rawOptions })
    if (!created.success)
      return undefined
    const projection = optionsProjection()
    if (!projectDatasetRows(created.data, projection).success)
      return undefined
    const bindings = cloneDatasetBindings(node.datasetBindings)
    bindings[bindingKey] = { datasetId: id, projection }
    const props = cloneJsonObject(node.props)
    delete props.options
    return executeProjectActions('Save options as Dataset', [{
      type: 'operation.apply',
      operations: [{ type: 'dataset.add', dataset: { ...created.data, defaultProjection: projection } }],
    }, {
      type: 'node.patch',
      surfaceId,
      nodeId,
      patch: { set: { datasetBindings: bindings } },
    }, {
      type: 'operation.apply',
      operations: [{ type: 'node.props', surfaceId, nodeId, props }],
    }])
      ? id
      : undefined
  }

  function materializeOptionsSnapshot(surfaceId: string, nodeId: string, bindingKey: string): boolean {
    if (!canEdit())
      return false
    const node = currentProject.value!.surfacesById[surfaceId]?.graph.nodesById[nodeId]
    const binding = node?.datasetBindings?.[bindingKey]
    const dataset = binding ? currentProject.value!.datasetsById[binding.datasetId] : undefined
    const projection = binding?.projection
    if (!node || !binding || !dataset || !projection || projection.kind !== 'options')
      return false
    const projected = queryDatasetView(dataset, projection, binding.query)
    if (!projected.success)
      return false
    const values = projected.data.items.map(item => cloneJsonObject(item))
    const bindings = cloneDatasetBindings(node.datasetBindings)
    delete bindings[bindingKey]
    const props: ModelJsonObject = { ...cloneJsonObject(node.props), options: values }
    return executeProjectActions('Materialize Dataset options', [{
      type: 'node.patch',
      surfaceId,
      nodeId,
      patch: Object.keys(bindings).length ? { set: { datasetBindings: bindings } } : { unset: ['datasetBindings'] },
    }, {
      type: 'operation.apply',
      operations: [{ type: 'node.props', surfaceId, nodeId, props }],
    }])
  }

  return {
    createDataset,
    createEmbeddedResource,
    createUrlResource,
    deleteDataset,
    deleteResource,
    exportDataset,
    exportResource,
    importDataset,
    importResource,
    materializeOptionsSnapshot,
    renameDataset,
    renameResource,
    replaceDatasetRows,
    replaceEmbeddedResource,
    replaceUrlResource,
    saveOptionsAsDataset,
    setDatasetBinding,
    setResourceBinding,
    setDatasetDefaultProjection,
  }
}

function cloneDatasetBindings(
  bindings: DeepReadonly<Record<string, DatasetReference>> | undefined,
): Record<string, DatasetReference> {
  return Object.fromEntries(Object.entries(bindings ?? {}).map(([key, binding]) => [
    key,
    cloneDatasetReference(binding),
  ]))
}

function cloneDatasetReference(reference: DeepReadonly<DatasetReference>): DatasetReference {
  return {
    datasetId: reference.datasetId,
    projection: cloneProjection(reference.projection),
    ...(reference.query ? { query: cloneQuery(reference.query) } : {}),
  }
}

function cloneQuery(query: DeepReadonly<DatasetViewQuery>): DatasetViewQuery {
  return {
    ...(query.filter ? { filter: JSON.parse(JSON.stringify(query.filter)) as NonNullable<DatasetViewQuery['filter']> } : {}),
    ...(query.sort
      ? { sort: query.sort.map(rule => ({ path: [...rule.path], direction: rule.direction })) }
      : {}),
    ...(query.page ? { page: { index: query.page.index, size: query.page.size } } : {}),
  }
}

function cloneResourceBindings(
  bindings: DeepReadonly<Record<string, StaticResourceReference>> | undefined,
): Record<string, StaticResourceReference> {
  return Object.fromEntries(Object.entries(bindings ?? {}).map(([key, binding]) => [key, {
    resourceId: binding.resourceId,
  }]))
}

function cloneProjection(projection: DeepReadonly<DatasetProjection>): DatasetProjection {
  switch (projection.kind) {
    case 'options':
      return {
        kind: 'options',
        labelPath: [...projection.labelPath],
        valuePath: [...projection.valuePath],
        ...(projection.disabledPath ? { disabledPath: [...projection.disabledPath] } : {}),
      }
    case 'table':
      return {
        kind: 'table',
        rowKeyPath: [...projection.rowKeyPath],
        columns: projection.columns.map(column => ({ key: column.key, valuePath: [...column.valuePath] })),
      }
    case 'list':
      return {
        kind: 'list',
        itemKeyPath: [...projection.itemKeyPath],
        ...(projection.titlePath ? { titlePath: [...projection.titlePath] } : {}),
        ...(projection.descriptionPath ? { descriptionPath: [...projection.descriptionPath] } : {}),
      }
  }
}

function cloneJsonObject(value: DeepReadonly<ModelJsonObject>): ModelJsonObject {
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
}

function cloneJsonValue(value: DeepReadonly<ModelJsonValue>): ModelJsonValue {
  if (Array.isArray(value))
    return value.map(item => cloneJsonValue(item))
  if (value && typeof value === 'object')
    return cloneJsonObject(value as DeepReadonly<ModelJsonObject>)
  return value
}
