import type {
  ComponentContract,
  ProjectDocument,
  ProjectOperation,
  RegistryLock,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectCommandDraftTransaction,
  applyProjectDraftTransaction,
  applyProjectHistoryTransaction,
  applyProjectTransaction,
  ComponentContractRegistryError,
  createComponentContractRegistry,
  createProjectDomainEngine,
  createProjectDraftSnapshot,
  createProjectDraftSnapshotFromTransaction,
  createProjectHistory,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  getProjectDocumentContentHash,
  PAGE_GRAPH_VERSION,
  parseProjectCompilationSnapshot,
  parseProjectDocument,
  parseProjectDraftSnapshot,
  parseProjectSnapshot,
  parseRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  redoProjectHistory,
  REGISTRY_CONTRACT_SNAPSHOT_VERSION,
  registryLockFingerprint,
  resolveProjectCommand,
  undoProjectHistory,
} from '../index'

interface LegacyProjectShape {
  version: number
  pagesById: Record<string, {
    flows?: unknown[]
    graph: {
      version: number
      flows?: unknown[]
      nodesById: Record<string, { events?: Record<string, unknown> }>
    }
  }>
}

function projectDocument(registryLock: RegistryLock = {
  adapter: 'element-plus',
  version: '2.9.1',
  fingerprint: 'sha256:registry',
  components: {
    'element.input': { contractVersion: '1', fingerprint: 'sha256:input' },
    'element.section': { contractVersion: '1', fingerprint: 'sha256:section' },
  },
}): ProjectDocument {
  return {
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
          props: {},
          form: {},
          root: [{ nodeId: 'section', placement: {} }],
          nodesById: {
            section: {
              id: 'section',
              component: 'element.section',
              kind: 'layout',
              props: {},
              bindings: {},
              slots: { default: [{ nodeId: 'name', placement: {} }] },
            },
            name: {
              id: 'name',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              label: 'Name',
              props: {},
              bindings: {},
            },
          },
        },
      },
    },
    registryLock,
    settings: {},
    resources: {},
  }
}

function dragSortDocument(registryLock: RegistryLock): ProjectDocument {
  const document = projectDocument(registryLock)
  document.pagesById.home!.graph = {
    version: PAGE_GRAPH_VERSION,
    props: {},
    form: {},
    root: [
      { nodeId: 'root-first', placement: { span: 4 } },
      { nodeId: 'outer', placement: {} },
      { nodeId: 'sibling-container', placement: {} },
      { nodeId: 'root-last', placement: {} },
    ],
    nodesById: {
      'root-first': fieldNode('root-first'),
      'root-last': fieldNode('root-last'),
      'outer-field': fieldNode('outer-field'),
      'sibling-field': fieldNode('sibling-field'),
      'deep-field': fieldNode('deep-field'),
      'outer': layoutNode('outer', ['outer-field', 'middle']),
      'middle': layoutNode('middle', ['inner']),
      'inner': layoutNode('inner', ['deep-field']),
      'sibling-container': layoutNode('sibling-container', ['sibling-field']),
    },
  }
  return document
}

function fieldNode(id: string) {
  return {
    id,
    component: 'element.input',
    kind: 'field' as const,
    field: id,
    props: {},
    bindings: {},
  }
}

function layoutNode(id: string, childIds: string[]) {
  return {
    id,
    component: 'element.section',
    kind: 'layout' as const,
    props: {},
    bindings: {},
    slots: { default: childIds.map(nodeId => ({ nodeId, placement: {} })) },
  }
}

const inputContract: ComponentContract = {
  key: 'element.input',
  version: '1',
  kind: 'field',
  props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: { placeholder: '' },
}

const sectionContract: ComponentContract = {
  key: 'element.section',
  version: '1',
  kind: 'layout',
  props: [],
  bindings: [],
  slots: [{ name: 'default', accepts: ['field', 'layout'] }],
  allowedParents: [],
  defaults: {},
}

function componentRegistry() {
  return createComponentContractRegistry([inputContract, sectionContract], {
    adapter: 'element-plus',
    version: '2.9.1',
  })
}

describe('projectDocument schema', () => {
  it('parses and clones a normalized project document', () => {
    const source = projectDocument()
    const result = parseProjectDocument(source)
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data).toEqual(source)
    expect(result.data).not.toBe(source)
    expect(result.data.pagesById.home?.graph.nodesById).not.toBe(source.pagesById.home?.graph.nodesById)
  })

  it('accepts canonical pixel form sizes and rejects arbitrary units or ranges', () => {
    const source = projectDocument()
    source.pagesById.home!.graph.form = {
      gap: '16px',
      labelPosition: 'left',
      labelWidth: 120,
      responsive: {
        tablet: { labelWidth: 96 },
        mobile: { labelWidth: 72 },
      },
    }
    expect(parseProjectDocument(source).success).toBe(true)
    for (const form of [
      { gap: '0px', labelWidth: 0 },
      { gap: '64px', labelWidth: 480 },
    ]) {
      const boundary = projectDocument()
      boundary.pagesById.home!.graph.form = form
      expect(parseProjectDocument(boundary).success).toBe(true)
    }

    for (const form of [
      { gap: '1rem' },
      { gap: '-1px' },
      { gap: '65px' },
      { labelWidth: -1 },
      { labelWidth: 481 },
      { labelWidth: 12.5 },
      { responsive: { tablet: { labelWidth: 481 } } },
      { responsive: { mobile: { labelWidth: -1 } } },
    ]) {
      const invalid = projectDocument()
      invalid.pagesById.home!.graph.form = form
      expect(parseProjectDocument(invalid).success).toBe(false)
    }
  })

  it('rejects nodes referenced by more than one slot', () => {
    const source = projectDocument()
    const section = source.pagesById.home!.graph.nodesById.section
    if (section?.kind === 'layout')
      section.slots.secondary = [{ nodeId: 'name', placement: {} }]
    const result = parseProjectDocument(source)
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics.some(item => item.message.includes('exactly one parent location'))).toBe(true)
  })

  it('rejects cycles even when every node has one reference', () => {
    const source = projectDocument()
    const graph = source.pagesById.home!.graph
    graph.root = []
    const section = graph.nodesById.section
    const nested = graph.nodesById.name
    if (section?.kind === 'layout')
      section.slots.default = [{ nodeId: 'name', placement: {} }]
    graph.nodesById.name = {
      id: 'name',
      component: 'element.section',
      kind: 'layout',
      props: nested?.props ?? {},
      bindings: {},
      slots: { default: [{ nodeId: 'section', placement: {} }] },
    }
    const result = parseProjectDocument(source)
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics.some(item => item.message.includes('cycle'))).toBe(true)
  })

  it('rejects missing pages, duplicate routes and generated files in the domain document', () => {
    const source = projectDocument() as ProjectDocument & { files?: unknown }
    source.pageOrder.push('missing')
    source.pagesById.second = {
      ...structuredClone(source.pagesById.home!),
      id: 'second',
    }
    source.pageOrder.push('second')
    source.files = { 'src/App.vue': { kind: 'text', content: '' } }
    const result = parseProjectDocument(source)
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics.some(item => item.message.includes('Unrecognized key'))).toBe(true)
  })

  it('rejects duplicate fields and unknown reaction references without a registry', () => {
    const source = projectDocument()
    const graph = source.pagesById.home!.graph
    graph.root.push({ nodeId: 'duplicate', placement: {} })
    graph.nodesById.duplicate = {
      id: 'duplicate',
      component: 'element.input',
      kind: 'field',
      field: 'name',
      props: {},
      bindings: {},
      conditions: {
        visible: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'missing' },
          right: { kind: 'literal', value: true },
        },
      },
    }
    const result = parseProjectDocument(source)
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics.some(item => item.message.includes('Field name must be unique'))).toBe(true)
    expect(result.diagnostics.some(item => item.message.includes('Unknown field reference'))).toBe(true)
  })

  it('rejects prototype-sensitive map keys', () => {
    const source = projectDocument()
    source.pagesById.home!.graph.nodesById.name!.props = JSON.parse('{"__proto__":{"polluted":true}}')
    const result = parseProjectDocument(source)
    expect(result.success).toBe(false)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('rejects legacy event and Flow shapes without migration', () => {
    const nodeEvents = structuredClone(projectDocument()) as unknown as LegacyProjectShape
    nodeEvents.pagesById.home!.graph.nodesById.name!.events = {}
    expect(parseProjectDocument(nodeEvents).success).toBe(false)

    const pageFlows = structuredClone(projectDocument()) as unknown as LegacyProjectShape
    pageFlows.pagesById.home!.flows = []
    expect(parseProjectDocument(pageFlows).success).toBe(false)

    const graphFlows = structuredClone(projectDocument()) as unknown as LegacyProjectShape
    graphFlows.pagesById.home!.graph.flows = []
    expect(parseProjectDocument(graphFlows).success).toBe(false)
  })

  it('rejects old document and page graph versions', () => {
    const oldDocument = structuredClone(projectDocument()) as unknown as LegacyProjectShape
    oldDocument.version = PROJECT_DOCUMENT_VERSION - 1
    expect(parseProjectDocument(oldDocument).success).toBe(false)

    const oldGraph = structuredClone(projectDocument()) as unknown as LegacyProjectShape
    oldGraph.pagesById.home!.graph.version = PAGE_GRAPH_VERSION - 1
    expect(parseProjectDocument(oldGraph).success).toBe(false)
  })
})

