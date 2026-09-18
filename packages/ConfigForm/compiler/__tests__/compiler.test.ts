import type {
  ComponentContract,
  ProjectDocument,
  ProjectOperation,
} from '@moluoxixi/config-form-model'
import {
  applyProjectTransaction,
  createComponentContractRegistry,
  createProjectDraftSnapshot,
  createProjectDraftSnapshotFromTransaction,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PAGE_GRAPH_VERSION,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_PROJECT_IR_VERSION,
  compileCanonicalPage,
  compileCanonicalProject,
  CONFIG_FORM_COMPILER_VERSION,
  createCompileCoordinator,
} from '../index'

interface LegacyCompilerSnapshot {
  document: {
    pagesById: Record<string, {
      flows?: unknown[]
      graph: { nodesById: Record<string, { events?: Record<string, unknown> }> }
    }>
  }
}

const contracts: ComponentContract[] = [
  {
    key: 'element.input',
    version: '2',
    kind: 'field',
    props: [
      { key: 'clearable', path: ['props', 'clearable'] },
      { key: 'placeholder', path: ['props', 'placeholder'] },
    ],
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
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: {
      home: {
        id: 'home',
        name: 'Home',
        route: '/',
        graph: {
          version: PAGE_GRAPH_VERSION,
          props: { title: 'Profile' },
          form: { columns: 24 },
          root: [{ nodeId: 'section', placement: {} }],
          nodesById: {
            section: {
              id: 'section',
              component: 'layout.section',
              kind: 'layout',
              props: {},
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
    expect(compilation.ir.version).toBe(CANONICAL_PROJECT_IR_VERSION)
    expect(compilation.key.compilerVersion).toBe(CONFIG_FORM_COMPILER_VERSION)
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
    expect(page).not.toHaveProperty('flows')
    expect(page.nodesById.name).not.toHaveProperty('events')
    expect(page.nodesById.name).not.toHaveProperty('flowEvents')
    expect(compilation.key).toBe(compilation.ir.identity)
    expect(compilation.key.contentHash).toBe(input.snapshot.contentHash)
    expect(compilation.key.registryFingerprint).toBe(compilation.registry.fingerprint)
    expect(Object.isFrozen(compilation)).toBe(true)
    expect(Object.isFrozen(compilation.ir)).toBe(true)
    expect(Object.isFrozen(page.nodesById.name?.props)).toBe(true)

    const repeated = compileCanonicalProject(structuredClone(input))
    expect(repeated).toEqual(result)
  })

  it('rejects legacy event and Flow fields at the compiler ingress', () => {
    const input = fixture()
    const nodeEvents = structuredClone(input.snapshot) as unknown as LegacyCompilerSnapshot
    nodeEvents.document.pagesById.home!.graph.nodesById.name!.events = {}
    expect(compileCanonicalProject({ ...input, snapshot: nodeEvents }).success).toBe(false)

    const pageFlows = structuredClone(input.snapshot) as unknown as LegacyCompilerSnapshot
    pageFlows.document.pagesById.home!.flows = []
    expect(compileCanonicalProject({ ...input, snapshot: pageFlows }).success).toBe(false)
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
    })

    const expandedRegistry = createComponentContractRegistry([
      ...contracts,
      {
        key: 'element.unused',
        version: '99',
        kind: 'field',
        props: [],
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

  it('evicts the least recently used page program at the configured cache limit', () => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    addPage(document, 'home', 'billing')
    addPage(document, 'home', 'settings')
    const snapshot = createProjectSnapshot(document, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry, maxCachedPages: 2 })
    coordinator.acceptSnapshot(snapshot)

    const firstHome = coordinator.compilePage('home')
    const firstBilling = coordinator.compilePage('billing')
    const touchedHome = coordinator.compilePage('home')
    const settings = coordinator.compilePage('settings')
    const retainedHome = coordinator.compilePage('home')
    const secondBilling = coordinator.compilePage('billing')
    expect(firstHome.success && firstBilling.success && touchedHome.success
      && settings.success && retainedHome.success && secondBilling.success).toBe(true)
    if (!firstHome.success || !firstBilling.success || !touchedHome.success
      || !settings.success || !retainedHome.success || !secondBilling.success) {
      return
    }
    expect(touchedHome.compilation.page).toBe(firstHome.compilation.page)
    expect(retainedHome.compilation.page).toBe(firstHome.compilation.page)
    expect(secondBilling.compilation.page).not.toBe(firstBilling.compilation.page)
    expect(() => createCompileCoordinator({ registry: input.registry, maxCachedPages: 0 }))
      .toThrow('CompileCoordinator maxCachedPages must be a positive integer.')
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
    const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId: 'home' })
    expect(full.success).toBe(true)
    if (full.success)
      expect(after.compilation.page).toEqual(full.compilation.page)
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

  it('reuses canonical nodes for a root reorder while invalidating page identity', () => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.pagesById.home!.graph.nodesById.other = {
      id: 'other',
      component: 'element.input',
      kind: 'field',
      field: 'other',
      props: {},
      bindings: {},
    }
    document.pagesById.home!.graph.root.push({ nodeId: 'other', placement: {} })
    const initial = createProjectSnapshot(document, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(initial)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return

    const applied = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'reorder-roots',
      label: 'Reorder roots',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'section',
        target: { parentId: null, index: 1 },
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

    expect(after.compilation.page.rootIds).toEqual(['other', 'section'])
    expect(after.compilation.page.nodesById).toBe(before.compilation.page.nodesById)
    expect(after.compilation.registryUsage).toBe(before.compilation.registryUsage)
    expect(after.compilation.key.semanticHash).not.toBe(before.compilation.key.semanticHash)
    const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId: 'home' })
    expect(full.success).toBe(true)
    if (full.success)
      expect(after.compilation.page).toEqual(full.compilation.page)
  })

  it.each([
    { location: 'root', editFirst: true },
    { location: 'root', editFirst: false },
    { location: 'nested', editFirst: true },
    { location: 'nested', editFirst: false },
    { location: 'scoped', editFirst: true },
    { location: 'scoped', editFirst: false },
    { location: 'scoped-reorder', editFirst: true },
    { location: 'scoped-reorder', editFirst: false },
  ])('matches full compilation for combined content edits and moves ($location, editFirst=$editFirst)', ({ location, editFirst }) => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    const graph = document.pagesById.home!.graph
    const section = graph.nodesById.section!
    if (section.kind !== 'layout')
      throw new TypeError('Expected section layout fixture.')
    graph.nodesById.other = {
      id: 'other',
      component: 'element.input',
      kind: 'field',
      field: 'other',
      props: {},
      bindings: {},
    }
    if (location === 'root') {
      section.slots.default = []
      graph.root = ['name', 'other', 'section'].map(nodeId => ({ nodeId, placement: {} }))
    }
    else {
      section.slots.default!.push({ nodeId: 'other', placement: {} })
      if (location === 'scoped' || location === 'scoped-reorder')
        section.valueScope = { kind: 'object', field: 'profile' }
    }
    const initial = createProjectSnapshot(document, 1)
    const original = structuredClone(initial.document)
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(initial)
    const before = coordinator.compilePage('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return
    const edit: ProjectOperation = {
      type: 'node.props',
      pageId: 'home',
      nodeId: 'name',
      props: { placeholder: 'Changed and moved' },
    }
    const move: ProjectOperation = {
      type: 'node.move',
      pageId: 'home',
      nodeId: 'name',
      target: { parentId: location === 'nested' || location === 'scoped-reorder' ? 'section' : null, index: 1 },
    }
    const applied = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'edit-and-move',
      label: 'Edit and move',
      operations: editFirst ? [edit, move] : [move, edit],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success)
      return
    expect(applied.changedNodeChanges).toContainEqual(expect.objectContaining({ nodeId: 'name', kind: 'content' }))
    const changes = {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    }
    const draft = createProjectDraftSnapshotFromTransaction(initial, applied, 'edit-and-move-draft')
    const incrementalDraft = coordinator.compileDraftPage(draft, 'home', changes)
    const fullDraft = compileCanonicalPage({ snapshot: draft, registry: input.registry, pageId: 'home' })
    expect(incrementalDraft.success && fullDraft.success).toBe(true)
    if (incrementalDraft.success && fullDraft.success)
      expect(incrementalDraft.compilation).toEqual(fullDraft.compilation)
    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, changes)
    const after = coordinator.compilePage('home')
    const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId: 'home' })
    expect(after.success && full.success).toBe(true)
    if (!after.success || !full.success)
      return
    expect(after.compilation).toEqual(full.compilation)
    expect(after.compilation.page.nodesById.name!.props.placeholder).toBe('Changed and moved')
    expect(after.compilation.page.nodesById.name).not.toBe(before.compilation.page.nodesById.name)
    expect(after.compilation.page.nodesById.other).toBe(before.compilation.page.nodesById.other)
    expect(initial.document).toEqual(original)
    expect(before.compilation.page.nodesById.name!.props.placeholder).toBe('Your name')
    expect(Reflect.set(after.compilation.page.nodesById.name!.props, 'placeholder', 'Mutated')).toBe(false)
    expect(Reflect.set(after.compilation.page.scopedFields, 'length', 0)).toBe(false)
    if (location === 'nested' || location === 'scoped-reorder')
      expect(after.compilation.page.nodesById.section).toMatchObject({ slots: { default: ['other', 'name'] } })
    else
      expect(after.compilation.page.rootIds).toEqual(location === 'root' ? ['other', 'name', 'section'] : ['section', 'name'])
  })

  it.each([
    'replace',
    'edit-move-replace',
    'move-edit-replace',
    'replace-edit-move',
    'replace-move-edit',
    'edit-replace-move',
    'move-replace-edit',
  ].flatMap(order => [false, true].map(scoped => ({ order, scoped }))))(
    'matches full compilation for page replacement mixed with edits and moves ($order, scoped=$scoped)',
    ({ order, scoped }) => {
      const input = fixture()
      const document = structuredClone(input.snapshot.document) as ProjectDocument
      const graph = document.pagesById.home!.graph
      const section = graph.nodesById.section!
      if (section.kind !== 'layout')
        throw new TypeError('Expected section layout fixture.')
      if (scoped)
        section.valueScope = { kind: 'object', field: 'profile' }
      graph.nodesById.other = {
        id: 'other',
        component: 'element.input',
        kind: 'field',
        field: 'other',
        props: {},
        bindings: {},
      }
      section.slots.default!.push({ nodeId: 'other', placement: {} })
      addPage(document, 'home', 'billing')
      const initial = createProjectSnapshot(document, 1)
      const original = structuredClone(initial.document)
      const coordinator = createCompileCoordinator({ registry: input.registry })
      coordinator.acceptSnapshot(initial)
      const before = coordinator.compilePage('home')
      const billing = coordinator.compilePage('billing')
      expect(before.success && billing.success).toBe(true)
      if (!before.success || !billing.success)
        return
      const oldCompilation = structuredClone(before.compilation)
      const replacement = structuredClone(document.pagesById.home!)
      replacement.graph.nodesById.name!.props.placeholder = 'Replacement name'
      replacement.graph.nodesById.other!.props.placeholder = 'Replacement other'
      const actions: Record<string, ProjectOperation[]> = {
        replace: [
          { type: 'page.remove', pageId: 'home' },
          { type: 'page.add', page: replacement, index: 0 },
          { type: 'project.home', pageId: 'home' },
        ],
        edit: [{ type: 'node.props', pageId: 'home', nodeId: 'name', props: { placeholder: 'Edited name' } }],
        move: [{ type: 'node.move', pageId: 'home', nodeId: 'name', target: { parentId: null, index: 1 } }],
      }
      const applied = applyProjectTransaction(initial.document as ProjectDocument, {
        id: order,
        label: order,
        operations: order.split('-').flatMap(action => actions[action]!),
      })
      expect(applied.success && applied.changed).toBe(true)
      if (!applied.success)
        return
      const changes = {
        project: applied.changedProject,
        pageIds: applied.changedPageIds,
        nodeIds: applied.changedNodeIds,
        nodeChanges: applied.changedNodeChanges,
      }
      const draft = createProjectDraftSnapshotFromTransaction(initial, applied, 'replacement-draft')
      const incrementalDraft = coordinator.compileDraftPage(draft, 'home', changes)
      const fullDraft = compileCanonicalPage({ snapshot: draft, registry: input.registry, pageId: 'home' })
      expect(incrementalDraft).toEqual(fullDraft)
      expect(incrementalDraft.success).toBe(true)
      expect(coordinator.compilePage('home')).toEqual(before)
      const next = createProjectSnapshot(applied.document, 2)
      coordinator.acceptSnapshot(next, changes)
      const incremental = coordinator.compilePage('home')
      const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId: 'home' })
      expect(incremental).toEqual(full)
      expect(incremental.success).toBe(true)
      if (!incremental.success)
        return
      expect(incremental.compilation.page.nodesById.other!.props.placeholder).toBe('Replacement other')
      expect(incremental.compilation.key.semanticHash).not.toBe(before.compilation.key.semanticHash)
      expect(Reflect.set(incremental.compilation.page.nodesById.other!.props, 'placeholder', 'Mutated')).toBe(false)
      expect(Reflect.set(applied.changedNodeChanges, 'length', 0)).toBe(false)
      const reboundBilling = coordinator.compilePage('billing')
      expect(reboundBilling.success).toBe(true)
      if (reboundBilling.success) {
        expect(reboundBilling.compilation.page).toBe(billing.compilation.page)
        expect(reboundBilling.compilation.key).toBe(billing.compilation.key)
      }
      const undone = applyProjectTransaction(applied.document, applied.inverse)
      expect(undone.success && undone.changed).toBe(true)
      if (!undone.success)
        return
      expect(undone.document).toEqual(initial.document)
      const restored = createProjectSnapshot(undone.document, 3)
      coordinator.acceptSnapshot(restored, {
        project: undone.changedProject,
        pageIds: undone.changedPageIds,
        nodeIds: undone.changedNodeIds,
        nodeChanges: undone.changedNodeChanges,
      })
      const restoredCompilation = coordinator.compilePage('home')
      expect(restoredCompilation).toEqual(compileCanonicalPage({ snapshot: restored, registry: input.registry, pageId: 'home' }))
      expect(restoredCompilation.success).toBe(true)
      if (restoredCompilation.success)
        expect(restoredCompilation.compilation.key).toEqual(before.compilation.key)
      expect(initial.document).toEqual(original)
      expect(before.compilation).toEqual(oldCompilation)
    },
  )

  it.each(['empty', 'replace-field', 'field-map-order'])('matches full compilation for page replacement with %s', (shape) => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    const graph = document.pagesById.home!.graph
    graph.nodesById.other = {
      id: 'other',
      component: 'element.input',
      kind: 'field',
      field: 'other',
      props: {},
      bindings: {},
    }
    graph.root.push({ nodeId: 'other', placement: {} })
    addPage(document, 'home', 'billing')
    const initial = createProjectSnapshot(document, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(initial)
    expect(coordinator.compilePage('home').success).toBe(true)
    const replacement = structuredClone(document.pagesById.home!)
    if (shape === 'empty') {
      replacement.graph.root = []
      replacement.graph.nodesById = {}
    }
    else if (shape === 'replace-field') {
      const other = replacement.graph.nodesById.other!
      replacement.graph.root = [{ nodeId: 'new', placement: {} }]
      replacement.graph.nodesById = { new: { ...other, id: 'new' } }
    }
    else {
      replacement.graph.nodesById = Object.fromEntries(Object.entries(replacement.graph.nodesById).reverse())
      replacement.graph.nodesById.name!.props.placeholder = 'Changed'
    }
    const applied = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'replace-page-shape',
      label: 'Replace page shape',
      operations: [{ type: 'page.remove', pageId: 'home' }, { type: 'page.add', page: replacement, index: 0 }],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success)
      return
    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    })
    const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId: 'home' })
    expect(full.success).toBe(true)
    expect(coordinator.compilePage('home')).toEqual(full)
  })

  it.each([false, true])('compiles distinct page-qualified NUL identifiers (reverse=%s)', (reverse) => {
    const input = fixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    const targets = [{ pageId: 'a', nodeId: 'b\u0000c' }, { pageId: 'a\u0000b', nodeId: 'c' }]
    targets.forEach(({ pageId, nodeId }, index) => {
      addPage(document, 'home', pageId)
      const page = document.pagesById[pageId]!
      page.route = `/nul-${index}`
      page.graph.root = [{ nodeId, placement: {} }]
      page.graph.nodesById = {
        [nodeId]: { id: nodeId, component: 'element.input', kind: 'field', field: 'value', props: {}, bindings: {} },
      }
    })
    const initial = createProjectSnapshot(document, 1)
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(initial)
    targets.forEach(({ pageId }) => expect(coordinator.compilePage(pageId).success).toBe(true))
    const ordered = reverse ? [...targets].reverse() : targets
    const applied = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'nul-identifiers',
      label: 'NUL identifiers',
      operations: ordered.map(({ pageId, nodeId }) => ({
        type: 'node.props',
        pageId,
        nodeId,
        props: { placeholder: nodeId },
      })),
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success)
      return
    const next = createProjectSnapshot(applied.document, 2)
    coordinator.acceptSnapshot(next, {
      project: applied.changedProject,
      pageIds: applied.changedPageIds,
      nodeIds: applied.changedNodeIds,
      nodeChanges: applied.changedNodeChanges,
    })
    targets.forEach(({ pageId }) => {
      const full = compileCanonicalPage({ snapshot: next, registry: input.registry, pageId })
      expect(full.success).toBe(true)
      expect(coordinator.compilePage(pageId)).toEqual(full)
    })
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
