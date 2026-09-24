import type { ProjectDocument, ProjectSurface, SafeExpression } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '..'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  appendConfigImportPath,
  createProjectTransferDocument,
  createSurfaceTransferDocument,
  guardCanonicalConfigImportBudgets,
  guardConfigImportSourceBytes,
  guardConfigImportValue,
  instantiateImportedProject,
  MAX_IMPORT_ARRAY_LENGTH,
  MAX_IMPORT_DEPTH,
  MAX_IMPORT_NODES,
  MAX_IMPORT_SOURCE_BYTES,
  MAX_IMPORT_STRUCTURE_ENTRIES,
  MAX_IMPORT_SURFACES,
  parseConfigImportPayload,
  parseConfigImportSource,
  prepareConfigImport,
} from '../import'
import { createBuiltInProjectFixture } from './fixtures'

async function readNoEmbeddedResource(): Promise<Uint8Array | undefined> {
  return undefined
}

function deterministicFactory(): ProjectIdentityFactory {
  let sequence = 0
  return {
    create: (kind, source) => `${kind}-${source}-${++sequence}`,
  }
}

function addIdentityPairs(
  reverse: Map<string, string>,
  source: readonly { id: string }[],
  imported: readonly { id: string }[],
): void {
  expect(imported).toHaveLength(source.length)
  source.forEach((item, index) => reverse.set(imported[index]!.id, item.id))
}

function surfaceIdentityReverse(source: ProjectSurface, imported: ProjectSurface): Map<string, string> {
  const reverse = new Map([[imported.id, source.id]])
  const sourceNodes = Object.values(source.graph.nodesById)
  const importedNodes = Object.values(imported.graph.nodesById)
  addIdentityPairs(reverse, sourceNodes, importedNodes)
  addIdentityPairs(
    reverse,
    sourceNodes.filter(node => node.kind === 'field').map(node => ({ id: node.field })),
    importedNodes.filter(node => node.kind === 'field').map(node => ({ id: node.field })),
  )
  addIdentityPairs(reverse, source.interactions, imported.interactions)

  return reverse
}

function replaceIdentities(value: unknown, reverse: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string')
    return reverse.get(value) ?? value
  if (Array.isArray(value))
    return value.map(item => replaceIdentities(item, reverse))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      reverse.get(key) ?? key,
      replaceIdentities(item, reverse),
    ]))
  }
  return value
}

function normalizeSurfaceRoundTrip(surface: ProjectSurface, reverse = new Map<string, string>()): unknown {
  const normalized = replaceIdentities(structuredClone(surface), reverse)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized))
    throw new TypeError('Normalized Surface must remain an object.')
  return {
    ...normalized,
    name: '<surface-name>',
    ...(surface.kind === 'page' ? { route: '<surface-route>' } : {}),
  }
}

function projectIdentityReverse(source: ProjectDocument, imported: ProjectDocument): Map<string, string> {
  const reverse = new Map([[imported.id, source.id]])
  expect(imported.surfaceOrder).toHaveLength(source.surfaceOrder.length)
  source.surfaceOrder.forEach((sourceSurfaceId, index) => {
    const importedSurfaceId = imported.surfaceOrder[index]!
    surfaceIdentityReverse(
      source.surfacesById[sourceSurfaceId]!,
      imported.surfacesById[importedSurfaceId]!,
    ).forEach((value, key) => reverse.set(key, value))
  })
  return reverse
}

async function currentProject(): Promise<ProjectDocument> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  return createBuiltInProjectFixture(
    'element-profile',
    { id: 'project', name: 'Fixture project' },
    adapter.componentRegistry.lock,
  )
}

async function projectTransfer(project: ProjectDocument) {
  return createProjectTransferDocument(project, readNoEmbeddedResource)
}

async function surfaceTransfer(project: ProjectDocument, surfaceId = project.homeSurfaceId) {
  return createSurfaceTransferDocument(project, surfaceId, readNoEmbeddedResource)
}

