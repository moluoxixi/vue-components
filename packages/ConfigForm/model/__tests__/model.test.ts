import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type {
  ComponentContract,
  LegacyLowCodeNodeV1,
  LegacyLowCodePageModelV1,
  LegacyWorkspaceApplicationV2,
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
  createProjectDraftSnapshot,
  createProjectHistory,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  migrateLegacyLowCodePageModel,
  migrateLegacyWorkspaceApplication,
  migrateProjectDocument,
  parseProjectCompilationSnapshot,
  parseProjectDocument,
  parseProjectDraftSnapshot,
  parseProjectSnapshot,
  parseRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  projectPageToLegacyLowCodePageModel,
  redoProjectHistory,
  resolveProjectCommand,
  undoProjectHistory,
} from '../index'

function legacyField(id: string): LegacyLowCodeNodeV1 {
  return {
    id,
    component: 'element.input',
    props: { placeholder: 'Name' },
    events: {},
    bindings: {},
    children: [],
    slots: {},
    kind: 'field',
    field: id,
    label: 'Name',
  }
}

function legacyPage(nodes: LegacyLowCodeNodeV1[]): LegacyLowCodePageModelV1 {
  return {
    id: 'home',
    name: 'Home',
    version: 1,
    props: {},
    form: { columns: 24, fieldSpan: 12 },
    nodes,
  }
}

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

    const legacyGraphOwner = projectDocument() as ProjectDocument & {
      pagesById: Record<string, ProjectDocument['pagesById'][string] & { graph: { flows?: ConfigFormFlow[] } }>
    }
    legacyGraphOwner.pagesById.home!.graph.flows = [pageFlow()]
    expect(parseProjectDocument(legacyGraphOwner).success).toBe(false)
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

describe('legacy migration', () => {
  it('migrates v3 graph-owned flows to the v4 ProjectPage boundary without ambiguity', () => {
    const source = projectDocument()
    source.pagesById.home!.flows = [pageFlow()]
    const legacy = structuredClone(source) as unknown as Record<string, unknown> & {
      pagesById: Record<string, Record<string, unknown> & {
        graph: Record<string, unknown>
        flows?: ConfigFormFlow[]
      }>
    }
    legacy.schemaVersion = 3
    legacy.pagesById.home!.graph.flows = legacy.pagesById.home!.flows
    delete legacy.pagesById.home!.flows

    const migrated = migrateProjectDocument(legacy)
    expect(migrated.success).toBe(true)
    if (!migrated.success)
      return
    expect(migrated.data.schemaVersion).toBe(PROJECT_DOCUMENT_VERSION)
    expect(migrated.data.pagesById.home?.flows?.map(flow => flow.id)).toEqual(['mounted'])
    expect(migrated.data.pagesById.home?.graph).not.toHaveProperty('flows')

    legacy.pagesById.home!.flows = [pageFlow('duplicate-owner')]
    expect(migrateProjectDocument(legacy)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_DOCUMENT_FLOW_OWNERSHIP_AMBIGUOUS' }],
    })
  })

  it('normalizes default and named slots without retaining tree copies', () => {
    const page = legacyPage([{
      id: 'layout',
      component: 'element.grid',
      props: {},
      events: {},
      bindings: {},
      children: [legacyField('name')],
      slots: { actions: [legacyField('submit')] },
      kind: 'container',
    }])
    page.flows = [pageFlow()]
    const result = migrateLegacyLowCodePageModel(page)
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.graph.root.map(item => item.nodeId)).toEqual(['layout'])
    expect(result.data.graph.nodesById.layout).toMatchObject({
      kind: 'layout',
      slots: { default: [{ nodeId: 'name', placement: {} }], actions: [{ nodeId: 'submit', placement: {} }] },
    })
    expect(Object.keys(result.data.graph.nodesById)).toEqual(['layout', 'name', 'submit'])
    expect(result.data.flows).toEqual(page.flows)
    expect(result.data.graph).not.toHaveProperty('flows')
  })

  it('rejects ambiguous legacy default slots and field children', () => {
    const layout: LegacyLowCodeNodeV1 = {
      id: 'layout',
      component: 'element.grid',
      props: {},
      events: {},
      bindings: {},
      children: [legacyField('one')],
      slots: { default: [legacyField('two')] },
      kind: 'container',
    }
    const field = legacyField('field')
    field.children.push(legacyField('child'))
    const result = migrateLegacyLowCodePageModel(legacyPage([layout, field]))
    expect(result.success).toBe(false)
    if (result.success)
      return
    expect(result.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
      'LEGACY_DEFAULT_SLOT_AMBIGUOUS',
      'LEGACY_FIELD_CHILDREN_INVALID',
    ]))
  })

  it('migrates an application while dropping generated files', () => {
    const application: LegacyWorkspaceApplicationV2 = {
      schemaVersion: 2,
      id: 'project',
      name: 'Project',
      revision: 5,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:01:00.000Z',
      homePageId: 'home',
      pages: [{ id: 'home', name: 'Home', route: '/', model: legacyPage([legacyField('name')]) }],
      files: { 'src/App.vue': { kind: 'text', content: '<template />' } },
      manifest: {
        adapter: 'element-plus',
        dependencies: { vue: '^3.5.0' },
        framework: 'vue',
        designerArtifact: 'form.designer.json',
        entry: 'src/main.ts',
        generatedFormModule: 'src/form.config.ts',
      },
      template: { id: 'element', version: 1 },
    }
    const result = migrateLegacyWorkspaceApplication(application, {
      registryLock: componentRegistry().lock,
    })
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.pageOrder).toEqual(['home'])
    expect(result.data.pagesById.home?.graph.root.map(item => item.nodeId)).toEqual(['name'])
    expect(result.data).not.toHaveProperty('files')
    expect(Object.keys(result.data.registryLock.components)).toEqual(['element.input'])
  })

  it('projects a normalized page to the legacy Designer boundary without changing structure', () => {
    const source = projectDocument().pagesById.home!
    source.flows = [pageFlow()]
    const legacy = projectPageToLegacyLowCodePageModel(source)
    const migrated = migrateLegacyLowCodePageModel(legacy)

    expect(legacy.nodes[0]).toMatchObject({
      id: 'section',
      kind: 'container',
      children: [{ id: 'name', kind: 'field', field: 'name' }],
    })
    expect(migrated.success).toBe(true)
    if (!migrated.success)
      return
    expect(migrated.data).toEqual({ graph: source.graph, flows: source.flows })
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
    expect(second.history.present.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name updated' })

    const undone = undoProjectHistory(second.history, { registry })
    expect(undone.changed).toBe(true)
    expect(undone.history.snapshot.editVersion).toBe(3)
    expect(undone.history.snapshot.contentHash).toBe(initialContentHash)
    expect(undone.history.present.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name' })
    expect(undone.history.future).toHaveLength(1)

    const redone = redoProjectHistory(undone.history, { registry })
    expect(redone.changed).toBe(true)
    expect(redone.history.snapshot.editVersion).toBe(4)
    expect(redone.history.snapshot.contentHash).toBe(second.history.snapshot.contentHash)
    expect(redone.history.present.pagesById.home?.graph.nodesById.name).toMatchObject({ label: 'Name updated' })
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
