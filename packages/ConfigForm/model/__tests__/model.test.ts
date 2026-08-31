import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type {
  ComponentContract,
  ProjectDocument,
  RegistryLock,
} from '../index'
import { CONFIG_FORM_FLOW_VERSION } from '@moluoxixi/config-form-core'
import { describe, expect, it } from 'vitest'
import {
  applyProjectDraftTransaction,
  applyProjectHistoryTransaction,
  applyProjectTransaction,
  ComponentContractRegistryError,
  createComponentContractRegistry,
  createProjectDomainEngine,
  createProjectDraftSnapshot,
  createProjectHistory,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  parseProjectCompilationSnapshot,
  parseProjectDocument,
  parseProjectDraftSnapshot,
  parseProjectSnapshot,
  parseRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  redoProjectHistory,
  resolveProjectCommand,
  undoProjectHistory,
} from '../index'

function pageFlow(id = 'mounted', field?: string): ConfigFormFlow {
  return {
    version: CONFIG_FORM_FLOW_VERSION,
    id,
    name: id,
    trigger: field ? { kind: 'field.change', field } : { kind: 'page.mount' },
    nodes: [
      { id: 'trigger', type: 'trigger' },
      { id: 'success', type: 'success' },
    ],
    edges: [{ id: `${id}-edge`, source: 'trigger', target: 'success' }],
  }
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
        graph: {
          version: 2,
          props: {},
          form: {},
          root: [{ nodeId: 'section', placement: {} }],
          nodesById: {
            section: {
              id: 'section',
              component: 'element.section',
              kind: 'layout',
              props: {},
              events: {},
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
              events: {},
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
    version: 2,
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
    events: {},
    bindings: {},
  }
}

function layoutNode(id: string, childIds: string[]) {
  return {
    id,
    component: 'element.section',
    kind: 'layout' as const,
    props: {},
    events: {},
    bindings: {},
    slots: { default: childIds.map(nodeId => ({ nodeId, placement: {} })) },
  }
}

const inputContract: ComponentContract = {
  key: 'element.input',
  version: '1',
  kind: 'field',
  props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
  events: [],
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
  events: [],
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
      events: {},
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
      events: {},
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

  it('owns flows at the page boundary and validates their field references against the page graph', () => {
    const source = projectDocument()
    source.pagesById.home!.flows = [pageFlow('name-change', 'name')]
    expect(parseProjectDocument(source).success).toBe(true)

    source.pagesById.home!.flows = [pageFlow('missing-change', 'missing')]
    const missing = parseProjectDocument(source)
    expect(missing.success).toBe(false)
    if (!missing.success) {
      expect(missing.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('unknown field'),
          path: ['pagesById', 'home', 'flows', 0, 'trigger', 'field'],
        }),
      ]))
    }

    const invalidGraphOwner = projectDocument() as ProjectDocument & {
      pagesById: Record<string, ProjectDocument['pagesById'][string] & { graph: { flows?: ConfigFormFlow[] } }>
    }
    invalidGraphOwner.pagesById.home!.graph.flows = [pageFlow()]
    expect(parseProjectDocument(invalidGraphOwner).success).toBe(false)
  })

  it('validates component event flow triggers against the normalized page graph', () => {
    const source = projectDocument()
    source.pagesById.home!.flows = [{
      ...pageFlow('name-event'),
      trigger: { kind: 'component.event', nodeId: 'name', event: 'change' },
    }]
    expect(parseProjectDocument(source).success).toBe(true)

    source.pagesById.home!.flows[0]!.trigger = {
      kind: 'component.event',
      nodeId: 'missing',
      event: 'change',
    }
    const invalid = parseProjectDocument(source)
    expect(invalid.success).toBe(false)
    if (!invalid.success)
      expect(invalid.diagnostics.some(item => item.message.includes('unknown node'))).toBe(true)
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
      events: [{ name: 'update:modelValue' }],
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

  it('reports recoverable contract migrations and applies a deterministic chain', () => {
    const registry = createComponentContractRegistry([{
      ...inputContract,
      version: '3',
    }], {
      adapter: 'element-plus',
      version: '2.9.1',
      migrations: [
        {
          component: 'element.input',
          fromVersion: '1',
          toVersion: '2',
          migrate: node => ({ ...node, props: { ...node.props, clearable: true } }),
        },
        {
          component: 'element.input',
          fromVersion: '2',
          toVersion: '3',
          migrate: node => ({ ...node, props: { ...node.props, placeholder: 'Migrated' } }),
        },
      ],
    })
    const previousLock = componentRegistry().lock
    expect(registry.analyzeLock(previousLock)).toMatchObject([{
      code: 'MODEL_REGISTRY_COMPONENT_MIGRATION_REQUIRED',
      path: ['components', 'element.input', 'contractVersion'],
    }, {
      code: 'MODEL_REGISTRY_COMPONENT_MISSING',
      path: ['components', 'element.section'],
    }])

    const migrated = registry.migrateNode(projectDocument().pagesById.home!.graph.nodesById.name!, '1')
    expect(migrated).toMatchObject({
      success: true,
      fromVersion: '1',
      toVersion: '3',
      appliedVersions: ['2', '3'],
      node: { props: { clearable: true, placeholder: 'Migrated' } },
    })
  })

  it('rejects ambiguous and non-deterministic component migration chains', () => {
    expect(() => createComponentContractRegistry([inputContract], {
      adapter: 'element-plus',
      version: '2.9.1',
      migrations: [
        { component: 'element.input', fromVersion: '0', toVersion: '1', migrate: node => node },
        { component: 'element.input', fromVersion: '0', toVersion: '2', migrate: node => node },
      ],
    })).toThrowError(/Multiple migrations/)

    const registry = createComponentContractRegistry([inputContract], {
      adapter: 'element-plus',
      version: '2.9.1',
      migrations: [{
        component: 'element.input',
        fromVersion: '0',
        toVersion: '1',
        migrate: node => ({ ...node, props: { ...node.props, nonce: Math.random() } }),
      }],
    })
    expect(registry.migrateNode(projectDocument().pagesById.home!.graph.nodesById.name!, '0'))
      .toMatchObject({
        success: false,
        diagnostics: [{ code: 'MODEL_COMPONENT_MIGRATION_NON_DETERMINISTIC' }],
      })
  })
})

