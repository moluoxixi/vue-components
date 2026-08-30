import type {
  ComponentContract,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import {
  CONFIG_FORM_FLOW_VERSION,
} from '@moluoxixi/config-form-core'
import {
  createComponentContractRegistry,
  createProjectDraftSnapshot,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { compileCanonicalProject } from '../index'

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
      path: ['section'],
      placement: { parentId: null, slot: null, index: 0, props: {} },
      slots: { default: ['name'] },
    })
    expect(page.nodesById.name).toMatchObject({
      component: 'element.input',
      componentVersion: '2',
      configuredProps: { placeholder: 'Your name' },
      props: { clearable: true, placeholder: 'Your name' },
      path: ['section', 'name'],
      placement: { parentId: 'section', slot: 'default', index: 0, props: { span: 12 } },
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