describe('projectSnapshot envelope', () => {
  it('separates immutable editor metadata from the ProjectDocument wire format', () => {
    const document = projectDocument()
    const snapshot = createProjectSnapshot(document, 7)

    expect(snapshot).toEqual({
      document,
      editVersion: 7,
      contentHash: expect.stringMatching(/^fnv1a:[0-9a-f]{8}$/),
    })
    expect(snapshot.document).not.toBe(document)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.document)).toBe(true)
    expect(Object.isFrozen(snapshot.document.pagesById.home?.graph.nodesById)).toBe(true)
  })

  it('hashes domain content independently from the editor version', () => {
    const document = projectDocument()
    const initial = createProjectSnapshot(document)
    const laterEditorVersion = createProjectSnapshot(document, 9)
    const changed = createProjectSnapshot({ ...document, name: 'Changed project' }, 9)

    expect(laterEditorVersion.contentHash).toBe(initial.contentHash)
    expect(changed.contentHash).not.toBe(initial.contentHash)
  })

  it('keeps structural-sharing draft hashes wire-compatible without caching mutable documents', () => {
    const snapshot = createProjectSnapshot(projectDocument(), 1)
    const applied = applyProjectTransaction(snapshot.document as ProjectDocument, {
      id: 'move-draft-node',
      label: 'Move draft node',
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

    const draft = createProjectDraftSnapshotFromTransaction(snapshot, applied, 'move-candidate')
    expect(draft.draftHash).toBe(getProjectDocumentContentHash(draft.document))
    expect(draft.document).toBe(applied.document)
    expect(draft.document.pagesById.home!.graph.nodesById.name).toBe(snapshot.document.pagesById.home!.graph.nodesById.name)
    expect(parseProjectDraftSnapshot(draft)).toMatchObject({ success: true, data: draft })

    const shallowFrozen = Object.freeze(structuredClone(draft.document) as ProjectDocument)
    const before = getProjectDocumentContentHash(shallowFrozen)
    shallowFrozen.pagesById.home!.name = 'Changed after shallow freeze'
    expect(getProjectDocumentContentHash(shallowFrozen)).not.toBe(before)
  })

  it.each([applyProjectTransaction, applyProjectDraftTransaction])('freezes authenticated results and all change metadata before draft publication (%#)', (apply) => {
    const snapshot = createProjectSnapshot(projectDocument(), 3)
    const applied = apply(snapshot.document as ProjectDocument, {
      id: 'immutable-result',
      label: 'Edit node',
      operations: [{ type: 'node.props', pageId: 'home', nodeId: 'name', props: { placeholder: 'Changed' } }],
    })
    expect(applied.success && applied.changed).toBe(true)
    if (!applied.success)
      return

    expect(Object.isFrozen(applied)).toBe(true)
    expect(Reflect.set(applied, 'document', projectDocument())).toBe(false)
    expect(Reflect.set(applied.document, 'homePageId', 'missing')).toBe(false)
    expect(Reflect.set(applied.document.pagesById.home!.graph.root[0]!, 'nodeId', 'missing')).toBe(false)
    expect(Reflect.set(applied.document.pagesById.home!.graph.nodesById.name!.props, 'placeholder', 'Tampered')).toBe(false)
    expect(Reflect.set(applied.changedNodeChanges[0]!, 'kind', 'move')).toBe(false)
    expect(Reflect.set(applied.changedNodeChanges, 'length', 0)).toBe(false)
    expect(Reflect.set(applied.changedPageIds, 'length', 0)).toBe(false)
    expect(Reflect.set(applied.inverse.operations, 'length', 0)).toBe(false)
    const draft = createProjectDraftSnapshotFromTransaction(snapshot, applied, 'immutable-draft')
    expect(draft.document).toBe(applied.document)
    expect(draft.draftHash).toBe(getProjectDocumentContentHash(applied.document))
    expect(draft.document.pagesById.home!.graph.nodesById.name!.props.placeholder).toBe('Changed')
    expect(applied.changedNodeChanges).toEqual([{ kind: 'content', pageId: 'home', nodeId: 'name' }])
  })

  it.each(['homePageId', 'reference'] as const)('rejects copied, forged and shallow-frozen transaction results with invalid %s', (property) => {
    const snapshot = createProjectSnapshot(projectDocument(), 3)
    const applied = applyProjectTransaction(snapshot.document as ProjectDocument, {
      id: 'valid-result',
      label: 'Rename page',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    })
    expect(applied.success).toBe(true)
    if (!applied.success)
      return

    const copied = structuredClone(applied)
    if (property === 'homePageId')
      copied.document.homePageId = 'missing'
    else
      copied.document.pagesById.home!.graph.root[0]!.nodeId = 'missing'
    expect(parseProjectDocument(copied.document).success).toBe(false)
    const forged = { ...copied, changedPageIds: [], changedNodeIds: [], changedNodeChanges: [] }
    const shallowFrozen = Object.freeze({ ...copied, document: Object.freeze(structuredClone(copied.document)) })
    for (const untrusted of [copied, forged, shallowFrozen, { ...applied }, Object.create(applied)]) {
      expect(() => createProjectDraftSnapshotFromTransaction(snapshot, untrusted, 'forged'))
        .toThrow('authenticated transaction result')
    }
    shallowFrozen.document.pagesById.home!.name = 'Still mutable below the frozen root'
    expect(() => createProjectDraftSnapshotFromTransaction(snapshot, shallowFrozen, 'forged-again'))
      .toThrow('authenticated transaction result')
    expect(createProjectDraftSnapshotFromTransaction(snapshot, applied, 'valid').draftHash)
      .toBe(getProjectDocumentContentHash(applied.document))
  })

  it('does not authenticate command intermediates, unvalidated sources or a different base with the same project id', () => {
    const snapshot = createProjectSnapshot(projectDocument(), 3)
    const transaction = {
      id: 'rename',
      label: 'Rename page',
      operations: [{ type: 'page.rename' as const, pageId: 'home', name: 'Landing' }],
    }
    const intermediate = applyProjectCommandDraftTransaction(snapshot.document as ProjectDocument, transaction)
    expect(intermediate.success).toBe(true)
    if (intermediate.success) {
      expect(() => createProjectDraftSnapshotFromTransaction(snapshot, intermediate, 'intermediate'))
        .toThrow('authenticated transaction result')
    }
    const unvalidated = Object.freeze(projectDocument())
    unvalidated.pagesById.home!.graph.root[0]!.nodeId = 'missing'
    const result = applyProjectTransaction(unvalidated, transaction)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(() => createProjectDraftSnapshotFromTransaction({
        document: unvalidated,
        editVersion: 3,
        contentHash: getProjectDocumentContentHash(unvalidated),
      }, result, 'invalid-source')).toThrow('validated base document')
    }
    const applied = applyProjectTransaction(snapshot.document as ProjectDocument, transaction)
    expect(applied.success).toBe(true)
    if (!applied.success)
      return
    expect(() => createProjectDraftSnapshotFromTransaction(createProjectSnapshot(projectDocument(), 3), applied, 'different-base'))
      .toThrow('validated base document')
    expect(() => createProjectDraftSnapshotFromTransaction({ ...snapshot, contentHash: 'fnv1a:00000000' }, applied, 'stale-hash'))
      .toThrow('valid base snapshot identity')
    expect(() => createProjectDraftSnapshotFromTransaction({ ...snapshot, editVersion: -1 }, applied, 'invalid-version'))
      .toThrow('valid base snapshot identity')
    expect(createProjectDraftSnapshotFromTransaction({ ...snapshot }, applied, 'valid-envelope').document).toBe(applied.document)
  })

  it('round-trips valid envelopes and rejects stale content hashes', () => {
    const snapshot = createProjectSnapshot(projectDocument(), 4)
    const parsed = parseProjectSnapshot(JSON.parse(JSON.stringify(snapshot)))
    expect(parsed).toEqual({ success: true, data: snapshot, diagnostics: [] })

    const invalid = parseProjectSnapshot({ ...snapshot, contentHash: 'fnv1a:00000000' })
    expect(invalid.success).toBe(false)
    if (invalid.success)
      return
    expect(invalid.diagnostics[0]).toMatchObject({
      code: 'PROJECT_SNAPSHOT_INVARIANT',
      path: ['contentHash'],
    })
  })

  it('identifies transient compiler drafts without changing committed editor identity', () => {
    const snapshot = createProjectSnapshot(projectDocument(), 4)
    const document = structuredClone(snapshot.document) as ProjectDocument
    document.name = 'Draft name'
    const draft = createProjectDraftSnapshot(snapshot, document, 'drag-candidate')

    expect(draft).toMatchObject({
      kind: 'draft',
      draftId: 'drag-candidate',
      base: {
        projectId: snapshot.document.id,
        editVersion: snapshot.editVersion,
        contentHash: snapshot.contentHash,
      },
    })
    expect(draft.draftHash).not.toBe(snapshot.contentHash)
    expect(Object.isFrozen(draft.document)).toBe(true)
    expect(parseProjectDraftSnapshot(JSON.parse(JSON.stringify(draft)))).toEqual({
      success: true,
      data: draft,
      diagnostics: [],
    })
    expect(parseProjectCompilationSnapshot(draft)).toEqual({ success: true, data: draft, diagnostics: [] })
    expect(parseProjectCompilationSnapshot(snapshot)).toEqual({ success: true, data: snapshot, diagnostics: [] })
  })

  it('rejects draft snapshots with mismatched project or content identity', () => {
    const snapshot = createProjectSnapshot(projectDocument(), 4)
    const draft = createProjectDraftSnapshot(snapshot, snapshot.document, 'drag-candidate')

    expect(parseProjectDraftSnapshot({
      ...draft,
      base: { ...draft.base, projectId: 'different-project' },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_DRAFT_SNAPSHOT_INVARIANT', path: ['document', 'id'] }],
    })
    expect(parseProjectDraftSnapshot({ ...draft, draftHash: 'fnv1a:00000000' })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_DRAFT_SNAPSHOT_INVARIANT', path: ['draftHash'] }],
    })
  })
})