describe('projectTransaction', () => {
  it('applies page-owned Flow changes with semantic inverse and rejects dangling field triggers', () => {
    const initial = projectDocument()
    const added = applyProjectTransaction(initial, {
      id: 'add-name-flow',
      label: 'Add name flow',
      operations: [{ type: 'flow.add', pageId: 'home', flow: pageFlow('name-change', 'name') }],
    })
    expect(added.success).toBe(true)
    if (!added.success)
      return
    expect(added.document.pagesById.home?.flows?.map(flow => flow.id)).toEqual(['name-change'])
    expect(added.document.pagesById.home?.graph).not.toHaveProperty('flows')

    const dangling = applyProjectTransaction(added.document, {
      id: 'remove-name',
      label: 'Remove name',
      operations: [{ type: 'node.remove', pageId: 'home', nodeId: 'name' }],
    })
    expect(dangling.success).toBe(false)
    expect(dangling.document).toBe(added.document)
    expect(dangling.diagnostics[0]?.message).toContain('unknown field')

    const undone = applyProjectTransaction(added.document, added.inverse)
    expect(undone.success).toBe(true)
    if (!undone.success)
      return
    expect(undone.document.pagesById.home).not.toHaveProperty('flows')
    expect(undone.document).toEqual(initial)
  })

  it('checks component event flow triggers against the active Registry contract', () => {
    const registry = createComponentContractRegistry([
      { ...inputContract, events: [{ name: 'change' }] },
      sectionContract,
    ], { adapter: 'element-plus', version: '2.9.1' })
    const initial = projectDocument(registry.lock)
    const valid = applyProjectTransaction(initial, {
      id: 'add-component-event-flow',
      label: 'Add component event flow',
      operations: [{
        type: 'flow.add',
        pageId: 'home',
        flow: {
          ...pageFlow('name-click'),
          trigger: { kind: 'component.event', nodeId: 'name', event: 'change' },
        },
      }],
    }, { registry })
    expect(valid.success).toBe(true)

    const invalid = applyProjectTransaction(initial, {
      id: 'add-unknown-component-event-flow',
      label: 'Add unknown component event flow',
      operations: [{
        type: 'flow.add',
        pageId: 'home',
        flow: {
          ...pageFlow('name-hover'),
          trigger: { kind: 'component.event', nodeId: 'name', event: 'hover' },
        },
      }],
    }, { registry })
    expect(invalid).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_FLOW_TRIGGER_EVENT_UNKNOWN', nodeId: 'name' }],
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
      events: {},
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
                events: {},
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
              events: {},
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
      operations: [
        {
          type: 'node.events',
          pageId: 'home',
          nodeId: 'name',
          events: { change: [{ action: '  save  ' }] },
        },
        {
          type: 'node.bindings',
          pageId: 'home',
          nodeId: 'name',
          bindings: { value: { source: '  profile.name  ' } },
        },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.document.pagesById.home?.graph.nodesById.name).toMatchObject({
      events: { change: [{ action: 'save' }] },
      bindings: { value: { source: 'profile.name' } },
    })
    expect(initial.pagesById.home?.graph.nodesById.name).toMatchObject({
      events: {},
      bindings: {},
    })
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
              events: {},
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