function expressionFixture(primaryField: string, secondaryField: string): SafeExpression {
  return {
    version: 1,
    ast: {
      kind: 'array',
      items: [
        { kind: 'reference', scope: 'values', path: [primaryField, 'profile'] },
        {
          kind: 'unary',
          operator: '!',
          operand: { kind: 'reference', scope: 'values', selector: 'root', path: [secondaryField] },
        },
        {
          kind: 'binary',
          operator: '==',
          left: { kind: 'reference', scope: 'values', selector: 'parent', path: [primaryField] },
          right: { kind: 'literal', value: null },
        },
        {
          kind: 'conditional',
          test: { kind: 'reference', scope: 'values', path: [secondaryField] },
          consequent: {
            kind: 'call',
            callee: 'coalesce',
            args: [
              { kind: 'reference', scope: 'values', path: [primaryField] },
              { kind: 'reference', scope: 'parameters', path: ['fallback'] },
            ],
          },
          alternate: { kind: 'reference', scope: 'values', path: [] },
        },
      ],
    },
  }
}

function addExpressionFixture(document: ProjectDocument): {
  primaryField: string
  secondaryField: string
  surfaceId: string
} {
  const surface = document.surfacesById[document.homeSurfaceId]!
  const fields = Object.values(surface.graph.nodesById).filter(node => node.kind === 'field')
  const primary = fields[0]
  const secondary = fields[1]
  if (!primary || !secondary)
    throw new TypeError('Expression import fixture requires two field nodes.')
  surface.parameters = [{ name: 'fallback', required: false, defaultValue: 'fallback' }]
  surface.interactions = [{
    kind: 'valueChange',
    id: 'expression-remap',
    dependencies: [primary.id],
    action: {
      kind: 'set',
      targetFieldId: secondary.id,
      value: expressionFixture(primary.field, secondary.field),
    },
  }]
  return {
    primaryField: primary.field,
    secondaryField: secondary.field,
    surfaceId: surface.id,
  }
}

function expectRemappedExpression(surface: ProjectSurface, source: {
  primaryField: string
  secondaryField: string
}): void {
  const interaction = surface.interactions.find(candidate => candidate.kind === 'valueChange')
  if (!interaction || interaction.kind !== 'valueChange' || interaction.action.kind !== 'set')
    throw new TypeError('Imported expression fixture is missing its value rule.')
  const primary = surface.graph.nodesById[interaction.dependencies[0]!]
  const secondary = surface.graph.nodesById[interaction.action.targetFieldId]
  if (primary?.kind !== 'field' || secondary?.kind !== 'field')
    throw new TypeError('Imported expression fixture must still reference field nodes.')
  expect(primary.field).not.toBe(source.primaryField)
  expect(secondary.field).not.toBe(source.secondaryField)
  expect(interaction.action.value).toEqual(expressionFixture(primary.field, secondary.field))
}