describe('componentContractRegistry', () => {
  it('creates a deterministic lock independent of declaration order', () => {
    const left = createComponentContractRegistry([inputContract, sectionContract], {
      adapter: 'element-plus',
      version: '2.9.1',
    })
    const right = createComponentContractRegistry([sectionContract, inputContract], {
      adapter: 'element-plus',
      version: '2.9.1',
    })
    expect(left.lock).toEqual(right.lock)
    expect(left.lock.fingerprint).toMatch(/^fnv1a:[a-f0-9]{8}$/)
    expect(left.list().map(contract => contract.key)).toEqual(['element.input', 'element.section'])
  })

  it('creates an immutable JSON-safe snapshot with verified component identities', () => {
    const snapshot = createRegistryContractSnapshot(componentRegistry())

    expect(snapshot.components.map(component => component.key)).toEqual(['element.input', 'element.section'])
    expect(snapshot.components[0]?.fingerprint).toMatch(/^fnv1a:[a-f0-9]{8}$/)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.components[0]?.contract.defaults)).toBe(true)
    expect(parseRegistryContractSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual({
      success: true,
      data: snapshot,
      diagnostics: [],
    })

    const corrupted = structuredClone(snapshot) as unknown as {
      components: Array<{ fingerprint: string }>
    }
    corrupted.components[0]!.fingerprint = 'fnv1a:00000000'
    const parsed = parseRegistryContractSnapshot(corrupted)
    expect(parsed.success).toBe(false)
    expect(parsed.diagnostics.map(diagnostic => diagnostic.code)).toEqual(expect.arrayContaining([
      'MODEL_REGISTRY_SNAPSHOT_COMPONENT_FINGERPRINT_MISMATCH',
      'MODEL_REGISTRY_SNAPSHOT_FINGERPRINT_MISMATCH',
    ]))
  })

  it('rejects duplicate contracts and slots on field components', () => {
    expect(() => createComponentContractRegistry([inputContract, inputContract], {
      adapter: 'element-plus',
      version: '2.9.1',
    })).toThrowError(ComponentContractRegistryError)
    expect(() => createComponentContractRegistry([{
      ...inputContract,
      slots: [{ name: 'default' }],
    }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })).toThrowError(/Field component contracts cannot define slots/)
  })

  it('accepts adapter member names independently from component keys and reports unsafe paths', () => {
    const registry = createComponentContractRegistry([{
      ...inputContract,
      props: [
        { key: 'defaultValue', path: ['defaultValue'] },
        { key: 'showWordLimit', path: ['props', 'showWordLimit'] },
      ],
      bindings: [{ name: 'modelValue', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })

    expect(registry.get('element.input')?.props.map(property => property.key)).toEqual([
      'defaultValue',
      'showWordLimit',
    ])

    expect(() => createComponentContractRegistry([{
      ...inputContract,
      props: [{ key: 'unsafe', path: ['props', '__proto__'] }],
    }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })).toThrowError(/props\[0\]\.path\[1\]: Object member name is not allowed/)
  })

  it('rejects component contract version mismatches without a conversion path', () => {
    const registry = createComponentContractRegistry([{
      ...inputContract,
      version: '3',
    }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })
    const previousLock = componentRegistry().lock
    expect(registry.analyzeLock(previousLock)).toMatchObject([{
      code: 'MODEL_REGISTRY_COMPONENT_VERSION_MISMATCH',
      path: ['components', 'element.input', 'contractVersion'],
    }, {
      code: 'MODEL_REGISTRY_COMPONENT_MISSING',
      path: ['components', 'element.section'],
    }])
  })
})

describe('projectTransaction', () => {
  it('preserves the complete current Registry lock and rejects a subset lock', () => {
    const registry = createComponentContractRegistry([
      inputContract,
      sectionContract,
      { ...inputContract, key: 'element.unused' },
    ], { adapter: 'element-plus', version: '2.9.1' })
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'rename-with-complete-registry',
      label: 'Rename with complete Registry',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.document.registryLock).toEqual(registry.lock)
    expect(result.document.registryLock.components).toHaveProperty('element.unused')

    const subset = structuredClone(registry.lock)
    delete subset.components['element.unused']
    subset.fingerprint = registryLockFingerprint(subset.components)
    const rejected = applyProjectTransaction(projectDocument(subset), {
      id: 'rename-with-subset-registry',
      label: 'Rename with subset Registry',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry })
    expect(rejected).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_REGISTRY_COMPONENT_SET_MISMATCH' }],
    })

    const unknownComponent = projectDocument(registry.lock)
    unknownComponent.pagesById.home!.graph.nodesById.name!.component = 'element.unknown'
    const unknown = applyProjectTransaction(unknownComponent, {
      id: 'rename-with-unknown-component',
      label: 'Rename with unknown component',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry })
    expect(unknown).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_COMPONENT_UNKNOWN' }],
    })
  })

  it.each(['toString', 'hasOwnProperty', 'unknown-component'])('rejects an unknown legal component identifier %s with the complete registry', (component) => {
    const registry = componentRegistry()
    const document = projectDocument(registry.lock)
    document.pagesById.home!.graph.nodesById.name!.component = component
    expect(parseProjectDocument(document).success).toBe(true)
    expect(applyProjectTransaction(document, {
      id: 'unknown-component',
      label: 'Rename page',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry })).toMatchObject({
      success: false,
      document,
      diagnostics: [{ code: 'PROJECT_COMPONENT_UNKNOWN' }],
    })
  })

  it('rejects constructor in the schema and requires an actual registry contract for own lock keys', () => {
    const registry = componentRegistry()
    const invalid = projectDocument(registry.lock)
    invalid.pagesById.home!.graph.nodesById.name!.component = 'constructor'
    expect(parseProjectDocument(invalid)).toMatchObject({
      success: false,
      diagnostics: [expect.objectContaining({ path: ['pagesById', 'home', 'graph', 'nodesById', 'name', 'component'] })],
    })
    expect(() => createComponentContractRegistry([{ ...inputContract, key: 'toString' }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })).toThrow('Invalid component contract toString')
    const registered = createComponentContractRegistry([inputContract, sectionContract, { ...inputContract, key: 'element.valid' }], {
      adapter: 'element-plus',
      version: '2.9.1',
    })
    const document = projectDocument(registered.lock)
    document.pagesById.home!.graph.nodesById.name!.component = 'element.valid'
    const transaction = {
      id: 'registered-prototype-name',
      label: 'Rename page',
      operations: [{ type: 'page.rename' as const, pageId: 'home', name: 'Landing' }],
    }
    expect(applyProjectTransaction(document, transaction, { registry: registered }).success).toBe(true)
    expect(applyProjectTransaction(document, transaction, {
      registry: { ...registered, get: key => key === 'element.valid' ? undefined : registered.get(key) },
    })).toMatchObject({ success: false, diagnostics: [{ code: 'PROJECT_COMPONENT_UNKNOWN' }] })
  })

  it.each([
    undefined,
    {},
    { contractVersion: '1' },
    { contractVersion: '', fingerprint: 'test' },
    { contractVersion: '1', fingerprint: '' },
    Object.create({ contractVersion: '1', fingerprint: 'test' }),
  ])('rejects malformed or inherited component lock records (%#)', (record) => {
    const registry = componentRegistry()
    const lock = {
      ...registry.lock,
      components: { ...registry.lock.components, 'element.input': record } as RegistryLock['components'],
    }
    const document = projectDocument(lock)
    expect(applyProjectTransaction(document, {
      id: 'invalid-component-lock',
      label: 'Rename page',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry: { ...registry, lock } })).toMatchObject({
      success: false,
      document,
      diagnostics: [{ code: 'PROJECT_COMPONENT_UNKNOWN' }],
    })
  })

  it('resolves semantic command actions against one evolving draft', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const resolution = resolveProjectCommand(initial, {
      id: 'edit-and-duplicate',
      label: 'Edit and duplicate field',
      actions: [
        {
          type: 'node.patch',
          pageId: 'home',
          nodeId: 'name',
          patch: { set: { field: 'fullName', label: 'Full name' } },
        },
        {
          type: 'node.duplicate',
          pageId: 'home',
          nodeId: 'name',
          target: { parentId: 'section', slot: 'default', index: 1 },
          idMap: { name: 'name-copy' },
          fieldMap: { fullName: 'fullNameCopy' },
        },
      ],
    }, { registry })

    expect(resolution.success).toBe(true)
    if (!resolution.success)
      return
    expect(resolution.transaction.operations).toHaveLength(2)
    const committed = applyProjectTransaction(initial, resolution.transaction, { registry })
    expect(committed.success).toBe(true)
    if (!committed.success)
      return
    expect(committed.document.pagesById.home?.graph.nodesById.name).toMatchObject({
      field: 'fullName',
      label: 'Full name',
    })
    expect(committed.document.pagesById.home?.graph.nodesById['name-copy']).toMatchObject({
      id: 'name-copy',
      field: 'fullNameCopy',
    })
    expect(committed.document.pagesById.home?.graph.nodesById.section).toMatchObject({
      slots: { default: [{ nodeId: 'name', placement: {} }, { nodeId: 'name-copy', placement: {} }] },
    })
  })

  it('rejects semantic commands before creating a partial transaction', () => {
    const initial = projectDocument()
    const resolution = resolveProjectCommand(initial, {
      id: 'invalid-command',
      label: 'Invalid command',
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: 'missing',
        patch: { set: { label: 'Missing' } },
      }],
    })

    expect(resolution).toEqual({
      success: false,
      diagnostics: [expect.objectContaining({
        code: 'PROJECT_NODE_UNKNOWN',
        nodeId: 'missing',
      })],
    })
    expect(initial.pagesById.home?.name).toBe('Home')
  })

  it('validates a multi-action command only after its final cross-entity state', () => {
    const initial = projectDocument()
    const graph = initial.pagesById.home!.graph
    graph.root.push({ nodeId: 'dependent', placement: {} })
    graph.nodesById.dependent = {
      id: 'dependent',
      component: 'element.input',
      kind: 'field',
      field: 'dependent',
      props: {},
      bindings: {},
      conditions: {
        visible: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'name' },
          right: { kind: 'literal', value: 'visible' },
        },
      },
    }

    const resolution = resolveProjectCommand(initial, {
      id: 'remove-field-and-reference',
      label: 'Remove field and reference',
      actions: [
        {
          type: 'operation.apply',
          operations: [{ type: 'node.remove', pageId: 'home', nodeId: 'name' }],
        },
        {
          type: 'node.patch',
          pageId: 'home',
          nodeId: 'dependent',
          patch: { unset: ['conditions'] },
        },
      ],
    })

    const serialized = JSON.parse(JSON.stringify({
      id: 'remove-field-and-reference',
      label: 'Remove field and reference',
      actions: [
        {
          type: 'operation.apply',
          operations: [{ type: 'node.remove', pageId: 'home', nodeId: 'name' }],
        },
        {
          type: 'node.patch',
          pageId: 'home',
          nodeId: 'dependent',
          patch: { unset: ['conditions'] },
        },
      ],
    }))
    expect(serialized.actions[1].patch).toEqual({ unset: ['conditions'] })

    expect(resolution.success).toBe(true)
    if (!resolution.success)
      return
    const committed = applyProjectTransaction(initial, resolution.transaction)
    expect(committed.success).toBe(true)
    if (!committed.success)
      return
    expect(committed.document.pagesById.home?.graph.nodesById).not.toHaveProperty('name')
    expect(committed.document.pagesById.home?.graph.nodesById.dependent).not.toHaveProperty('conditions')
  })

  it('rejects ambiguous or non-serializable semantic node patches', () => {
    const initial = projectDocument()
    const conflicting = resolveProjectCommand(initial, {
      id: 'conflicting-patch',
      label: 'Conflicting patch',
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: 'name',
        patch: { set: { label: 'Next' }, unset: ['label'] },
      }],
    })
    expect(conflicting).toEqual({
      success: false,
      diagnostics: [expect.objectContaining({ code: 'PROJECT_NODE_PATCH_CONFLICT' })],
    })

    const undefinedValue = resolveProjectCommand(initial, {
      id: 'undefined-patch',
      label: 'Undefined patch',
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: 'name',
        patch: { set: { label: undefined } },
      }],
    })
    expect(undefinedValue).toEqual({
      success: false,
      diagnostics: [expect.objectContaining({ code: 'PROJECT_NODE_PATCH_VALUE_UNDEFINED' })],
    })
  })

  it('applies one atomic transaction and its semantic inverse', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'edit-home',
      label: 'Edit home',
      operations: [
        { type: 'page.rename', pageId: 'home', name: 'Landing' },
        {
          type: 'node.props',
          pageId: 'home',
          nodeId: 'name',
          props: { placeholder: 'Full name' },
        },
        {
          type: 'node.insert',
          pageId: 'home',
          target: { parentId: 'section', slot: 'default', index: 1 },
          subgraph: {
            root: [{ nodeId: 'email', placement: {} }],
            nodesById: {
              email: {
                id: 'email',
                component: 'element.input',
                kind: 'field',
                field: 'email',
                props: { placeholder: 'Email' },
                bindings: {},
              },
            },
          },
        },
      ],
    }, { registry })
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changed).toBe(true)
    expect(result.document.pagesById.home?.name).toBe('Landing')
    expect(result.document.pagesById.home?.graph.nodesById.section).toMatchObject({
      slots: { default: [{ nodeId: 'name', placement: {} }, { nodeId: 'email', placement: {} }] },
    })

    const undone = applyProjectTransaction(result.document, result.inverse, { registry })
    expect(undone.success).toBe(true)
    if (!undone.success)
      return
    expect(undone.document.pagesById).toEqual(initial.pagesById)
    expect(undone.document.pageOrder).toEqual(initial.pageOrder)
    expect(undone.document.homePageId).toBe(initial.homePageId)
  })

  it('rolls back an entire transaction when a later operation fails', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'invalid-batch',
      label: 'Invalid batch',
      operations: [
        { type: 'page.rename', pageId: 'home', name: 'Changed' },
        { type: 'node.props', pageId: 'home', nodeId: 'missing', props: {} },
      ],
    }, { registry })
    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(initial.pagesById.home?.name).toBe('Home')
    expect(initial.pagesById.home?.name).toBe('Home')
  })

  it('shares untouched branches while isolating the edited node path', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    initial.pagesById.settings = {
      ...structuredClone(initial.pagesById.home!),
      id: 'settings',
      name: 'Settings',
      route: '/settings',
    }
    initial.pageOrder.push('settings')

    const result = applyProjectTransaction(initial, {
      id: 'edit-name',
      label: 'Edit name',
      operations: [{
        type: 'node.props',
        pageId: 'home',
        nodeId: 'name',
        props: { placeholder: 'Full name' },
      }],
    }, { registry })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.document).not.toBe(initial)
    expect(result.document.pagesById).not.toBe(initial.pagesById)
    expect(result.document.pagesById.home).not.toBe(initial.pagesById.home)
    expect(result.document.pagesById.home?.graph).not.toBe(initial.pagesById.home?.graph)
    expect(result.document.pagesById.home?.graph.nodesById).not.toBe(initial.pagesById.home?.graph.nodesById)
    expect(result.document.pagesById.home?.graph.nodesById.name).not.toBe(initial.pagesById.home?.graph.nodesById.name)
    expect(result.document.pagesById.home?.graph.nodesById.section).toBe(initial.pagesById.home?.graph.nodesById.section)
    expect(result.document.pagesById.settings).toBe(initial.pagesById.settings)
    expect(result.document.pageOrder).toBe(initial.pageOrder)
    expect(result.document.registryLock).toBe(initial.registryLock)
    expect(result.document.settings).toBe(initial.settings)
    expect(result.document.resources).toBe(initial.resources)
  })

  it('applies a structurally shared draft without persistence metadata', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectDraftTransaction(initial, {
      id: 'candidate-move',
      label: 'Candidate move',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'name',
        target: { parentId: null, index: 1 },
      }],
    }, { registry })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changed).toBe(true)
    expect(result.document.pagesById.home?.graph.root.map(item => item.nodeId)).toEqual(['section', 'name'])
    expect(initial.pagesById.home?.graph.root.map(item => item.nodeId)).toEqual(['section'])
    expect(result.document.registryLock).toBe(initial.registryLock)
  })

  it('rejects an invalid draft candidate before it reaches the design runtime', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectDraftTransaction(initial, {
      id: 'duplicate-candidate',
      label: 'Duplicate field candidate',
      operations: [{
        type: 'node.insert',
        pageId: 'home',
        target: { parentId: 'section', slot: 'default', index: 1 },
        subgraph: {
          root: [{ nodeId: 'duplicate', placement: {} }],
          nodesById: {
            duplicate: {
              id: 'duplicate',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              props: {},
              bindings: {},
            },
          },
        },
      }],
    }, { registry })

    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe('PROJECT_FIELD_DUPLICATE')
    expect(initial.pagesById.home?.graph.nodesById).not.toHaveProperty('duplicate')
  })

  it('allows a command draft intermediate state while the public draft rejects it', () => {
    const initial = projectDocument()
    const graph = initial.pagesById.home!.graph
    graph.root.push({ nodeId: 'dependent', placement: {} })
    graph.nodesById.dependent = {
      id: 'dependent',
      component: 'element.input',
      kind: 'field',
      field: 'dependent',
      props: {},
      bindings: {},
      conditions: {
        visible: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'name' },
          right: { kind: 'literal', value: 'visible' },
        },
      },
    }
    const transaction = {
      id: 'remove-command-draft-field',
      label: 'Remove command draft field',
      operations: [{ type: 'node.remove' as const, pageId: 'home', nodeId: 'name' }],
    }

    const intermediate = applyProjectCommandDraftTransaction(initial, transaction)
    expect(intermediate.success).toBe(true)
    if (!intermediate.success)
      return
    expect(intermediate.document.pagesById.home?.graph.nodesById).not.toHaveProperty('name')
    expect(intermediate.document.pagesById.home?.graph.nodesById.dependent).toHaveProperty('conditions')

    const published = applyProjectDraftTransaction(initial, transaction)
    expect(published).toMatchObject({
      success: false,
      document: initial,
      diagnostics: [expect.objectContaining({
        code: 'PROJECT_DOCUMENT_INVALID',
        message: 'Unknown field reference: name',
      })],
    })
  })

  it('merges node change metadata in operation order and reverses mutations in inverse order', () => {
    const initial = projectDocument()
    const result = applyProjectTransaction(initial, {
      id: 'move-and-edit-name',
      label: 'Move and edit name',
      operations: [
        { type: 'node.move', pageId: 'home', nodeId: 'name', target: { parentId: null, index: 1 } },
        { type: 'node.props', pageId: 'home', nodeId: 'name', props: { placeholder: 'Moved name' } },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changedNodeChanges).toEqual([
      {
        kind: 'content',
        pageId: 'home',
        nodeId: 'name',
        before: { parentId: 'section', slot: 'default' },
        after: { parentId: null, slot: null },
      },
      { kind: 'content', pageId: 'home', nodeId: 'section' },
    ])
    expect(result.inverse.operations.map(operation => operation.type)).toEqual(['node.props', 'node.move'])

    const undone = applyProjectTransaction(result.document, result.inverse)
    expect(undone.success).toBe(true)
    if (undone.success)
      expect(undone.document).toEqual(initial)
  })

  it.each([
    { parentId: null, nodeId: 'root-first', editFirst: true },
    { parentId: null, nodeId: 'root-first', editFirst: false },
    { parentId: 'outer', nodeId: 'outer-field', editFirst: true },
    { parentId: 'outer', nodeId: 'outer-field', editFirst: false },
  ])('retains content changes during same-slot moves ($nodeId, editFirst=$editFirst)', ({ parentId, nodeId, editFirst }) => {
    const registry = componentRegistry()
    const initial = dragSortDocument(registry.lock)
    const edit: ProjectOperation = { type: 'node.props', pageId: 'home', nodeId, props: { placeholder: 'Changed' } }
    const move: ProjectOperation = { type: 'node.move', pageId: 'home', nodeId, target: { parentId, index: 1 } }
    const result = applyProjectTransaction(initial, {
      id: 'edit-and-reorder',
      label: 'Edit and reorder',
      operations: editFirst ? [edit, move] : [move, edit],
    }, { registry })
    expect(result.success && result.changed).toBe(true)
    if (!result.success)
      return
    const relation = { parentId, slot: parentId === null ? null : 'default' }
    expect(result.changedNodeChanges).toContainEqual({ kind: 'content', pageId: 'home', nodeId, before: relation, after: relation })
    expect(result.document.pagesById.home!.graph.nodesById[nodeId]!.props.placeholder).toBe('Changed')
    const undone = applyProjectTransaction(result.document, result.inverse, { registry })
    expect(undone.success).toBe(true)
    expect(undone.document).toEqual(initial)
  })

  it.each(['name', 'section'])('validates only surviving placements after moving a node and removing %s', (removedId) => {
    const registry = componentRegistry()
    const document = projectDocument(registry.lock)
    const section = document.pagesById.home!.graph.nodesById.section!
    if (section.kind !== 'layout')
      throw new TypeError('Expected section layout fixture.')
    document.pagesById.home!.graph.nodesById.other = fieldNode('other')
    section.slots.default!.push({ nodeId: 'other', placement: {} })
    const initial = createProjectSnapshot(document, 1)
    const original = structuredClone(initial.document)
    const result = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'move-and-remove',
      label: 'Move and remove',
      operations: [
        { type: 'node.move', pageId: 'home', nodeId: 'name', target: { parentId: 'section', index: 1 } },
        { type: 'node.remove', pageId: 'home', nodeId: removedId },
      ],
    }, { registry })
    expect(result.diagnostics).toEqual([])
    expect(result.success && result.changed).toBe(true)
    if (!result.success)
      return
    expect(parseProjectDocument(result.document).success).toBe(true)
    expect(result.document.pagesById.home!.graph.nodesById).not.toHaveProperty(removedId)
    expect(result.changedNodeChanges).toContainEqual(expect.objectContaining({ kind: 'remove', pageId: 'home', nodeId: 'name' }))
    const undone = applyProjectTransaction(result.document, result.inverse, { registry })
    expect(undone.success).toBe(true)
    expect(undone.document).toEqual(initial.document)
    expect(initial.document).toEqual(original)
    expect(Reflect.set(result.changedNodeChanges[0]!, 'kind', 'move')).toBe(false)
  })

  it('still validates the final placement when a moved node is removed and reinserted', () => {
    const registry = createComponentContractRegistry([
      { ...inputContract, allowedParents: [{ component: 'element.section', slot: 'default' }] },
      sectionContract,
    ], { adapter: 'element-plus', version: '2.9.1' })
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'move-remove-invalid-reinsert',
      label: 'Move, remove and reinsert at invalid root',
      operations: [
        { type: 'node.move', pageId: 'home', nodeId: 'name', target: { parentId: null, index: 1 } },
        { type: 'node.remove', pageId: 'home', nodeId: 'name' },
        { type: 'node.insert', pageId: 'home', subgraph: { root: [{ nodeId: 'name', placement: {} }], nodesById: { name: fieldNode('name') } }, target: { parentId: null } },
      ],
    }, { registry })
    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe('PROJECT_COMPONENT_PARENT_INVALID')
  })

  it.each([false, true])('keeps distinct NUL-qualified changes and their first-seen order (reverse=%s)', (reverse) => {
    const registry = componentRegistry()
    const document = projectDocument(registry.lock)
    const targets = [{ pageId: 'a', nodeId: 'b\u0000c' }, { pageId: 'a\u0000b', nodeId: 'c' }]
    targets.forEach(({ pageId, nodeId }, index) => {
      document.pageOrder.push(pageId)
      document.pagesById[pageId] = {
        id: pageId,
        name: `Page ${index}`,
        route: `/nul-${index}`,
        graph: { version: PAGE_GRAPH_VERSION, props: {}, form: {}, root: [{ nodeId, placement: {} }], nodesById: { [nodeId]: fieldNode(nodeId) } },
      }
    })
    expect(parseProjectDocument(document).success).toBe(true)
    const initial = createProjectSnapshot(document, 1)
    const original = structuredClone(initial.document)
    const ordered = reverse ? [...targets].reverse() : targets
    const operations: ProjectOperation[] = [...ordered, ordered[0]!].map(({ pageId, nodeId }, index) => ({
      type: 'node.props',
      pageId,
      nodeId,
      props: { placeholder: `Edit ${index}` },
    }))
    const result = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'nul-changes',
      label: 'NUL changes',
      operations,
    }, { registry })
    expect(result.success && result.changed).toBe(true)
    if (!result.success)
      return
    expect(result.changedNodeChanges).toEqual(ordered.map(target => ({ kind: 'content', ...target })))
    expect(result.changedPageIds).toEqual(ordered.map(target => target.pageId))
    expect(result.changedNodeIds).toEqual(ordered.map(target => target.nodeId))
    expect(result.document.pagesById.home).toBe(initial.document.pagesById.home)
    const undone = applyProjectTransaction(result.document, result.inverse, { registry })
    expect(undone.success).toBe(true)
    expect(undone.document).toEqual(initial.document)
    expect(initial.document).toEqual(original)
    expect(Reflect.set(result.changedNodeChanges[0]!, 'nodeId', 'changed')).toBe(false)
  })

  it('publishes complete node changes when a page is removed and replaced', () => {
    const registry = componentRegistry()
    const document = projectDocument(registry.lock)
    document.pageOrder.push('billing')
    document.pagesById.billing = { ...structuredClone(document.pagesById.home!), id: 'billing', route: '/billing' }
    const initial = createProjectSnapshot(document, 1)
    const replacement = structuredClone(document.pagesById.home!)
    replacement.graph.nodesById = { section: layoutNode('section', ['other']), other: fieldNode('other') }
    const result = applyProjectTransaction(initial.document as ProjectDocument, {
      id: 'replace-page',
      label: 'Replace page',
      operations: [
        { type: 'page.remove', pageId: 'home' },
        { type: 'page.add', page: replacement, index: 0 },
        { type: 'project.home', pageId: 'home' },
      ],
    }, { registry })
    expect(result.success && result.changed).toBe(true)
    if (!result.success)
      return
    expect(result.changedNodeChanges).toEqual([
      { kind: 'content', pageId: 'home', nodeId: 'section', before: { parentId: null, slot: null }, after: { parentId: null, slot: null } },
      { kind: 'remove', pageId: 'home', nodeId: 'name', before: { parentId: 'section', slot: 'default' } },
      { kind: 'insert', pageId: 'home', nodeId: 'other', after: { parentId: 'section', slot: 'default' } },
    ])
    expect(result.changedNodeIds).toEqual(['section', 'name', 'other'])
    expect(result.changedPageIds).toEqual(['home'])
    expect(result.document.pagesById.billing).toBe(initial.document.pagesById.billing)
    replacement.graph.nodesById.other!.props.placeholder = 'Mutated input'
    expect(result.document.pagesById.home!.graph.nodesById.other!.props).toEqual({})
    const undone = applyProjectTransaction(result.document, result.inverse, { registry })
    expect(undone.success).toBe(true)
    expect(undone.document).toEqual(initial.document)
  })

  it('does not commit a multi-operation transaction whose final state is unchanged', () => {
    const initial = projectDocument()
    const result = applyProjectTransaction(initial, {
      id: 'cancelled-edit',
      label: 'Cancelled edit',
      operations: [
        { type: 'page.rename', pageId: 'home', name: 'Landing' },
        { type: 'page.rename', pageId: 'home', name: 'Home' },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changed).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.inverse.operations).toEqual([])
    expect(initial.pagesById.home?.name).toBe('Home')
  })

  it('normalizes operation payloads before they enter the project document', () => {
    const initial = projectDocument()
    const result = applyProjectTransaction(initial, {
      id: 'normalized-payload',
      label: 'Normalize payload',
      operations: [{
        type: 'node.bindings',
        pageId: 'home',
        nodeId: 'name',
        bindings: { value: { source: '  profile.name  ' } },
      }],
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.document.pagesById.home?.graph.nodesById.name).toMatchObject({
      bindings: { value: { source: 'profile.name' } },
    })
    expect(initial.pagesById.home?.graph.nodesById.name).toMatchObject({
      bindings: {},
    })
  })

  it('rejects old Registry snapshots and removed component event contracts', () => {
    const snapshot = createRegistryContractSnapshot(componentRegistry())
    const oldVersion = structuredClone(snapshot) as unknown as { version: number }
    oldVersion.version = REGISTRY_CONTRACT_SNAPSHOT_VERSION - 1
    expect(parseRegistryContractSnapshot(oldVersion).success).toBe(false)

    const legacyEvents = structuredClone(snapshot) as unknown as {
      components: Array<{ contract: Record<string, unknown> }>
    }
    legacyEvents.components[0]!.contract.events = []
    expect(parseRegistryContractSnapshot(legacyEvents).success).toBe(false)
  })

  it('removes one stored config item from a Registry-stale document and restores it with undo', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const node = initial.pagesById.home!.graph.nodesById.name!
    node.bindings = {
      'stale.keep': { source: 'stale.keep', args: { nested: [1, 2] } },
      'stale.remove': { source: 'stale.remove', args: { exact: true } },
    }
    const engine = createProjectDomainEngine({ document: initial, registry })

    const ordinaryRemoval = engine.execute({
      id: 'ordinary-stale-removal',
      label: 'Ordinary stale removal',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'node.bindings',
          pageId: 'home',
          nodeId: 'name',
          bindings: { 'stale.keep': node.bindings['stale.keep']! },
        }],
      }],
    })
    expect(ordinaryRemoval.changed).toBe(false)
    expect(ordinaryRemoval.diagnostics[0]?.code).toBe('PROJECT_COMPONENT_BINDING_UNKNOWN')

    const removed = engine.execute({
      id: 'remove-one-stale-config',
      label: 'Remove stored configuration',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'node.config.remove',
          pageId: 'home',
          nodeId: 'name',
          property: 'bindings',
          key: 'stale.remove',
        }],
      }],
    })
    expect(removed.changed).toBe(true)
    expect(removed.diagnostics).toEqual([])
    expect(removed.snapshot.document.pagesById.home?.graph.nodesById.name).toMatchObject({
      bindings: { 'stale.keep': { source: 'stale.keep', args: { nested: [1, 2] } } },
    })

    const undone = engine.undo()
    expect(undone.changed).toBe(true)
    expect(undone.diagnostics).toEqual([])
    expect(undone.snapshot.document.pagesById.home?.graph.nodesById.name?.bindings).toEqual(node.bindings)

    const redone = engine.redo()
    expect(redone.changed).toBe(true)
    expect(redone.snapshot.document.pagesById.home?.graph.nodesById.name?.bindings).toEqual({
      'stale.keep': { source: 'stale.keep', args: { nested: [1, 2] } },
    })
  })

  it('keeps stored config removal isolated from ordinary edits and history merging', () => {
    const initial = projectDocument()
    initial.pagesById.home!.graph.nodesById.name!.bindings = {
      stale: { source: 'stale' },
    }
    const removal = {
      type: 'node.config.remove' as const,
      pageId: 'home',
      nodeId: 'name',
      property: 'bindings' as const,
      key: 'stale',
    }

    const mixed = applyProjectTransaction(initial, {
      id: 'mixed-config-removal',
      label: 'Mixed config removal',
      operations: [removal, { type: 'page.rename', pageId: 'home', name: 'Landing' }],
    })
    expect(mixed.success).toBe(false)
    expect(mixed.diagnostics[0]?.code).toBe('PROJECT_NODE_CONFIG_REMOVE_MIXED')

    const merged = applyProjectTransaction(initial, {
      id: 'merged-config-removal',
      label: 'Merged config removal',
      mergeKey: 'repair',
      operations: [removal],
    })
    expect(merged.success).toBe(false)
    expect(merged.diagnostics[0]?.code).toBe('PROJECT_NODE_CONFIG_REMOVE_MERGE_INVALID')
  })

  it.each([
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KEY_REQUIRED',
      operation: { property: 'bindings', key: '   ', nodeId: 'name' },
    },
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KEY_INVALID',
      operation: { property: 'bindings', key: '__proto__', nodeId: 'name' },
    },
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KEY_INVALID',
      operation: { property: 'bindings', key: 'constructor', nodeId: 'name' },
    },
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KEY_INVALID',
      operation: { property: 'conditions', key: 'prototype', nodeId: 'name' },
    },
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KEY_UNEXPECTED',
      operation: { property: 'validation', key: 'nested', nodeId: 'name' },
    },
    {
      code: 'PROJECT_NODE_CONFIG_REMOVE_KIND_INVALID',
      operation: { property: 'validateOn', nodeId: 'section' },
    },
  ] as Array<{
    code: string
    operation: Pick<Extract<ProjectOperation, { type: 'node.config.remove' }>, 'key' | 'nodeId' | 'property'>
  }>)('rejects invalid stored config removal with $code', ({ code, operation }) => {
    const initial = projectDocument()
    const result = applyProjectTransaction(initial, {
      id: `invalid-config-removal-${code}`,
      label: 'Invalid stored config removal',
      operations: [{
        type: 'node.config.remove',
        pageId: 'home',
        ...operation,
      }],
    })

    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe(code)
  })

  it('treats removal of an absent stored config path as a semantic no-op', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'absent-config-removal',
      label: 'Remove absent stored configuration',
      operations: [{
        type: 'node.config.remove',
        pageId: 'home',
        nodeId: 'name',
        property: 'bindings',
        key: 'missing',
      }],
    }, { registry })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changed).toBe(false)
    expect(result.document).toBe(initial)
  })

  it('preserves document identity for a semantic no-op', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'noop',
      label: 'No-op',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Home' }],
    }, { registry })
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.changed).toBe(false)
    expect(result.document).toBe(initial)
  })

  it('restores a removed home page and its home-page identity', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    initial.pagesById.settings = {
      ...structuredClone(initial.pagesById.home!),
      id: 'settings',
      name: 'Settings',
      route: '/settings',
    }
    initial.pageOrder.push('settings')
    const removed = applyProjectTransaction(initial, {
      id: 'remove-home',
      label: 'Remove home',
      operations: [{ type: 'page.remove', pageId: 'home' }],
    }, { registry })
    expect(removed.success).toBe(true)
    if (!removed.success)
      return
    expect(removed.document.homePageId).toBe('settings')

    const restored = applyProjectTransaction(removed.document, removed.inverse, { registry })
    expect(restored.success).toBe(true)
    if (!restored.success)
      return
    expect(restored.document.pageOrder).toEqual(['home', 'settings'])
    expect(restored.document.homePageId).toBe('home')
    expect(restored.document.pagesById.home).toEqual(initial.pagesById.home)
  })

  it('rejects used component contract drift and unregistered properties atomically', () => {
    const registry = componentRegistry()
    const drifted = projectDocument({
      ...registry.lock,
      components: {
        ...registry.lock.components,
        'element.input': {
          ...registry.lock.components['element.input']!,
          fingerprint: 'fnv1a:stale',
        },
      },
    })
    const lockResult = applyProjectTransaction(drifted, {
      id: 'rename',
      label: 'Rename',
      operations: [{ type: 'page.rename', pageId: 'home', name: 'Landing' }],
    }, { registry })
    expect(lockResult.success).toBe(false)
    expect(lockResult.diagnostics[0]?.code).toBe('PROJECT_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH')

    const initial = projectDocument(registry.lock)
    const propResult = applyProjectTransaction(initial, {
      id: 'invalid-prop',
      label: 'Invalid prop',
      operations: [{
        type: 'node.props',
        pageId: 'home',
        nodeId: 'name',
        props: { unsupported: true },
      }],
    }, { registry })
    expect(propResult.success).toBe(false)
    expect(propResult.document).toBe(initial)
    expect(propResult.diagnostics[0]?.code).toBe('PROJECT_COMPONENT_PROP_UNKNOWN')
  })

  it('rejects a component that requires a parent when inserted at the root', () => {
    const childRegistry = createComponentContractRegistry([
      sectionContract,
      {
        ...inputContract,
        allowedParents: [{ component: 'element.section', slot: 'default' }],
      },
    ], { adapter: 'element-plus', version: '2.9.1' })
    const initial = projectDocument(childRegistry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'invalid-root',
      label: 'Invalid root',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'name',
        target: { parentId: null, index: 1 },
      }],
    }, { registry: childRegistry })
    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe('PROJECT_COMPONENT_PARENT_INVALID')
  })

  it('returns a diagnostic instead of throwing for an unregistered inserted component', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'insert-unknown',
      label: 'Insert unknown component',
      operations: [{
        type: 'node.insert',
        pageId: 'home',
        target: { parentId: null },
        subgraph: {
          root: [{ nodeId: 'unknown', placement: {} }],
          nodesById: {
            unknown: {
              id: 'unknown',
              component: 'element.unknown',
              kind: 'field',
              field: 'unknown',
              props: {},
              bindings: {},
            },
          },
        },
      }],
    }, { registry })

    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe('PROJECT_COMPONENT_UNKNOWN')
  })

  it('rejects prototype-sensitive target slots without mutating the graph', () => {
    const registry = componentRegistry()
    const initial = projectDocument(registry.lock)
    const result = applyProjectTransaction(initial, {
      id: 'unsafe-slot',
      label: 'Unsafe slot',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'name',
        target: { parentId: 'section', slot: '__proto__', index: 0 },
      }],
    }, { registry })

    expect(result.success).toBe(false)
    expect(result.document).toBe(initial)
    expect(result.diagnostics[0]?.code).toBe('PROJECT_TARGET_SLOT_INVALID')
    expect(initial.pagesById.home?.graph.nodesById.section).toMatchObject({
      slots: { default: [{ nodeId: 'name', placement: {} }] },
    })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})

