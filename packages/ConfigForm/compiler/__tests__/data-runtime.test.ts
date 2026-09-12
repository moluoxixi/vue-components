import type {
  ComponentContract,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import {
  applyProjectTransaction,
  createComponentContractRegistry,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  compileCanonicalPage,
  compileCanonicalProject,
  createCompileCoordinator,
} from '../index'

const contracts: ComponentContract[] = [
  {
    key: 'layout.scope',
    version: '1',
    kind: 'layout',
    props: [],
    events: [],
    bindings: [],
    slots: [{ name: 'default', accepts: ['field', 'layout'] }],
    allowedParents: [],
    defaults: {},
  },
  {
    key: 'field.input',
    version: '1',
    kind: 'field',
    props: [],
    events: [],
    bindings: [],
    slots: [],
    allowedParents: [],
    defaults: {},
  },
]

function fixture() {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'runtime-test',
    version: '1',
  })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'runtime-compiler',
    name: 'Runtime compiler',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: {
      home: {
        id: 'home',
        name: 'Home',
        route: '/',
        runtime: {
          variables: [{ id: 'tenant', name: 'Tenant', initialValue: 'acme' }],
          dataSources: [{
            id: 'catalog',
            name: 'Catalog',
            request: {
              url: '/api/catalog',
              query: { tenant: { $ref: { kind: 'variable', variableId: 'tenant' } } },
            },
          }],
        },
        graph: {
          version: 2,
          props: {},
          form: {},
          root: [
            { nodeId: 'items', placement: {} },
            { nodeId: 'country', placement: {} },
          ],
          nodesById: {
            items: {
              id: 'items',
              component: 'layout.scope',
              kind: 'layout',
              valueScope: {
                kind: 'array',
                field: 'orders',
                itemKey: 'id',
                minItems: 1,
                maxItems: 20,
              },
              props: {},
              events: {},
              bindings: {},
              slots: {
                default: [
                  { nodeId: 'sku', placement: {} },
                  { nodeId: 'address', placement: {} },
                ],
              },
            },
            sku: {
              id: 'sku',
              component: 'field.input',
              kind: 'field',
              field: 'sku',
              defaultValue: '',
              props: {},
              events: {},
              bindings: {},
            },
            address: {
              id: 'address',
              component: 'layout.scope',
              kind: 'layout',
              valueScope: { kind: 'object', field: 'address' },
              props: {},
              events: {},
              bindings: {},
              slots: { default: [{ nodeId: 'city', placement: {} }] },
            },
            city: {
              id: 'city',
              component: 'field.input',
              kind: 'field',
              field: 'city',
              props: {},
              events: {},
              bindings: {},
            },
            country: {
              id: 'country',
              component: 'field.input',
              kind: 'field',
              field: 'country',
              optionSource: {
                kind: 'dataSource',
                dataSourceId: 'catalog',
                params: { tenant: { $ref: { kind: 'variable', variableId: 'tenant' } } },
              },
              props: {},
              events: {},
              bindings: {},
            },
          },
        },
      },
    },
    registryLock: structuredClone(registry.lock),
    settings: {},
    resources: {},
  }
  return {
    contractRegistry: registry,
    registry: createRegistryContractSnapshot(registry),
    snapshot: createProjectSnapshot(document, 1),
  }
}

