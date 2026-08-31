import type {
  ComponentContract,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import {
  CONFIG_FORM_FLOW_VERSION,
} from '@moluoxixi/config-form-core'
import {
  applyProjectTransaction,
  createComponentContractRegistry,
  createProjectDraftSnapshot,
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
    key: 'element.input',
    version: '2',
    kind: 'field',
    props: [
      { key: 'clearable', path: ['props', 'clearable'] },
      { key: 'placeholder', path: ['props', 'placeholder'] },
    ],
    events: [{ name: 'change' }],
    bindings: [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    slots: [],
    allowedParents: [],
    defaults: { clearable: true, placeholder: 'Default placeholder' },
  },
  {
    key: 'layout.section',
    version: '1',
    kind: 'layout',
    props: [],
    events: [],
    bindings: [],
    slots: [{ name: 'default', accepts: ['field', 'layout'] }],
    allowedParents: [],
    defaults: { gap: 12 },
  },
]

function fixture() {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'element-plus',
    version: '2.9.1',
  })
  const project: ProjectDocument = {
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: {
      home: {
        id: 'home',
        name: 'Home',
        route: '/',
        flows: [{
          version: CONFIG_FORM_FLOW_VERSION,
          id: 'mounted',
          name: 'Mounted',
          trigger: { kind: 'page.mount' },
          nodes: [
            { id: 'trigger', type: 'trigger', position: { x: 10, y: 20 } },
            { id: 'success', type: 'success', position: { x: 200, y: 20 } },
          ],
          edges: [{ id: 'edge', source: 'trigger', target: 'success' }],
        }],
        graph: {
          version: 2,
          props: { title: 'Profile' },
          form: { columns: 24 },
          root: [{ nodeId: 'section', placement: {} }],
          nodesById: {
            section: {
              id: 'section',
              component: 'layout.section',
              kind: 'layout',
              props: {},
              events: {},
              bindings: {},
              slots: { default: [{ nodeId: 'name', placement: { span: 12 } }] },
            },
            name: {
              id: 'name',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              label: 'Name',
              props: { placeholder: 'Your name' },
              events: { change: [{ action: 'track' }] },
              bindings: { model: { source: 'profile.name' } },
            },
          },
        },
      },
    },
    registryLock: structuredClone(registry.lock),
    settings: { locale: 'zh-CN' },
    resources: {},
  }
  return {
    snapshot: createProjectSnapshot(project, 4),
    registry: createRegistryContractSnapshot(registry),
  }
}

function updateSnapshot(
  input: ReturnType<typeof fixture>,
  update: (document: ProjectDocument) => void,
): void {
  const document = structuredClone(input.snapshot.document) as ProjectDocument
  update(document)
  input.snapshot = createProjectSnapshot(document, input.snapshot.editVersion)
}

function addPage(document: ProjectDocument, sourceId: string, pageId: string): void {
  const source = document.pagesById[sourceId]!
  document.pageOrder.push(pageId)
  document.pagesById[pageId] = {
    ...structuredClone(source),
    id: pageId,
    name: pageId,
    route: `/${pageId}`,
  }
}