describe('projectHistory', () => {
  it('moves nodes at root, list end, across containers, and into three-level nesting with one reversible revision', () => {
    const registry = componentRegistry()
    const cases = [
      {
        id: 'move-root',
        nodeId: 'root-last',
        target: { parentId: null, index: 0 } as const,
        expected: { root: ['root-last', 'root-first', 'outer', 'sibling-container'] },
      },
      {
        id: 'move-list-end',
        nodeId: 'root-first',
        target: { parentId: 'outer', slot: 'default', index: 2 } as const,
        expected: { parentId: 'outer', slot: ['outer-field', 'middle', 'root-first'] },
      },
      {
        id: 'move-cross-container',
        nodeId: 'outer-field',
        target: { parentId: 'sibling-container', slot: 'default', index: 1 } as const,
        expected: { parentId: 'sibling-container', slot: ['sibling-field', 'outer-field'] },
      },
      {
        id: 'move-three-level',
        nodeId: 'root-first',
        target: { parentId: 'inner', slot: 'default', index: 1 } as const,
        expected: { parentId: 'inner', slot: ['deep-field', 'root-first'] },
      },
    ]

    for (const testCase of cases) {
      const initial = dragSortDocument(registry.lock)
      const engine = createProjectDomainEngine({ document: initial, registry })
      const moved = engine.execute({
        id: testCase.id,
        label: 'Move component',
        actions: [{
          type: 'operation.apply',
          operations: [{
            type: 'node.move',
            pageId: 'home',
            nodeId: testCase.nodeId,
            target: testCase.target,
          }],
        }],
      })

      expect(moved.changed, testCase.id).toBe(true)
      expect(moved.snapshot.editVersion, testCase.id).toBe(1)
      expect(moved.snapshot.history).toMatchObject({
        entries: [{ label: 'Move component' }],
        position: 1,
      })
      const graph = moved.snapshot.document.pagesById.home!.graph
      if ('root' in testCase.expected) {
        expect(graph.root.map(item => item.nodeId), testCase.id).toEqual(testCase.expected.root)
      }
      else {
        const parent = graph.nodesById[testCase.expected.parentId]
        expect(parent?.kind, testCase.id).toBe('layout')
        if (parent?.kind === 'layout') {
          expect(parent.slots.default?.map(item => item.nodeId), testCase.id)
            .toEqual(testCase.expected.slot)
        }
      }

      const undone = engine.undo()
      expect(undone.changed, testCase.id).toBe(true)
      expect(undone.snapshot.editVersion, testCase.id).toBe(2)
      expect(undone.snapshot.history.position, testCase.id).toBe(0)
      expect(undone.snapshot.document, testCase.id).toEqual(initial)
    }
  })

  it('publishes a bounded immutable timeline with stable entries and deterministic branches', () => {
    const registry = componentRegistry()
    let now = 1_000
    const engine = createProjectDomainEngine({
      document: projectDocument(registry.lock),
      historyLimit: 2,
      nowMs: () => now,
      registry,
    })
    const initialCursor = engine.snapshot.cursor
    const edit = (id: string, label: string) => engine.execute({
      id,
      label,
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: 'name',
        patch: { set: { label } },
      }],
    })

    edit('rename-a', 'Rename A')
    now = 2_000
    edit('rename-b', 'Rename B')
    now = 3_000
    edit('rename-c', 'Rename C')
    expect(engine.snapshot.history).toEqual({
      entries: [
        { id: 'local-history-2', label: 'Rename B', editVersion: 2, timestamp: 2_000 },
        { id: 'local-history-3', label: 'Rename C', editVersion: 3, timestamp: 3_000 },
      ],
      limit: 2,
      position: 2,
    })
    expect(Object.isFrozen(engine.snapshot.history)).toBe(true)
    expect(Object.isFrozen(engine.snapshot.history.entries)).toBe(true)
    expect(Object.isFrozen(engine.snapshot.history.entries[0])).toBe(true)

    engine.undo()
    expect(engine.snapshot.history.position).toBe(1)
    engine.undo()
    expect(engine.snapshot.history).toMatchObject({
      entries: [
        { id: 'local-history-2', editVersion: 2, timestamp: 2_000 },
        { id: 'local-history-3', editVersion: 3, timestamp: 3_000 },
      ],
      position: 0,
    })
    expect(engine.snapshot.cursor).not.toBe(initialCursor)

    now = 6_000
    engine.redo()
    engine.redo()
    expect(engine.snapshot.history).toMatchObject({
      entries: [
        { id: 'local-history-2', editVersion: 2, timestamp: 2_000 },
        { id: 'local-history-3', editVersion: 3, timestamp: 3_000 },
      ],
      position: 2,
    })

    engine.undo()
    now = 7_000
    edit('rename-d', 'Rename D')
    expect(engine.snapshot.canRedo).toBe(false)
    expect(engine.snapshot.history).toMatchObject({
      entries: [
        { id: 'local-history-2', label: 'Rename B' },
        { id: 'local-history-4', label: 'Rename D' },
      ],
      position: 2,
    })
  })

  it('keeps entry identities and cursors distinct when a command id matches a merged transaction id', () => {
    const registry = componentRegistry()
    const engine = createProjectDomainEngine({ document: projectDocument(registry.lock), registry })
    const edit = (id: string, label: string, value: string, mergeKey?: string) => engine.execute({
      id,
      label,
      ...(mergeKey ? { mergeKey } : {}),
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: 'name',
        patch: { set: { label: value } },
      }],
    })

    edit('a', 'Rename A', 'A', 'rename')
    edit('b', 'Rename B', 'B', 'rename')
    const merged = engine.snapshot
    expect(merged.history.entries).toHaveLength(1)
    engine.sealHistoryGroup()
    expect(engine.snapshot.history.entries[0]?.id).toBe(merged.history.entries[0]?.id)

    edit('a+b', 'Direct collision', 'C')
    const collided = engine.snapshot
    expect(collided.history.entries).toHaveLength(2)
    expect(new Set(collided.history.entries.map(entry => entry.id)).size).toBe(2)
    expect(collided.cursor).not.toBe(merged.cursor)

    expect(engine.undo().snapshot.cursor).toBe(merged.cursor)
    const redone = engine.redo().snapshot
    expect(redone.cursor).toBe(collided.cursor)
    expect(redone.history.entries.map(entry => entry.id))
      .toEqual(collided.history.entries.map(entry => entry.id))
  })

  it('merges matching transactions and undoes them as one semantic edit', () => {
    const registry = componentRegistry()
    let history = createProjectHistory(projectDocument(registry.lock), {
      mergeWindowMs: 500,
    })
    const initialContentHash = history.snapshot.contentHash
    expect(history.snapshot.editVersion).toBe(0)
    const first = applyProjectHistoryTransaction(history, {
      id: 'label-1',
      label: 'Edit label',
      mergeKey: 'node:name:label',
      operations: [{
        type: 'node.settings',
        pageId: 'home',
        nodeId: 'name',
        settings: {
          kind: 'field',
          component: 'element.input',
          field: 'name',
          label: 'N',
        },
      }],
    }, { registry, nowMs: () => 1000 })
    expect(first.changed).toBe(true)
    expect(first.history.snapshot.editVersion).toBe(1)
    history = first.history
    const second = applyProjectHistoryTransaction(history, {
      id: 'label-2',
      label: 'Edit label',
      mergeKey: 'node:name:label',
      operations: [{
        type: 'node.settings',
        pageId: 'home',
        nodeId: 'name',
        settings: {
          kind: 'field',
          component: 'element.input',
          field: 'name',
          label: 'Name updated',
        },
      }],
    }, { registry, nowMs: () => 1200 })
    expect(second.history.past).toHaveLength(1)
    expect(second.history.snapshot.editVersion).toBe(2)
    expect(second.history.past[0]).toMatchObject({
      editVersion: 2,
      contentHash: second.history.snapshot.contentHash,
    })
    expect(second.history.snapshot.document.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name updated' })

    const undone = undoProjectHistory(second.history, { registry })
    expect(undone.changed).toBe(true)
    expect(undone.history.snapshot.editVersion).toBe(3)
    expect(undone.history.snapshot.contentHash).toBe(initialContentHash)
    expect(undone.history.snapshot.document.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name' })
    expect(undone.history.future).toHaveLength(1)

    const redone = redoProjectHistory(undone.history, { registry })
    expect(redone.changed).toBe(true)
    expect(redone.history.snapshot.editVersion).toBe(4)
    expect(redone.history.snapshot.contentHash).toBe(second.history.snapshot.contentHash)
    expect(redone.history.snapshot.document.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name updated' })
    expect(redone.history.future).toHaveLength(0)
  })

  it('preserves history and edit version after a failed transaction', () => {
    const registry = componentRegistry()
    const history = createProjectHistory(projectDocument(registry.lock))
    const failed = applyProjectHistoryTransaction(history, {
      id: 'invalid',
      label: 'Invalid',
      operations: [{ type: 'page.remove', pageId: 'home' }],
    }, { registry })
    expect(failed.changed).toBe(false)
    expect(failed.history).toBe(history)
    expect(failed.history.snapshot.editVersion).toBe(0)
    expect(failed.history.snapshot.contentHash).toBe(history.snapshot.contentHash)
    expect(failed.history.past).toHaveLength(0)
  })
})
