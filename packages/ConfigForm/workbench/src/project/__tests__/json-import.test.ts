import type { ConfigFormFlowReactionNodeConfig } from '@moluoxixi/config-form-core'
import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '..'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
  registryLockFingerprint,
} from '@moluoxixi/config-form-model'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  appendConfigImportPath,
  guardCanonicalConfigImportBudgets,
  guardConfigImportValue,
  MAX_IMPORT_ARRAY_LENGTH,
  MAX_IMPORT_DEPTH,
  MAX_IMPORT_NODES,
  MAX_IMPORT_PAGES,
  MAX_IMPORT_SOURCE_BYTES,
  MAX_IMPORT_STRUCTURE_ENTRIES,
  parseConfigImportPayload,
  parseConfigImportSource,
  prepareConfigImport,
} from '../import'
import { createProjectDocumentFixture } from './fixtures'

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

function pageIdentityReverse(source: ProjectPage, imported: ProjectPage): Map<string, string> {
  const reverse = new Map([[imported.id, source.id]])
  const sourceNodes = Object.values(source.graph.nodesById)
  const importedNodes = Object.values(imported.graph.nodesById)
  addIdentityPairs(reverse, sourceNodes, importedNodes)
  addIdentityPairs(
    reverse,
    sourceNodes.filter(node => node.kind === 'field').map(node => ({ id: node.field })),
    importedNodes.filter(node => node.kind === 'field').map(node => ({ id: node.field })),
  )
  sourceNodes.forEach((node, index) => addIdentityPairs(
    reverse,
    node.reactions ?? [],
    importedNodes[index]!.reactions ?? [],
  ))

  const sourceFlows = source.flows ?? []
  const importedFlows = imported.flows ?? []
  addIdentityPairs(reverse, sourceFlows, importedFlows)
  sourceFlows.forEach((flow, flowIndex) => {
    const importedFlow = importedFlows[flowIndex]!
    addIdentityPairs(reverse, flow.nodes, importedFlow.nodes)
    addIdentityPairs(reverse, flow.edges, importedFlow.edges)
    flow.nodes.forEach((node, nodeIndex) => {
      const importedNode = importedFlow.nodes[nodeIndex]!
      const sourceReactions = node.type === 'reaction' && node.config
        ? (node.config as unknown as ConfigFormFlowReactionNodeConfig).reactions
        : []
      const importedReactions = importedNode.type === 'reaction' && importedNode.config
        ? (importedNode.config as unknown as ConfigFormFlowReactionNodeConfig).reactions
        : []
      addIdentityPairs(reverse, sourceReactions, importedReactions)
    })
  })
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

function normalizePageRoundTrip(page: ProjectPage, reverse = new Map<string, string>()): ProjectPage {
  const normalized = replaceIdentities(structuredClone(page), reverse) as ProjectPage
  normalized.name = '<page-name>'
  normalized.route = '<page-route>'
  return normalized
}

function projectIdentityReverse(source: ProjectDocument, imported: ProjectDocument): Map<string, string> {
  const reverse = new Map([[imported.id, source.id]])
  expect(imported.pageOrder).toHaveLength(source.pageOrder.length)
  source.pageOrder.forEach((sourcePageId, index) => {
    const importedPageId = imported.pageOrder[index]!
    pageIdentityReverse(
      source.pagesById[sourcePageId]!,
      imported.pagesById[importedPageId]!,
    ).forEach((value, key) => reverse.set(key, value))
  })
  return reverse
}

async function currentProject(): Promise<ProjectDocument> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const project = createProjectDocumentFixture()
  project.registryLock = structuredClone(adapter.componentRegistry.lock)
  return project
}

function pageTransfer(project: ProjectDocument, page: ProjectPage) {
  const keys = new Set(Object.values(page.graph.nodesById).map(node => node.component))
  const components = Object.fromEntries([...keys].map(key => [key, project.registryLock.components[key]!]))
  return {
    kind: 'config-form-page' as const,
    version: 1 as const,
    registryLock: {
      adapter: project.registryLock.adapter,
      version: project.registryLock.version,
      fingerprint: registryLockFingerprint(components),
      components,
    },
    page,
  }
}