describe('canonical data runtime compilation', () => {
  it('carries runtime and node declarations while deriving containment-owned scope metadata', () => {
    const input = fixture()
    const result = compileCanonicalProject(input)

    expect(result.success).toBe(true)
    if (!result.success)
      return
    const page = result.compilation.ir.pagesById.home!
    expect(page.runtime).toEqual(input.snapshot.document.pagesById.home!.runtime)
    expect(page.valueScopes).toEqual([
      {
        nodeId: 'items',
        field: 'orders',
        kind: 'array',
        itemKey: 'id',
        minItems: 1,
        maxItems: 20,
      },
      { nodeId: 'address', field: 'address', parentId: 'items', kind: 'object' },
    ])
    expect(page.scopedFields).toEqual([
      { nodeId: 'sku', field: 'sku', scopeId: 'items', defaultValue: '' },
      { nodeId: 'city', field: 'city', scopeId: 'address' },
      { nodeId: 'country', field: 'country' },
    ])
    expect(page.nodesById.items).toMatchObject({
      valueScope: { kind: 'array', field: 'orders', itemKey: 'id', minItems: 1, maxItems: 20 },
    })
    expect(page.nodesById.address).toMatchObject({
      valueScope: { kind: 'object', field: 'address' },
    })
    expect(page.nodesById.country).toMatchObject({
      optionSource: {
        kind: 'dataSource',
        dataSourceId: 'catalog',
        params: { tenant: { $ref: { kind: 'variable', variableId: 'tenant' } } },
      },
    })
    expect(Object.isFrozen(page.runtime)).toBe(true)
    expect(Object.isFrozen(page.valueScopes)).toBe(true)
  })

  it('keeps optional runtime, optionSource, and valueScope absent instead of inventing defaults', () => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    delete document.pagesById.home!.runtime
    const items = document.pagesById.home!.graph.nodesById.items!
    const country = document.pagesById.home!.graph.nodesById.country!
    if (items.kind === 'layout')
      delete items.valueScope
    if (country.kind === 'field')
      delete country.optionSource
    const result = compileCanonicalPage({
      snapshot: createProjectSnapshot(document, 2),
      registry: input.registry,
      pageId: 'home',
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.compilation.page).not.toHaveProperty('runtime')
    expect(result.compilation.page.nodesById.items).not.toHaveProperty('valueScope')
    expect(result.compilation.page.nodesById.country).not.toHaveProperty('optionSource')
    expect(result.compilation.page.valueScopes).toEqual([
      { nodeId: 'address', field: 'address', kind: 'object' },
    ])
  })

  it('includes runtime and option-source semantics in page and project hashes', () => {
    const baseline = fixture()
    const runtimeDocument = structuredClone(baseline.snapshot.document) as ProjectDocument
    runtimeDocument.pagesById.home!.runtime!.variables[0]!.initialValue = 'other'
    const optionDocument = structuredClone(baseline.snapshot.document) as ProjectDocument
    const country = optionDocument.pagesById.home!.graph.nodesById.country!
    if (country.kind === 'field')
      country.optionSource!.params = { tenant: 'fixed' }

    const basePage = compileCanonicalPage({ ...baseline, pageId: 'home' })
    const runtimePage = compileCanonicalPage({
      snapshot: createProjectSnapshot(runtimeDocument, 2),
      registry: baseline.registry,
      pageId: 'home',
    })
    const optionPage = compileCanonicalPage({
      snapshot: createProjectSnapshot(optionDocument, 2),
      registry: baseline.registry,
      pageId: 'home',
    })
    const baseProject = compileCanonicalProject(baseline)
    const runtimeProject = compileCanonicalProject({
      snapshot: createProjectSnapshot(runtimeDocument, 2),
      registry: baseline.registry,
    })

    expect(basePage.success && runtimePage.success && optionPage.success).toBe(true)
    expect(baseProject.success && runtimeProject.success).toBe(true)
    if (!basePage.success || !runtimePage.success || !optionPage.success
      || !baseProject.success || !runtimeProject.success) {
      return
    }
    expect(runtimePage.compilation.key.semanticHash).not.toBe(basePage.compilation.key.semanticHash)
    expect(optionPage.compilation.key.semanticHash).not.toBe(basePage.compilation.key.semanticHash)
    expect(optionPage.compilation.page.nodesById.country?.subtreeHash)
      .not
      .toBe(basePage.compilation.page.nodesById.country?.subtreeHash)
    expect(runtimeProject.compilation.key.irHash).not.toBe(baseProject.compilation.key.irHash)
  })

  it('invalidates runtime and derived scope caches while retaining proven-unchanged node IR', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return

    const runtime = structuredClone(input.snapshot.document.pagesById.home!.runtime!) as NonNullable<ProjectDocument['pagesById'][string]['runtime']>
    runtime.variables[0]!.initialValue = 'next'
    const runtimeChange = applyProjectTransaction(input.snapshot.document as ProjectDocument, {
      id: 'runtime-change',
      label: 'Runtime change',
      operations: [{ type: 'page.runtime', pageId: 'home', runtime }],
    })
    expect(runtimeChange.success && runtimeChange.changed).toBe(true)
    if (!runtimeChange.success || !runtimeChange.changed)
      return
    const runtimeSnapshot = createProjectSnapshot(runtimeChange.document, 2)
    coordinator.acceptSnapshot(runtimeSnapshot, {
      project: runtimeChange.changedProject,
      pageIds: runtimeChange.changedPageIds,
      nodeIds: runtimeChange.changedNodeIds,
      nodeChanges: runtimeChange.changedNodeChanges,
    })
    const afterRuntime = coordinator.compilePage('home')
    expect(afterRuntime.success).toBe(true)
    if (!afterRuntime.success)
      return
    expect(afterRuntime.compilation.page.runtime!.variables[0]!.initialValue).toBe('next')
    expect(afterRuntime.compilation.key.semanticHash).not.toBe(before.compilation.key.semanticHash)
    expect(afterRuntime.compilation.page.nodesById.items).toBe(before.compilation.page.nodesById.items)
    expect(afterRuntime.compilation.page.valueScopes).toBe(before.compilation.page.valueScopes)

    const scopeChange = applyProjectTransaction(runtimeSnapshot.document as ProjectDocument, {
      id: 'scope-change',
      label: 'Scope change',
      operations: [{
        type: 'node.settings',
        pageId: 'home',
        nodeId: 'items',
        settings: {
          kind: 'layout',
          component: 'layout.scope',
          valueScope: {
            kind: 'array',
            field: 'lineItems',
            itemKey: 'id',
            minItems: 1,
            maxItems: 20,
          },
        },
      }],
    })
    expect(scopeChange.success && scopeChange.changed).toBe(true)
    if (!scopeChange.success || !scopeChange.changed)
      return
    const scopeSnapshot = createProjectSnapshot(scopeChange.document, 3)
    coordinator.acceptSnapshot(scopeSnapshot, {
      project: scopeChange.changedProject,
      pageIds: scopeChange.changedPageIds,
      nodeIds: scopeChange.changedNodeIds,
      nodeChanges: scopeChange.changedNodeChanges,
    })
    const afterScope = coordinator.compilePage('home')
    expect(afterScope.success).toBe(true)
    if (!afterScope.success)
      return
    expect(afterScope.compilation.page.valueScopes[0]).toMatchObject({ field: 'lineItems' })
    expect(afterScope.compilation.page.valueScopes).not.toBe(afterRuntime.compilation.page.valueScopes)
    expect(afterScope.compilation.page.nodesById.items).not.toBe(afterRuntime.compilation.page.nodesById.items)
    expect(afterScope.compilation.key.semanticHash).not.toBe(afterRuntime.compilation.key.semanticHash)
  })
})