describe('config model JSON import', () => {
  it('rejects syntax, unsafe keys, depth, and array budgets', () => {
    expect(parseConfigImportSource('{')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_JSON_INVALID' }],
    })
    expect(guardConfigImportSourceBytes(MAX_IMPORT_SOURCE_BYTES + 1)).toMatchObject([{
      code: 'IMPORT_SOURCE_TOO_LARGE',
    }])
    const polluted: unknown = JSON.parse('{"safe":{"constructor":true}}')
    expect(guardConfigImportValue(polluted)).toMatchObject([{
      code: 'IMPORT_UNSAFE_KEY',
      path: '$.safe.constructor',
    }])
    let deep: unknown = null
    for (let index = 0; index <= MAX_IMPORT_DEPTH; index += 1)
      deep = { child: deep }
    expect(guardConfigImportValue(deep)[0]?.code).toBe('IMPORT_DEPTH_LIMIT_EXCEEDED')
    expect(guardConfigImportValue(Array.from({ length: MAX_IMPORT_ARRAY_LENGTH + 1 }).fill(null))[0]?.code)
      .toBe('IMPORT_ARRAY_LIMIT_EXCEEDED')
  })

  it('accepts exact security budgets and rejects the first value beyond each boundary', async () => {
    expect(guardConfigImportSourceBytes(MAX_IMPORT_SOURCE_BYTES)).toEqual([])
    expect(guardConfigImportSourceBytes(MAX_IMPORT_SOURCE_BYTES + 1)[0]?.code).toBe('IMPORT_SOURCE_TOO_LARGE')
    expect(parseConfigImportSource(`"${'x'.repeat(2 * 1024 * 1024)}"`).success).toBe(true)

    let exactDepth: unknown = null
    for (let index = 0; index < MAX_IMPORT_DEPTH; index += 1)
      exactDepth = { child: exactDepth }
    expect(guardConfigImportValue(exactDepth)).toEqual([])
    exactDepth = { child: exactDepth }
    expect(guardConfigImportValue(exactDepth)[0]?.code).toBe('IMPORT_DEPTH_LIMIT_EXCEEDED')

    const exactEntries = Object.fromEntries(Array.from(
      { length: MAX_IMPORT_STRUCTURE_ENTRIES },
      (_, index) => [`k${index}`, null],
    ))
    expect(guardConfigImportValue(exactEntries)).toEqual([])
    exactEntries.extra = null
    expect(guardConfigImportValue(exactEntries)[0]?.code).toBe('IMPORT_STRUCTURE_LIMIT_EXCEEDED')

    const project = await currentProject()
    const sourceSurface = project.surfacesById[project.homeSurfaceId]!
    if (sourceSurface.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    const surfaceEntries = Array.from({ length: MAX_IMPORT_SURFACES }, (_, index) => {
      const id = `surface-${index}`
      return [id, { ...structuredClone(sourceSurface), id, route: `/${id}` }] as const
    })
    const surfaceOrder = surfaceEntries.map(([id]) => id)
    const surfacesById = Object.fromEntries(surfaceEntries)
    const envelope = await projectTransfer(project)
    const budgetDocument: ProjectDocument = {
      ...structuredClone(project),
      homeSurfaceId: surfaceOrder[0]!,
      surfaceOrder,
      surfacesById,
    }
    expect(guardCanonicalConfigImportBudgets({
      target: 'project',
      envelope: { ...envelope, document: budgetDocument },
    })).toEqual([])
    const overflowSurface = {
      ...structuredClone(sourceSurface),
      id: 'surface-overflow',
      route: '/surface-overflow',
    }
    expect(guardCanonicalConfigImportBudgets({
      target: 'project',
      envelope: {
        ...envelope,
        document: {
          ...budgetDocument,
          surfaceOrder: [...surfaceOrder, overflowSurface.id],
          surfacesById: { ...surfacesById, [overflowSurface.id]: overflowSurface },
        },
      },
    })[0]?.code).toBe('IMPORT_SURFACE_LIMIT_EXCEEDED')

    const nodeOverflowDocument = {
      ...structuredClone(project),
      surfaceOrder: [sourceSurface.id],
      surfacesById: {
        [sourceSurface.id]: {
          ...structuredClone(sourceSurface),
          graph: {
            ...structuredClone(sourceSurface.graph),
            nodesById: Object.fromEntries(Array.from(
              { length: MAX_IMPORT_NODES + 1 },
              (_, index) => [`node-${index}`, {}],
            )),
          },
        },
      },
    }
    const nodeOverflowEnvelope = { ...envelope, document: nodeOverflowDocument }
    expect(guardCanonicalConfigImportBudgets({
      target: 'project',
      envelope: nodeOverflowEnvelope,
    })[0]?.code).toBe('IMPORT_NODE_LIMIT_EXCEEDED')
    await expect(prepareConfigImport({
      source: JSON.stringify(nodeOverflowEnvelope),
      target: 'project',
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_NODE_LIMIT_EXCEEDED' }],
    })
  })

  it('does not count identity-like keys inside opaque project metadata', async () => {
    const project = structuredClone(await currentProject())
    project.settings.nodesById = Object.fromEntries(Array.from(
      { length: MAX_IMPORT_NODES + 1 },
      (_, index) => [`metadata-${index}`, null],
    ))
    const result = await prepareConfigImport({ source: JSON.stringify(await projectTransfer(project)), target: 'project' })
    expect(result.success).toBe(true)
  })

  it('rejects every unsafe key at any depth with an escaped stable path', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const value: unknown = JSON.parse(`{"safe-key":{"${key}":true}}`)
      expect(guardConfigImportValue(value)).toMatchObject([{
        code: 'IMPORT_UNSAFE_KEY',
        path: `$["safe-key"].${key}`,
      }])
    }
  })

  it('escapes dynamic Model segments in diagnostics', async () => {
    const project = structuredClone(await currentProject())
    const component = Object.keys(project.registryLock.components)[0]!
    const contract = project.registryLock.components[component]!
    const envelope = await projectTransfer(project)
    const result = await prepareConfigImport({
      source: JSON.stringify({
        ...envelope,
        document: {
          ...project,
          registryLock: {
            ...project.registryLock,
            components: {
              ...project.registryLock.components,
              [component]: { ...contract, fingerprint: 42 },
            },
          },
        },
      }),
      target: 'project',
    })
    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_PROJECT_INVALID',
        path: `${appendConfigImportPath('$.registryLock.components', component)}.fingerprint`,
      }],
    })
  })

  it('normalizes remapped Surface compiler failures into import diagnostics', async () => {
    const project = await currentProject()
    const surface = project.surfacesById[project.homeSurfaceId]!
    const sourceNodeId = surface.graph.root[0]!.nodeId
    const sourceNode = surface.graph.nodesById[sourceNodeId]!
    surface.graph.nodesById[sourceNodeId] = {
      id: sourceNode.id,
      component: sourceNode.component,
      kind: 'layout',
      props: structuredClone(sourceNode.props),
      slots: {},
    }
    const identityFactory: ProjectIdentityFactory = {
      create: (kind, source) => `${kind}.fresh.${source}`,
    }
    const result = await prepareConfigImport({
      identityFactory,
      source: JSON.stringify(await projectTransfer(project)),
      target: 'project',
    })
    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_PREVIEW_COMPILE_FAILED',
        path: '$',
      }],
    })
  })

  it('fails closed for obsolete, missing, future, and bare documents', async () => {
    const project = await currentProject()
    expect(parseConfigImportPayload(project, 'surface')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_TARGET_MISMATCH', path: '$.kind' }],
    })
    const envelope = await projectTransfer(project)
    expect(parseConfigImportPayload({ ...envelope, version: 0 }, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    expect(parseConfigImportPayload({ ...envelope, version: 2 }, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    const { version: _version, ...missing } = envelope
    expect(parseConfigImportPayload(missing, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    expect(parseConfigImportPayload(project.surfacesById[project.homeSurfaceId], 'surface')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_TARGET_MISMATCH', path: '$.kind' }],
    })
    expect(parseConfigImportPayload({
      kind: 'config-form-page',
      version: 2,
      page: project.surfacesById[project.homeSurfaceId],
    }, 'surface')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_TARGET_MISMATCH', path: '$.kind' }],
    })
  })

  it('prepares fresh Project and Surface instances through the available Registry', async () => {
    const project = await currentProject()
    const projectResult = await prepareConfigImport({
      identityFactory: deterministicFactory(),
      source: JSON.stringify(await projectTransfer(project)),
      target: 'project',
    })
    expect(projectResult.success).toBe(true)
    if (!projectResult.success)
      return
    expect(projectResult.prepared.target).toBe('project')
    if (projectResult.prepared.target !== 'project')
      return
    expect(projectResult.prepared.document.id).not.toBe(project.id)
    expect(projectResult.prepared.document.homeSurfaceId).not.toBe(project.homeSurfaceId)
    expect(projectResult.prepared.summary).toMatchObject({
      adapter: 'element-plus',
      nodeCount: 3,
      surfaceCount: 1,
      target: 'project',
    })

    const sourceProject = structuredClone(project)
    const sourceSurface = sourceProject.surfacesById[sourceProject.homeSurfaceId]!
    if (sourceSurface.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    sourceSurface.route = '/imported-profile'
    const transfer = await surfaceTransfer(sourceProject, sourceSurface.id)
    const surfaceComponents = [...new Set(Object.values(sourceSurface.graph.nodesById).map(node => node.component))]
      .sort((left, right) => left.localeCompare(right))
    expect(Object.keys(transfer.registryLock.components).sort((left, right) => left.localeCompare(right)))
      .toEqual(surfaceComponents)
    expect(Object.keys(project.registryLock.components).length).toBeGreaterThan(surfaceComponents.length)

    const surfaceResult = await prepareConfigImport({
      currentProject: project,
      identityFactory: deterministicFactory(),
      source: JSON.stringify(transfer),
      target: 'surface',
    })
    expect(surfaceResult.success).toBe(true)
    if (!surfaceResult.success || surfaceResult.prepared.target !== 'surface')
      return
    expect(surfaceResult.prepared.surface.id).not.toBe(sourceSurface.id)
    expect(surfaceResult.prepared.surface.kind).toBe('page')
    if (surfaceResult.prepared.surface.kind !== 'page')
      return
    expect(surfaceResult.prepared.surface.route).toBe(sourceSurface.route)
    expect(surfaceResult.prepared.preview.compilation.surface.id).toBe(surfaceResult.prepared.surface.id)
  })

  it('remaps complete Dataset and Resource bindings during Project import identity allocation', async () => {
    const source = structuredClone(await currentProject())
    const surface = source.surfacesById[source.homeSurfaceId]!
    const sourceNodeId = surface.graph.root[1]!.nodeId
    const node = surface.graph.nodesById[sourceNodeId]!
    source.datasetOrder = ['roles']
    source.datasetsById = {
      roles: { id: 'roles', name: 'Roles', rows: [{ label: 'Developer', value: 'developer' }] },
    }
    source.resources = {
      avatar: {
        id: 'avatar',
        kind: 'url',
        name: 'Avatar',
        url: '/avatar.png',
        mediaType: 'image/png',
      },
    }
    node.datasetBindings = {
      options: {
        datasetId: 'roles',
        projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
      },
    }
    node.resourceBindings = { media: { resourceId: 'avatar' } }

    const imported = instantiateImportedProject(source, deterministicFactory())
    const importedSurface = imported.document.surfacesById[imported.document.homeSurfaceId]!
    const importedNodeId = importedSurface.graph.root[1]!.nodeId
    const importedNode = importedSurface.graph.nodesById[importedNodeId]!
    expect(importedNode.datasetBindings?.options?.datasetId).toBe(imported.maps.datasets.get('roles'))
    expect(importedNode.resourceBindings?.media?.resourceId).toBe(imported.maps.resources.get('avatar'))
    expect(imported.document.datasetsById[imported.maps.datasets.get('roles')!]?.id)
      .toBe(imported.maps.datasets.get('roles'))
    expect(imported.document.resources[imported.maps.resources.get('avatar')!]?.id)
      .toBe(imported.maps.resources.get('avatar'))
  })

  it('rejects duplicate Resource identity allocation instead of folding Project resources', async () => {
    const source = structuredClone(await currentProject())
    source.resources = {
      first: { id: 'first', kind: 'url', name: 'First', url: '/first.png' },
      second: { id: 'second', kind: 'url', name: 'Second', url: '/second.png' },
    }
    const result = await prepareConfigImport({
      identityFactory: {
        create: (kind, id) => kind === 'resource' ? 'resource-collision' : `${kind}-${id}`,
      },
      source: JSON.stringify(await projectTransfer(source)),
      target: 'project',
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_PROJECT_INVALID',
        message: expect.stringContaining('Resource identity'),
      }],
    })
  })

  it('rejects a Surface Resource identity that collides with the target project', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const current = structuredClone(await currentProject())
    const currentSurface = current.surfacesById[current.homeSurfaceId]!
    const sourceNodeId = currentSurface.graph.root[0]!.nodeId
    const sourceNode = currentSurface.graph.nodesById[sourceNodeId]!
    const componentRegistry = createComponentContractRegistry(
      adapter.componentRegistry.list().map(contract => contract.key === sourceNode.component
        ? {
            ...contract,
            resourceBindings: [{ key: 'media', mediaTypes: ['image/png'] }],
          }
        : contract),
      {
        adapter: adapter.componentRegistry.lock.adapter,
        version: adapter.componentRegistry.lock.version,
      },
    )
    current.registryLock = componentRegistry.lock
    current.resources = {
      'existing-resource': {
        id: 'existing-resource',
        kind: 'url',
        name: 'Existing',
        url: '/existing.png',
        mediaType: 'image/png',
      },
    }
    const source = structuredClone(current)
    const surface = source.surfacesById[source.homeSurfaceId]!
    if (surface.kind !== 'page')
      throw new TypeError('The Resource collision fixture requires a Page Surface.')
    surface.route = '/resource-collision-import'
    const node = surface.graph.nodesById[sourceNodeId]!
    node.resourceBindings = { media: { resourceId: 'incoming-resource' } }
    source.resources['incoming-resource'] = {
      id: 'incoming-resource',
      kind: 'url',
      name: 'Incoming',
      url: '/incoming.png',
      mediaType: 'image/png',
    }

    const result = await prepareConfigImport({
      currentProject: current,
      identityFactory: {
        create: (kind, id) => kind === 'resource' ? 'existing-resource' : `${kind}-${id}`,
      },
      loadAdapter: async () => ({
        ...adapter,
        componentRegistry,
        registrySnapshot: createRegistryContractSnapshot(componentRegistry),
      }),
      source: JSON.stringify(await surfaceTransfer(source, surface.id)),
      target: 'surface',
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_SURFACE_INVALID',
        message: expect.stringContaining('Resource identity'),
      }],
    })
  })

  it.each(['project', 'surface'] as const)(
    'remaps nested values expression paths for %s imports',
    async (target) => {
      const current = await currentProject()
      const source = structuredClone(current)
      source.id = 'expression-source-project'
      const sourceSurface = source.surfacesById[source.homeSurfaceId]!
      if (sourceSurface.kind !== 'page')
        throw new TypeError('The expression import fixture must use a Page Surface.')
      sourceSurface.route = '/expression-source'
      const identities = addExpressionFixture(source)
      const result = await prepareConfigImport({
        ...(target === 'surface' ? { currentProject: current } : {}),
        identityFactory: deterministicFactory(),
        source: JSON.stringify(target === 'project'
          ? await projectTransfer(source)
          : await surfaceTransfer(source, identities.surfaceId)),
        target,
      })

      expect(result.success).toBe(true)
      if (!result.success)
        return
      const imported = result.prepared.target === 'project'
        ? result.prepared.document.surfacesById[result.prepared.document.homeSurfaceId]!
        : result.prepared.surface
      expectRemappedExpression(imported, identities)
    },
  )

  it('rejects a Page route conflict before allocating imported identities', async () => {
    const project = await currentProject()
    const sourceSurface = project.surfacesById[project.homeSurfaceId]!
    if (sourceSurface.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    let identityAllocations = 0

    const result = await prepareConfigImport({
      currentProject: project,
      identityFactory: {
        create: () => {
          identityAllocations += 1
          return `unexpected-${identityAllocations}`
        },
      },
      source: JSON.stringify(await surfaceTransfer(project, sourceSurface.id)),
      target: 'surface',
    })

    expect(result).toEqual({
      success: false,
      diagnostics: [{
        code: 'IMPORT_SURFACE_INVALID',
        message: `Page route conflicts with the target project: ${sourceSurface.route}.`,
        path: `${appendConfigImportPath('$.surfacesById', sourceSurface.id)}.route`,
      }],
    })
    expect(identityAllocations).toBe(0)
  })

  it('remaps and validates a multi-Surface interaction closure as one project', async () => {
    const project = await currentProject()
    const sourceProject = structuredClone(project)
    const sourcePage = sourceProject.surfacesById[sourceProject.homeSurfaceId]!
    if (sourcePage.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    sourcePage.route = '/multi-surface-import'
    const sourceNodeId = sourcePage.graph.root[0]!.nodeId
    sourcePage.interactions = [{
      kind: 'primaryUiAction',
      id: 'open-details',
      nodeId: sourceNodeId,
      trigger: 'activate',
      action: { kind: 'open', targetSurfaceId: 'details-dialog', parameters: [] },
    }]
    sourceProject.surfaceOrder.push('details-dialog')
    sourceProject.surfacesById['details-dialog'] = {
      id: 'details-dialog',
      kind: 'dialog',
      name: 'Details',
      parameters: [],
      outputs: [],
      interactions: [],
      presentation: {
        kind: 'dialog',
        title: 'Details',
        width: { desktop: { value: 480, unit: 'px' } },
        mask: true,
        close: { escape: true, mask: true, button: true },
      },
      graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root: [], nodesById: {} },
    }

    const result = await prepareConfigImport({
      currentProject: project,
      identityFactory: deterministicFactory(),
      source: JSON.stringify(await surfaceTransfer(sourceProject, sourcePage.id)),
      target: 'surface',
    })

    expect(result.success).toBe(true)
    if (!result.success || result.prepared.target !== 'surface')
      return
    expect(result.prepared.document.surfaceOrder).toHaveLength(project.surfaceOrder.length + 2)
    const interaction = result.prepared.surface.interactions[0]
    expect(interaction).toMatchObject({
      kind: 'primaryUiAction',
      action: { kind: 'open' },
    })
    if (interaction?.kind !== 'primaryUiAction' || interaction.action.kind !== 'open')
      return
    expect(interaction.action.targetSurfaceId).not.toBe('details-dialog')
    expect(result.prepared.document.surfacesById[interaction.action.targetSurfaceId]?.kind).toBe('dialog')
  })

  it('rejects a Project lock that omits an unused active Registry component', async () => {
    const project = structuredClone(await currentProject())
    const usedComponents = new Set(Object.values(project.surfacesById)
      .flatMap(page => Object.values(page.graph.nodesById).map(node => node.component)))
    const omittedComponent = Object.keys(project.registryLock.components)
      .find(component => !usedComponents.has(component))
    expect(omittedComponent).toBeDefined()
    if (!omittedComponent)
      return
    delete project.registryLock.components[omittedComponent]
    project.registryLock.fingerprint = registryLockFingerprint(project.registryLock.components)
    const envelope = await projectTransfer(await currentProject())

    const result = await prepareConfigImport({
      identityFactory: deterministicFactory(),
      source: JSON.stringify({ ...envelope, document: project }),
      target: 'project',
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [expect.objectContaining({
        code: 'IMPORT_REGISTRY_INVALID',
        message: 'Transfer Registry lock must exactly match the active Registry.',
        path: '$.document.registryLock',
      })],
    })
  })

  it('rejects Registry component contract drift without converting the document', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const project = await currentProject()
    const sourceNode = Object.values(project.surfacesById[project.homeSurfaceId]!.graph.nodesById)
      .find(node => node.kind === 'field')!
    const sourceContract = adapter.componentRegistry.get(sourceNode.component)!
    const currentVersion = `${sourceContract.version}-current-test`
    const componentRegistry = createComponentContractRegistry(
      adapter.componentRegistry.list().map(contract => contract.key === sourceContract.key
        ? { ...contract, version: currentVersion }
        : contract),
      {
        adapter: 'element-plus',
        version: adapter.componentRegistry.lock.version,
      },
    )
    const result = await prepareConfigImport({
      identityFactory: deterministicFactory(),
      loadAdapter: async () => ({
        ...adapter,
        componentRegistry,
        registrySnapshot: createRegistryContractSnapshot(componentRegistry),
      }),
      source: JSON.stringify(await projectTransfer(project)),
      target: 'project',
    })
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'IMPORT_REGISTRY_INVALID',
        path: `${appendConfigImportPath('$.document.registryLock.components', sourceContract.key)}.contractVersion`,
      }),
    ]))
  })

  it('keeps fresh identities within the current 128-character identifier limit', async () => {
    const project = await currentProject()
    const sourceSurface = structuredClone(project.surfacesById[project.homeSurfaceId]!)
    if (sourceSurface.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    sourceSurface.route = '/long-identity-import'
    const sourceNodeId = sourceSurface.graph.root[0]!.nodeId
    const sourceNode = sourceSurface.graph.nodesById[sourceNodeId]!
    const longNodeId = 'n'.repeat(128)
    delete sourceSurface.graph.nodesById[sourceNodeId]
    sourceNode.id = longNodeId
    if (sourceNode.kind === 'field')
      sourceNode.field = 'f'.repeat(128)
    sourceSurface.graph.nodesById[longNodeId] = sourceNode
    sourceSurface.graph.root[0]!.nodeId = longNodeId
    sourceSurface.id = 'p'.repeat(128)
    const sourceProject = structuredClone(project)
    delete sourceProject.surfacesById[sourceProject.homeSurfaceId]
    sourceProject.homeSurfaceId = sourceSurface.id
    sourceProject.surfaceOrder = [sourceSurface.id]
    sourceProject.surfacesById[sourceSurface.id] = sourceSurface

    const result = await prepareConfigImport({
      currentProject: project,
      source: JSON.stringify(await surfaceTransfer(sourceProject, sourceSurface.id)),
      target: 'surface',
    })
    expect(result.success).toBe(true)
    if (!result.success || result.prepared.target !== 'surface')
      return
    expect(result.prepared.surface.id.length).toBeLessThanOrEqual(128)
    Object.values(result.prepared.surface.graph.nodesById).forEach((node) => {
      expect(node.id.length).toBeLessThanOrEqual(128)
      if (node.kind === 'field')
        expect(node.field.length).toBeLessThanOrEqual(128)
    })
  })

  it('normalizes adapter and identity failures into import diagnostics', async () => {
    const project = await currentProject()
    const envelope = await projectTransfer(project)
    await expect(prepareConfigImport({
      loadAdapter: async () => { throw new Error('adapter load failed') },
      source: JSON.stringify(envelope),
      target: 'project',
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_PROJECT_INVALID', path: '$' }],
    })
    await expect(prepareConfigImport({
      identityFactory: { create: () => 'duplicate' },
      source: JSON.stringify(envelope),
      target: 'project',
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_PROJECT_INVALID' }],
    })
  })

  it('reports Surface closure summary semantics without unrelated source resources', async () => {
    const hostProject = await currentProject()
    const sourceProject = structuredClone(hostProject)
    sourceProject.id = 'surface-source-project'
    sourceProject.resources.asset = {
      id: 'asset',
      name: 'Unreferenced asset',
      kind: 'url',
      url: '/asset.png',
      mediaType: 'image/png',
    }
    const sourceSurface = sourceProject.surfacesById[sourceProject.homeSurfaceId]!
    if (sourceSurface.kind !== 'page')
      throw new TypeError('The built-in fixture home Surface must be a Page.')
    sourceSurface.route = '/summary-import'
    const result = await prepareConfigImport({
      currentProject: hostProject,
      identityFactory: deterministicFactory(),
      source: JSON.stringify(await surfaceTransfer(sourceProject, sourceSurface.id)),
      target: 'surface',
    })
    expect(result).toMatchObject({
      success: true,
      prepared: { summary: { surfaceCount: 1, resourceCount: 0, target: 'surface' } },
    })
  })

  it('preserves semantic content across generated Project JSON round trips', async () => {
    const base = await currentProject()
    await fc.assert(fc.asyncProperty(fc.record({
      count: fc.integer(),
      enabled: fc.boolean(),
      label: fc.string({ maxLength: 40 }),
    }), async (metadata) => {
      const source = structuredClone(base)
      source.settings.roundTrip = metadata
      const home = source.surfacesById[source.homeSurfaceId]!
      home.graph.props.roundTrip = metadata
      const result = await prepareConfigImport({
        identityFactory: deterministicFactory(),
        source: JSON.stringify(await projectTransfer(source)),
        target: 'project',
      })
      expect(result.success).toBe(true)
      if (!result.success || result.prepared.target !== 'project')
        return
      expect(replaceIdentities(
        result.prepared.document,
        projectIdentityReverse(source, result.prepared.document),
      )).toEqual(source)
    }), { numRuns: 20 })
  })

  it('preserves semantic content across generated Surface JSON round trips', async () => {
    const project = await currentProject()
    const baseSurface = project.surfacesById[project.homeSurfaceId]!
    await fc.assert(fc.asyncProperty(fc.record({
      count: fc.integer(),
      enabled: fc.boolean(),
      label: fc.string({ maxLength: 40 }),
    }), async (metadata) => {
      const sourceSurface = structuredClone(baseSurface)
      if (sourceSurface.kind === 'page')
        sourceSurface.route = '/round-trip-import'
      sourceSurface.graph.props.roundTrip = metadata
      Object.values(sourceSurface.graph.nodesById).forEach((node, index) => {
        node.props.roundTrip = { ...metadata, index }
      })
      const sourceProject = structuredClone(project)
      sourceProject.surfacesById[sourceSurface.id] = sourceSurface
      const result = await prepareConfigImport({
        currentProject: project,
        identityFactory: deterministicFactory(),
        source: JSON.stringify(await surfaceTransfer(sourceProject, sourceSurface.id)),
        target: 'surface',
      })
      expect(result.success).toBe(true)
      if (!result.success || result.prepared.target !== 'surface')
        return

      const importedSurface = structuredClone(result.prepared.surface)
      expect(normalizeSurfaceRoundTrip(
        importedSurface,
        surfaceIdentityReverse(sourceSurface, importedSurface),
      )).toEqual(normalizeSurfaceRoundTrip(sourceSurface))
    }), { numRuns: 20 })
  })

  it('never leaks a non-diagnostic exception for generated JSON values', async () => {
    await fc.assert(fc.asyncProperty(fc.jsonValue(), async (value) => {
      const result = await prepareConfigImport({ source: JSON.stringify(value), target: 'project' })
      expect(typeof result.success).toBe('boolean')
      if (!result.success)
        expect(result.diagnostics.length).toBeGreaterThan(0)
    }), { numRuns: 100 })
  })
})