describe('config model JSON import', () => {
  it('rejects syntax, UTF-8 source size, unsafe keys, depth, and array budgets', () => {
    expect(parseConfigImportSource('{')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_JSON_INVALID' }],
    })
    expect(parseConfigImportSource(`"${'x'.repeat(MAX_IMPORT_SOURCE_BYTES)}"`)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_SOURCE_TOO_LARGE' }],
    })
    const polluted = JSON.parse('{"safe":{"constructor":true}}') as unknown
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

  it('accepts exact security budgets and rejects the first value beyond each boundary', () => {
    const exactBytes = `"${'x'.repeat(MAX_IMPORT_SOURCE_BYTES - 2)}"`
    expect(parseConfigImportSource(exactBytes).success).toBe(true)
    expect(parseConfigImportSource(`"${'界'.repeat(Math.ceil(MAX_IMPORT_SOURCE_BYTES / 3))}"`)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_SOURCE_TOO_LARGE' }],
    })

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

    const project = createProjectDocumentFixture()
    const sourcePage = project.pagesById[project.homePageId]!
    const pagesById = Object.fromEntries(Array.from(
      { length: MAX_IMPORT_PAGES },
      (_, index) => [`page-${index}`, { ...sourcePage, id: `page-${index}` }],
    )) as ProjectDocument['pagesById']
    expect(guardCanonicalConfigImportBudgets({
      target: 'project',
      document: { ...project, pagesById },
    })).toEqual([])
    pagesById['page-overflow'] = { ...sourcePage, id: 'page-overflow' }
    expect(guardCanonicalConfigImportBudgets({
      target: 'project',
      document: { ...project, pagesById },
    })[0]?.code).toBe('IMPORT_PAGE_LIMIT_EXCEEDED')

    const nodesById = Object.fromEntries(Array.from(
      { length: MAX_IMPORT_NODES },
      (_, index) => [`node-${index}`, null],
    )) as unknown as ProjectPage['graph']['nodesById']
    const page = { ...sourcePage, graph: { ...sourcePage.graph, nodesById } }
    expect(guardCanonicalConfigImportBudgets({ target: 'page', page, registryLock: project.registryLock })).toEqual([])
    nodesById['node-overflow'] = sourcePage.graph.nodesById[sourcePage.graph.root[0]!.nodeId]!
    expect(guardCanonicalConfigImportBudgets({ target: 'page', page, registryLock: project.registryLock })[0]?.code)
      .toBe('IMPORT_NODE_LIMIT_EXCEEDED')
  })

  it('does not count identity-like keys inside opaque project metadata', async () => {
    const project = structuredClone(await currentProject())
    project.settings.nodesById = Object.fromEntries(Array.from(
      { length: MAX_IMPORT_NODES + 1 },
      (_, index) => [`metadata-${index}`, null],
    ))
    const result = await prepareConfigImport({ source: JSON.stringify(project), target: 'project' })
    expect(result.success).toBe(true)
  })

  it('rejects every unsafe key at any depth with an escaped stable path', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const value = JSON.parse(`{"safe-key":{"${key}":true}}`) as unknown
      expect(guardConfigImportValue(value)).toMatchObject([{
        code: 'IMPORT_UNSAFE_KEY',
        path: `$["safe-key"].${key}`,
      }])
    }
  })

  it('escapes dynamic Model segments in diagnostics', async () => {
    const project = structuredClone(await currentProject())
    const component = Object.keys(project.registryLock.components)[0]!
    project.registryLock.components[component]!.fingerprint = 42 as unknown as string
    expect(parseConfigImportPayload(project, 'project')).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_PROJECT_INVALID',
        path: `${appendConfigImportPath('$.registryLock.components', component)}.fingerprint`,
      }],
    })
  })

  it('escapes remapped page and node identities in compiler diagnostics', async () => {
    const project = await currentProject()
    const page = project.pagesById[project.homePageId]!
    const sourceNodeId = page.graph.root[0]!.nodeId
    const sourceNode = page.graph.nodesById[sourceNodeId]!
    page.graph.nodesById[sourceNodeId] = {
      id: sourceNode.id,
      component: sourceNode.component,
      kind: 'layout',
      props: structuredClone(sourceNode.props),
      events: structuredClone(sourceNode.events),
      bindings: structuredClone(sourceNode.bindings),
      slots: {},
    }
    const identityFactory: ProjectIdentityFactory = {
      create: (kind, source) => `${kind}.fresh.${source}`,
    }
    const result = await prepareConfigImport({
      identityFactory,
      source: JSON.stringify(project),
      target: 'project',
    })
    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'IMPORT_PREVIEW_COMPILE_FAILED',
        path: appendConfigImportPath(
          `${appendConfigImportPath('$.pagesById', `page.fresh.${page.id}`)}.graph.nodesById`,
          `node.fresh.${sourceNodeId}`,
        ),
      }],
    })
  })

  it('fails closed for obsolete, missing, future, and bare documents', async () => {
    const project = await currentProject()
    expect(parseConfigImportPayload(project, 'page')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_FORMAT_UNSUPPORTED', path: '$.kind' }],
    })
    expect(parseConfigImportPayload({ ...project, version: 3 }, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    expect(parseConfigImportPayload({ ...project, version: 99 }, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    const missing = structuredClone(project) as unknown as Record<string, unknown>
    delete missing.version
    expect(parseConfigImportPayload(missing, 'project')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
    expect(parseConfigImportPayload(project.pagesById[project.homePageId], 'page')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_FORMAT_UNSUPPORTED', path: '$.kind' }],
    })
    const transfer = pageTransfer(project, project.pagesById[project.homePageId]!)
    expect(parseConfigImportPayload({ ...transfer, version: 2 }, 'page')).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_VERSION_UNSUPPORTED', path: '$.version' }],
    })
  })

  it('prepares fresh project and page instances through the available Registry', async () => {
    const project = await currentProject()
    const projectResult = await prepareConfigImport({
      identityFactory: deterministicFactory(),
      source: JSON.stringify(project),
      target: 'project',
    })
    expect(projectResult.success).toBe(true)
    if (!projectResult.success)
      return
    expect(projectResult.prepared.target).toBe('project')
    if (projectResult.prepared.target !== 'project')
      return
    expect(projectResult.prepared.document.id).not.toBe(project.id)
    expect(projectResult.prepared.document.homePageId).not.toBe(project.homePageId)
    expect(projectResult.prepared.summary).toMatchObject({
      adapter: 'element-plus',
      nodeCount: 3,
      pageCount: 1,
      target: 'project',
    })

    const sourcePage = project.pagesById[project.homePageId]!
    const transfer = pageTransfer(project, sourcePage)
    const pageComponents = [...new Set(Object.values(sourcePage.graph.nodesById).map(node => node.component))]
      .sort((left, right) => left.localeCompare(right))
    expect(Object.keys(transfer.registryLock.components).sort((left, right) => left.localeCompare(right)))
      .toEqual(pageComponents)
    expect(Object.keys(project.registryLock.components).length).toBeGreaterThan(pageComponents.length)

    const pageResult = await prepareConfigImport({
      currentProject: project,
      identityFactory: deterministicFactory(),
      source: JSON.stringify(transfer),
      target: 'page',
    })
    expect(pageResult.success).toBe(true)
    if (!pageResult.success || pageResult.prepared.target !== 'page')
      return
    expect(pageResult.prepared.page.id).not.toBe(sourcePage.id)
    expect(pageResult.prepared.page.route).not.toBe(sourcePage.route)
    expect(pageResult.prepared.preview.compilation.page.id).toBe(pageResult.prepared.page.id)
  })

  it('rejects a Project lock that omits an unused active Registry component', async () => {
    const project = structuredClone(await currentProject())
    const usedComponents = new Set(Object.values(project.pagesById)
      .flatMap(page => Object.values(page.graph.nodesById).map(node => node.component)))
    const omittedComponent = Object.keys(project.registryLock.components)
      .find(component => !usedComponents.has(component))
    expect(omittedComponent).toBeDefined()
    if (!omittedComponent)
      return
    delete project.registryLock.components[omittedComponent]
    project.registryLock.fingerprint = registryLockFingerprint(project.registryLock.components)

    const result = await prepareConfigImport({
      identityFactory: deterministicFactory(),
      source: JSON.stringify(project),
      target: 'project',
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [expect.objectContaining({
        code: 'IMPORT_REGISTRY_INVALID',
        message: 'Project Registry lock must exactly match the active Registry.',
        path: '$.registryLock.components',
      })],
    })
  })

  it('rejects Registry component contract drift without converting the document', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const project = await currentProject()
    const sourceNode = Object.values(project.pagesById[project.homePageId]!.graph.nodesById)
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
      source: JSON.stringify(project),
      target: 'project',
    })
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'IMPORT_REGISTRY_INVALID',
        path: `${appendConfigImportPath('$.registryLock.components', sourceContract.key)}.contractVersion`,
      }),
    ]))
  })

  it('keeps fresh identities within the current 128-character identifier limit', async () => {
    const project = await currentProject()
    const sourcePage = structuredClone(project.pagesById[project.homePageId]!)
    const sourceNodeId = sourcePage.graph.root[0]!.nodeId
    const sourceNode = sourcePage.graph.nodesById[sourceNodeId]!
    const longNodeId = 'n'.repeat(128)
    delete sourcePage.graph.nodesById[sourceNodeId]
    sourceNode.id = longNodeId
    if (sourceNode.kind === 'field')
      sourceNode.field = 'f'.repeat(128)
    sourcePage.graph.nodesById[longNodeId] = sourceNode
    sourcePage.graph.root[0]!.nodeId = longNodeId
    sourcePage.id = 'p'.repeat(128)

    const result = await prepareConfigImport({
      currentProject: project,
      source: JSON.stringify(pageTransfer(project, sourcePage)),
      target: 'page',
    })
    expect(result.success).toBe(true)
    if (!result.success || result.prepared.target !== 'page')
      return
    expect(result.prepared.page.id.length).toBeLessThanOrEqual(128)
    Object.values(result.prepared.page.graph.nodesById).forEach((node) => {
      expect(node.id.length).toBeLessThanOrEqual(128)
      if (node.kind === 'field')
        expect(node.field.length).toBeLessThanOrEqual(128)
    })
  })

  it('normalizes adapter and identity failures into import diagnostics', async () => {
    const project = await currentProject()
    await expect(prepareConfigImport({
      loadAdapter: async () => { throw new Error('adapter load failed') },
      source: JSON.stringify(project),
      target: 'project',
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_REGISTRY_INVALID', path: '$' }],
    })
    await expect(prepareConfigImport({
      identityFactory: { create: () => 'duplicate' },
      source: JSON.stringify(project),
      target: 'project',
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'IMPORT_PROJECT_INVALID' }],
    })
  })

  it('reports page-only summary semantics without host project resources', async () => {
    const project = await currentProject()
    project.resources.asset = { id: 'asset', kind: 'image', uri: '/asset.png' }
    const sourcePage = project.pagesById[project.homePageId]!
    const result = await prepareConfigImport({
      currentProject: project,
      identityFactory: deterministicFactory(),
      source: JSON.stringify(pageTransfer(project, sourcePage)),
      target: 'page',
    })
    expect(result).toMatchObject({
      success: true,
      prepared: { summary: { pageCount: 1, resourceCount: 0, target: 'page' } },
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
      const home = source.pagesById[source.homePageId]!
      home.graph.props.roundTrip = metadata
      const result = await prepareConfigImport({
        identityFactory: deterministicFactory(),
        source: JSON.stringify(source),
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

  it('preserves semantic content across generated Page JSON round trips', async () => {
    const project = await currentProject()
    const basePage = project.pagesById[project.homePageId]!
    await fc.assert(fc.asyncProperty(fc.record({
      count: fc.integer(),
      enabled: fc.boolean(),
      label: fc.string({ maxLength: 40 }),
    }), async (metadata) => {
      const sourcePage = structuredClone(basePage)
      sourcePage.graph.props.roundTrip = metadata
      Object.values(sourcePage.graph.nodesById).forEach((node, index) => {
        node.props.roundTrip = { ...metadata, index }
      })
      const result = await prepareConfigImport({
        currentProject: project,
        identityFactory: deterministicFactory(),
        source: JSON.stringify(pageTransfer(project, sourcePage)),
        target: 'page',
      })
      expect(result.success).toBe(true)
      if (!result.success || result.prepared.target !== 'page')
        return

      const importedPage = JSON.parse(JSON.stringify(result.prepared.page)) as ProjectPage
      expect(normalizePageRoundTrip(
        importedPage,
        pageIdentityReverse(sourcePage, importedPage),
      )).toEqual(normalizePageRoundTrip(sourcePage))
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