describe('canonical project compiler', () => {
  it('compiles one deterministic immutable IR for runtime and source backends', () => {
    const input = fixture()
    const result = compileCanonicalProject(input)

    expect(result.success).toBe(true)
    if (!result.success)
      return
    const { compilation } = result
    const page = compilation.ir.pagesById.home!
    expect(page.nodesById.section).toMatchObject({
      component: 'layout.section',
      props: { gap: 12 },
      placement: { parentId: null, slot: null, props: {} },
      subtreeHash: expect.any(String),
      slots: { default: ['name'] },
    })
    expect(page.nodesById.name).toMatchObject({
      component: 'element.input',
      componentVersion: '2',
      configuredProps: { placeholder: 'Your name' },
      props: { clearable: true, placeholder: 'Your name' },
      placement: { parentId: 'section', slot: 'default', props: { span: 12 } },
      subtreeHash: expect.any(String),
    })
    expect(page.flows[0]?.plan).toMatchObject({
      flowId: 'mounted',
      trigger: { kind: 'page.mount' },
      topologicalOrder: ['trigger', 'success'],
    })
    expect(page.flows[0]?.plan).not.toHaveProperty('revision')
    expect(page.flows[0]?.plan.nodes[0]).not.toHaveProperty('position')
    expect(compilation.key).toBe(compilation.ir.identity)
    expect(compilation.key.contentHash).toBe(input.snapshot.contentHash)
    expect(compilation.key.registryFingerprint).toBe(compilation.registry.fingerprint)
    expect(Object.isFrozen(compilation)).toBe(true)
    expect(Object.isFrozen(compilation.ir)).toBe(true)
    expect(Object.isFrozen(page.nodesById.name?.props)).toBe(true)

    const repeated = compileCanonicalProject(structuredClone(input))
    expect(repeated).toEqual(result)
  })

  it('compiles component event triggers against the same page Registry contract', () => {
    const input = fixture()
    updateSnapshot(input, (document) => {
      document.pagesById.home!.flows![0]!.trigger = {
        kind: 'component.event',
        nodeId: 'name',
        event: 'change',
      }
    })

    const result = compileCanonicalProject(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.compilation.ir.pagesById.home?.flows[0]?.plan.trigger).toEqual({
        kind: 'component.event',
        nodeId: 'name',
        event: 'change',
      })
      expect(result.compilation.ir.pagesById.home?.nodesById.name?.flowEvents).toEqual(['change'])
    }

    updateSnapshot(input, (document) => {
      document.pagesById.home!.flows![0]!.trigger = {
        kind: 'component.event',
        nodeId: 'name',
        event: 'hover',
      }
    })
    expect(compileCanonicalProject(input)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'COMPILER_FLOW_TRIGGER_EVENT_UNKNOWN', nodeId: 'name' }],
    })
  })

  it('keeps editor-only flow positions out of runtime IR identity', () => {
    const first = fixture()
    const second = fixture()
    updateSnapshot(second, (document) => {
      document.pagesById.home!.flows![0]!.nodes[0]!.position = { x: 999, y: 999 }
    })

    const left = compileCanonicalProject(first)
    const right = compileCanonicalProject(second)
    expect(left.success && right.success).toBe(true)
    if (!left.success || !right.success)
      return
    expect(left.compilation.ir.identity.contentHash).not.toBe(right.compilation.ir.identity.contentHash)
    expect(left.compilation.ir.identity.irHash).toBe(right.compilation.ir.identity.irHash)
  })

  it('compiles transient design drafts without publishing a committed edit version', () => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.pagesById.home!.graph.nodesById.name!.props.placeholder = 'Draft placeholder'
    const draft = createProjectDraftSnapshot(input.snapshot, document, 'drag-candidate')

    const result = compileCanonicalProject({ ...input, snapshot: draft })
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.compilation.snapshot).toEqual(draft)
    expect(result.compilation.key).toMatchObject({ contentHash: draft.draftHash })
    expect(result.compilation.origin).toEqual({
      kind: 'draft',
      baseEditVersion: input.snapshot.editVersion,
      draftId: 'drag-candidate',
    })
    expect(result.compilation.ir.pagesById.home?.nodesById.name?.props).toMatchObject({
      placeholder: 'Draft placeholder',
    })
  })

  it('keeps semantic compilation identity independent from editor chronology', () => {
    const first = fixture()
    const second = fixture()
    second.snapshot = createProjectSnapshot(second.snapshot.document, 99)

    const left = compileCanonicalProject(first)
    const right = compileCanonicalProject(second)
    expect(left.success && right.success).toBe(true)
    if (!left.success || !right.success)
      return

    expect(left.compilation.key).toEqual(right.compilation.key)
    expect(left.compilation.ir).toEqual(right.compilation.ir)
    expect(left.compilation.origin).toEqual({ kind: 'committed', editVersion: 4 })
    expect(right.compilation.origin).toEqual({ kind: 'committed', editVersion: 99 })
  })

  it('scopes page compilation identity to page semantics and used contracts', () => {
    const first = fixture()
    const second = fixture()
    updateSnapshot(second, (document) => {
      addPage(document, 'home', 'settings')
      document.pagesById.settings!.name = 'Changed elsewhere'
      document.pagesById.home!.flows![0]!.nodes[0]!.position = { x: 500, y: 500 }
    })

    const expandedRegistry = createComponentContractRegistry([
      ...contracts,
      {
        key: 'element.unused',
        version: '99',
        kind: 'field',
        props: [],
        events: [],
        bindings: [],
        slots: [],
        allowedParents: [],
        defaults: { changed: true },
      },
    ], { adapter: 'element-plus', version: '2.9.1' })

    const left = compileCanonicalPage({ ...first, pageId: 'home' })
    const right = compileCanonicalPage({
      snapshot: second.snapshot,
      registry: createRegistryContractSnapshot(expandedRegistry),
      pageId: 'home',
    })
    expect(left.success && right.success).toBe(true)
    if (!left.success || !right.success)
      return
    expect(left.compilation.key).toEqual(right.compilation.key)
    expect(left.compilation.snapshotIdentity.contentHash)
      .not
      .toBe(right.compilation.snapshotIdentity.contentHash)
    expect(left.compilation.registryUsage.map(item => item.key)).toEqual([
      'element.input',
      'layout.section',
    ])
    expect(Object.isFrozen(left.compilation)).toBe(true)
    expect(Object.isFrozen(left.compilation.page)).toBe(true)
  })

  it('invalidates page keys for page semantics, used contracts, and structural environment', () => {
    const baseline = fixture()
    const pageChange = fixture()
    updateSnapshot(pageChange, (document) => {
      document.pagesById.home!.graph.nodesById.name!.props.placeholder = 'Changed'
    })
    const changedContracts = structuredClone(contracts)
    changedContracts[0]!.defaults.clearable = false
    const changedRegistry = createComponentContractRegistry(changedContracts, {
      adapter: 'element-plus',
      version: '2.9.1',
    })
    const contractChange = fixture()
    contractChange.snapshot = createProjectSnapshot({
      ...structuredClone(contractChange.snapshot.document),
      registryLock: structuredClone(changedRegistry.lock),
    }, 5)

    const base = compileCanonicalPage({ ...baseline, pageId: 'home' })
    const page = compileCanonicalPage({ ...pageChange, pageId: 'home' })
    const contract = compileCanonicalPage({
      snapshot: contractChange.snapshot,
      registry: createRegistryContractSnapshot(changedRegistry),
      pageId: 'home',
    })
    const environment = compileCanonicalPage({
      ...baseline,
      environment: { version: '2', features: { nestedSlots: true } },
      pageId: 'home',
    })
    expect(base.success && page.success && contract.success && environment.success).toBe(true)
    if (!base.success || !page.success || !contract.success || !environment.success)
      return
    expect(page.compilation.key.semanticHash).not.toBe(base.compilation.key.semanticHash)
    expect(contract.compilation.key.registryUsageHash).not.toBe(base.compilation.key.registryUsageHash)
    expect(environment.compilation.key.environmentHash).not.toBe(base.compilation.key.environmentHash)
  })

  it('coordinates committed pages without recompiling unaffected page programs', () => {
    const input = fixture()
    const initialDocument = structuredClone(input.snapshot.document) as ProjectDocument
    addPage(initialDocument, 'home', 'billing')
    addPage(initialDocument, 'home', 'settings')
    const initial = createProjectSnapshot(initialDocument, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry, maxCachedPages: 8 })
    coordinator.acceptSnapshot(initial)

    const home = coordinator.compilePage('home')
    const settings = coordinator.compilePage('settings')
    expect(home.success && settings.success).toBe(true)
    if (!home.success || !settings.success)
      return

    const nextDocument = structuredClone(initial.document) as ProjectDocument
    nextDocument.pagesById.billing!.graph.nodesById.name!.props.placeholder = 'Billing changed'
    const next = createProjectSnapshot(nextDocument, 2)
    coordinator.acceptSnapshot(next, {
      project: false,
      pageIds: ['billing'],
      nodeIds: ['name'],
      nodeChanges: [{ kind: 'content', pageId: 'billing', nodeId: 'name' }],
    })

    const reboundHome = coordinator.compilePage('home')
    const reboundSettings = coordinator.compilePage('settings')
    expect(reboundHome.success && reboundSettings.success).toBe(true)
    if (!reboundHome.success || !reboundSettings.success)
      return
    expect(reboundHome.compilation.page).toBe(home.compilation.page)
    expect(reboundHome.compilation.key).toBe(home.compilation.key)
    expect(reboundSettings.compilation.page).toBe(settings.compilation.page)
    expect(reboundSettings.compilation.key).toBe(settings.compilation.key)
    expect(reboundHome.compilation.snapshotIdentity).toMatchObject({
      source: 'committed',
      editVersion: 2,
      contentHash: next.contentHash,
    })
  })

  it('recompiles only the changed node and its semantic ancestors', () => {
    const input = fixture()
    const initialDocument = structuredClone(input.snapshot.document) as ProjectDocument
    initialDocument.pagesById.home!.graph.nodesById.other = {
      id: 'other',
      component: 'element.input',
      kind: 'field',
      field: 'other',
      props: { placeholder: 'Unchanged' },
      events: {},
      bindings: {},
    }
    const section = initialDocument.pagesById.home!.graph.nodesById.section!
    if (section.kind !== 'layout')
      throw new TypeError('Expected section layout fixture.')
    section.slots.default!.push({ nodeId: 'other', placement: { span: 12 } })
    const initial = createProjectSnapshot(initialDocument, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(initial)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return

    const applied = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'edit-name',
      label: 'Edit name',
      operations: [{
        type: 'node.props',
        pageId: 'home',
        nodeId: 'name',
        props: { placeholder: 'Changed' },
      }],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success || !applied.changed)
      return
    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    })
    const after = coordinator.compilePage('home')
    expect(after.success).toBe(true)
    if (!after.success)
      return

    expect(after.compilation.page.nodesById.name).not.toBe(before.compilation.page.nodesById.name)
    expect(after.compilation.page.nodesById.section).not.toBe(before.compilation.page.nodesById.section)
    expect(after.compilation.page.nodesById.other).toBe(before.compilation.page.nodesById.other)
    expect(after.compilation.page.nodesById.name?.props.placeholder).toBe('Changed')
  })

  it('updates only moved nodes and affected containers for structural changes', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return

    const applied = applyProjectTransaction(input.snapshot.document as ProjectDocument, {
      id: 'move-name-root',
      label: 'Move name to root',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'name',
        target: { parentId: null, index: 1 },
      }],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success || !applied.changed)
      return
    expect(applied.changedNodeChanges).toEqual(expect.arrayContaining([
      {
        kind: 'move',
        pageId: 'home',
        nodeId: 'name',
        before: { parentId: 'section', slot: 'default' },
        after: { parentId: null, slot: null },
      },
      { kind: 'content', pageId: 'home', nodeId: 'section' },
    ]))

    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    })
    const after = coordinator.compilePage('home')
    expect(after.success).toBe(true)
    if (!after.success)
      return
    expect(after.compilation.page.rootIds).toEqual(['section', 'name'])
    expect(after.compilation.page.nodesById.name?.placement).toMatchObject({ parentId: null, slot: null })
    expect(after.compilation.page.nodesById.section).toMatchObject({ slots: { default: [] } })
  })

  it('invalidates the exact Runtime node when a Flow component event target changes', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return
    const mutableDocument = structuredClone(input.snapshot.document) as ProjectDocument
    const flow = mutableDocument.pagesById.home!.flows![0]!
    flow.trigger = { kind: 'component.event', nodeId: 'name', event: 'change' }
    const applied = applyProjectTransaction(input.snapshot.document as ProjectDocument, {
      id: 'change-flow-trigger',
      label: 'Change flow trigger',
      operations: [{ type: 'flow.update', pageId: 'home', flowId: flow.id, flow }],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success || !applied.changed)
      return
    expect(applied.changedNodeChanges).toContainEqual({
      kind: 'content',
      pageId: 'home',
      nodeId: 'name',
    })
    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    })
    const after = coordinator.compilePage('home')
    expect(after.success).toBe(true)
    if (!after.success)
      return
    expect(after.compilation.page.nodesById.name?.flowEvents).toEqual(['change'])
    expect(after.compilation.page.nodesById.name).not.toBe(before.compilation.page.nodesById.name)
  })

  it('keeps draft page programs isolated from the committed page cache', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const committed = coordinator.compilePage('home')
    expect(committed.success).toBe(true)
    if (!committed.success)
      return

    const draftDocument = structuredClone(input.snapshot.document) as ProjectDocument
    draftDocument.pagesById.home!.graph.nodesById.name!.props.placeholder = 'Draft only'
    const draft = createProjectDraftSnapshot(input.snapshot, draftDocument, 'candidate')
    const candidate = coordinator.compileDraftPage(draft, 'home')
    const after = coordinator.compilePage('home')
    expect(candidate.success && after.success).toBe(true)
    if (!candidate.success || !after.success)
      return
    expect(candidate.compilation.page.nodesById.name?.props.placeholder).toBe('Draft only')
    expect(after.compilation.page).toBe(committed.compilation.page)
    expect(after.compilation.page.nodesById.name?.props.placeholder).toBe('Your name')
  })

  it('falls back to conservative invalidation for an unattributed change set', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const initial = coordinator.compilePage('home')
    expect(initial.success).toBe(true)

    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.pagesById.home!.graph.nodesById.name!.props.placeholder = 'Must recompile'
    const next = createProjectSnapshot(document, input.snapshot.editVersion + 1)
    coordinator.acceptSnapshot(next, {
      project: false,
      pageIds: [],
      nodeIds: ['name'],
      nodeChanges: [{ kind: 'content', pageId: 'home', nodeId: 'name' }],
    })
    const compiled = coordinator.compilePage('home')
    expect(compiled.success).toBe(true)
    if (!compiled.success)
      return
    expect(compiled.compilation.page.nodesById.name?.props.placeholder).toBe('Must recompile')
  })

  it('fails closed when a used component contract identity diverges', () => {
    const input = fixture()
    updateSnapshot(input, (document) => {
      document.registryLock.components['element.input'] = {
        ...document.registryLock.components['element.input']!,
        fingerprint: 'fnv1a:00000000',
      }
    })

    expect(compileCanonicalProject(input)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'COMPILER_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH' }],
    })
  })

  it('ignores changes to unused registry components', () => {
    const input = fixture()
    const expanded = createComponentContractRegistry([
      ...contracts,
      {
        key: 'element.unused',
        version: '99',
        kind: 'field',
        props: [],
        events: [],
        bindings: [],
        slots: [],
        allowedParents: [],
        defaults: { changed: true },
      },
    ], { adapter: 'element-plus', version: '3.0.0' })

    expect(compileCanonicalProject({
      snapshot: input.snapshot,
      registry: createRegistryContractSnapshot(expanded),
    }).success).toBe(true)
  })

  it('reports components missing from the frozen registry snapshot', () => {
    const input = fixture()
    updateSnapshot(input, (document) => {
      document.pagesById.home!.graph.nodesById.name!.component = 'element.missing'
      document.registryLock.components['element.missing'] = {
        contractVersion: '1',
        fingerprint: 'fnv1a:missing',
      }
    })

    expect(compileCanonicalProject(input)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'COMPILER_COMPONENT_UNKNOWN', nodeId: 'name' }],
    })
  })
})
