import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelJsonValue, PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { PAGE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  createPreviewSession,
  createWorkbenchPreviewSession,
} from '..'

interface FieldFixture {
  component?: string
  defaultValue?: ModelJsonValue
  field: string
  id: string
}

function graph(...fields: FieldFixture[]): PageGraph {
  return {
    version: PAGE_GRAPH_VERSION,
    props: {},
    form: {},
    root: fields.map(field => ({ nodeId: field.id, placement: {} })),
    nodesById: Object.fromEntries(fields.map(field => [field.id, {
      id: field.id,
      kind: 'field' as const,
      field: field.field,
      component: field.component ?? 'element.input',
      props: {},
      bindings: {},
      ...(field.defaultValue === undefined ? {} : { defaultValue: field.defaultValue }),
    }])),
  }
}

function compilation(options: {
  componentFingerprint?: string
  editVersion?: number
  pageId?: string
  projectId?: string
} = {}): PageCompilation {
  const editVersion = options.editVersion ?? 0
  const pageId = options.pageId ?? 'home'
  const projectId = options.projectId ?? 'project'
  return {
    snapshotIdentity: {
      source: 'committed',
      projectId,
      pageId,
      contentHash: `fnv1a:${projectId}:${editVersion}`,
      editVersion,
    },
    registryUsage: [{
      key: 'element.input',
      contractVersion: '1',
      fingerprint: options.componentFingerprint ?? 'fnv1a:element-input-v1',
    }],
    key: {
      irVersion: CANONICAL_PROJECT_IR_VERSION,
      projectId,
      pageId,
      registryAdapter: 'element-plus',
      registryAdapterVersion: '1',
      registryUsageHash: 'fnv1a:usage',
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash: 'fnv1a:environment',
      semanticHash: `fnv1a:${pageId}:${editVersion}`,
    },
    page: {
      id: pageId,
      name: pageId,
      route: `/${pageId}`,
      props: {},
      form: {},
      rootIds: [],
      nodesById: {},
      valueScopes: [],
      scopedFields: [],
    },
  }
}

function success(value: PageCompilation): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: value.key,
      pageId: value.page.id,
      renderer: {
        fields: [],
        plan: {
          valueSchema: { valueScopes: [], scopedFields: [] },
          runtime: { variables: [], dataSources: [] },
          optionBindings: [],
        },
      },
    },
    diagnostics: [],
  }
}

const failure: VueRuntimeCompileResult = {
  success: false,
  diagnostics: [{ code: 'TEST', message: 'compile failed', path: [], severity: 'error' }],
}

function accept(
  session: ReturnType<typeof createPreviewSession>,
  options: {
    compilation?: PageCompilation
    editVersion?: number
    graph?: PageGraph
    pageId?: string
    projectId?: string
    runtime?: VueRuntimeCompileResult
  } = {},
) {
  const editVersion = options.editVersion ?? 0
  const pageId = options.pageId ?? 'home'
  const projectId = options.projectId ?? 'project'
  const pageCompilation = options.compilation ?? compilation({ editVersion, pageId, projectId })
  return session.accept({
    adapter: 'element-plus',
    compilation: pageCompilation,
    editVersion,
    graph: options.graph ?? graph({ id: 'name', field: 'name', defaultValue: 'Default' }),
    pageId,
    projectId,
    repositoryRevision: 4,
    runtime: options.runtime ?? success(pageCompilation),
  })
}

function runtimeIdentity(
  projection: NonNullable<ReturnType<typeof accept>>,
  hostId: string,
) {
  return {
    hostId,
    pageId: projection.current.pageId,
    projectId: projection.current.projectId,
    revision: projection.current.revisionKey,
  }
}

describe('preview session', () => {
  it('preserves values only while the field identity and component contract stay compatible', () => {
    const session = createWorkbenchPreviewSession()
    accept(session, {
      graph: graph(
        { id: 'name', field: 'name', defaultValue: 'Initial' },
        { id: 'age', field: 'age', component: 'element.input-number', defaultValue: 18 },
      ),
    })
    session.updateRuntimeModel({ name: 'Edited', age: 42 })

    accept(session, {
      editVersion: 1,
      graph: graph(
        { id: 'name', field: 'name', defaultValue: 'Changed default' },
        { id: 'age', field: 'age', component: 'element.date', defaultValue: '2026-08-31' },
        { id: 'city', field: 'city', defaultValue: 'Shanghai' },
      ),
    })

    expect(session.getRuntimeModel()).toEqual({
      name: 'Edited',
      age: '2026-08-31',
      city: 'Shanghai',
    })
    session.dispose()
  })

  it('resets a field when its registered component contract changes under the same key', () => {
    const session = createWorkbenchPreviewSession()
    accept(session)
    session.updateRuntimeModel({ name: 'Edited' })
    const upgraded = compilation({
      componentFingerprint: 'fnv1a:element-input-v2',
      editVersion: 1,
    })

    accept(session, { compilation: upgraded, editVersion: 1 })

    expect(session.getRuntimeModel()).toEqual({ name: 'Default' })
    session.dispose()
  })

  it('reconciles field state and accepts mirrors only from the current revision and mounted host', () => {
    const session = createWorkbenchPreviewSession()
    const first = accept(session, {
      graph: graph(
        { id: 'name', field: 'name', defaultValue: 'Initial' },
        { id: 'age', field: 'age', defaultValue: 18 },
      ),
    })!
    const firstHost = runtimeIdentity(first, 'host-a')
    session.handleRuntimeMounted(firstHost)
    session.handleRuntimeState({
      ...firstHost,
      state: { fields: flatFields('name', 'age'), values: { name: 'Edited', age: 42 }, touched: ['name', 'age'], validation: { name: ['Required'], age: ['Too young'] } },
    })
    session.handleRuntimeReady(firstHost)

    const next = accept(session, {
      editVersion: 1,
      graph: graph(
        { id: 'name', field: 'name', defaultValue: 'Changed default' },
        { id: 'age', field: 'age', component: 'element.date', defaultValue: '2026-08-31' },
      ),
    })!
    const sameHost = runtimeIdentity(next, 'host-a')

    expect(session.runtimeState.value).toEqual({ fields: flatFields('name'), values: { name: 'Edited', age: '2026-08-31' }, touched: ['name'], validation: { name: ['Required'] } })

    session.handleRuntimeState({
      ...firstHost,
      state: { fields: flatFields('name'), values: { name: 'Stale revision' }, touched: [], validation: {} },
    })
    session.handleRuntimeState({
      ...sameHost,
      state: { fields: flatFields('name'), values: { name: 'Current host' }, touched: ['name'], validation: {} },
    })
    expect(session.runtimeState.value.values.name).toBe('Current host')

    const replacementHost = runtimeIdentity(next, 'host-b')
    session.handleRuntimeMounted(replacementHost)
    session.handleRuntimeState({
      ...sameHost,
      state: { fields: flatFields('name'), values: { name: 'Old host' }, touched: [], validation: {} },
    })
    session.handleRuntimeState({
      ...replacementHost,
      state: { fields: flatFields('name'), values: { name: 'Replacement host' }, touched: [], validation: {} },
    })
    expect(session.runtimeState.value.values.name).toBe('Replacement host')
    session.handleRuntimeMounted(sameHost)
    session.handleRuntimeState({
      ...sameHost,
      state: { fields: flatFields('name'), values: { name: 'Retired host reclaim' }, touched: [], validation: {} },
    })
    expect(session.runtimeState.value.values.name).toBe('Replacement host')
    session.dispose()
  })

  it('requires and consumes a real current-host submit marker for every success result', () => {
    const session = createWorkbenchPreviewSession()
    const current = accept(session)!
    const host = runtimeIdentity(current, 'host-a')
    session.handleRuntimeMounted(host)

    session.handleSubmit({ ...host, phase: 'request', requestId: 'unmarked' })
    session.handleSubmitResult({
      ...host,
      result: { requestId: 'unmarked', fields: flatFields('name'), status: 'success', values: { name: 'Unmarked' }, touched: [], validation: {} },
    })
    expect(session.lastSubmission.value?.status).toBe('failure')

    session.handleSubmit({ ...host, phase: 'request', requestId: 'current' })
    session.handleSubmit({ ...host, phase: 'success', requestId: 'current', values: { name: 'Submitted' } })
    session.handleSubmitResult({
      ...host,
      result: { requestId: 'current', fields: flatFields('name'), status: 'success', values: { name: 'Submitted' }, touched: ['name'], validation: {} },
    })
    expect(session.lastSubmission.value).toMatchObject({
      status: 'success',
      values: { name: 'Submitted' },
      revisionKey: current.current.revisionKey,
    })

    session.handleSubmitResult({
      ...host,
      result: { requestId: 'current', fields: flatFields('name'), status: 'success', values: { name: 'Replayed' }, touched: [], validation: {} },
    })
    expect(session.lastSubmission.value).toMatchObject({ status: 'success', values: { name: 'Submitted' } })

    session.clearSubmission()
    expect(session.lastSubmission.value).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({ name: 'Submitted' })
    session.dispose()
  })

  it('keeps fallback compilation and runtime state from the last ready revision in the same scope', () => {
    const session = createPreviewSession()
    const oldCompilation = compilation()
    const first = accept(session, { compilation: oldCompilation })!
    const host = runtimeIdentity(first, 'host-a')
    session.handleRuntimeMounted(host)
    session.handleRuntimeState({
      ...host,
      state: { fields: flatFields('name'), values: { name: 'Latest input' }, touched: ['name'], validation: {} },
    })
    session.handleRuntimeReady(host)

    const failed = accept(session, {
      compilation: compilation({ editVersion: 1 }),
      editVersion: 1,
      graph: graph({ id: 'broken-name', field: 'broken', defaultValue: 'Broken graph value' }),
      runtime: failure,
    })!
    const fallbackHost = runtimeIdentity(failed, 'host-a')

    expect(session.getCompilation()).toBe(oldCompilation)
    expect(session.runtimeState.value).toEqual({ fields: flatFields('name'), values: { name: 'Latest input' }, touched: ['name'], validation: {} })

    session.handleRuntimeState({
      ...fallbackHost,
      state: { fields: flatFields('name'), values: { name: 'Edited fallback' }, touched: [], validation: {} },
    })
    expect(session.getCompilation()).toBe(oldCompilation)
    expect(session.getRuntimeModel()).toEqual({ name: 'Edited fallback' })

    accept(session, {
      compilation: compilation({ editVersion: 2 }),
      editVersion: 2,
      runtime: failure,
    })
    expect(session.getCompilation()).toBe(oldCompilation)
    expect(session.getRuntimeModel()).toEqual({ name: 'Edited fallback' })

    accept(session, {
      compilation: compilation({ editVersion: 3, pageId: 'other' }),
      editVersion: 3,
      graph: graph({ id: 'other-name', field: 'name', defaultValue: 'Other page' }),
      pageId: 'other',
      runtime: failure,
    })
    expect(session.getCompilation()).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({ name: 'Other page' })
    session.dispose()
  })

  it('does not establish a ready fallback from an unmounted or stale host', () => {
    const session = createPreviewSession()
    const current = accept(session)!
    const host = runtimeIdentity(current, 'host-a')
    session.handleRuntimeReady(host)

    accept(session, {
      compilation: compilation({ editVersion: 1 }),
      editVersion: 1,
      runtime: failure,
    })

    expect(session.getCompilation()).toBeUndefined()
    session.dispose()
  })

  it('clears mirror ownership and ignores all future RuntimeHost updates when disposed', () => {
    const session = createPreviewSession()
    const current = accept(session)!
    const host = runtimeIdentity(current, 'host-a')
    session.handleRuntimeMounted(host)
    session.dispose()

    session.handleRuntimeState({
      ...host,
      state: { fields: flatFields('name'), values: { name: 'Ignored' }, touched: ['name'], validation: { name: ['Ignored'] } },
    })
    session.handleSubmit({ ...host, phase: 'success', requestId: 'ignored', values: { name: 'Ignored' } })
    session.handleSubmitResult({
      ...host,
      result: { requestId: 'ignored', fields: flatFields('name'), status: 'success', values: { name: 'Ignored' }, touched: [], validation: {} },
    })
    session.updateRuntimeModel({ name: 'Ignored' })

    expect(session.projection.value).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({})
    expect(session.lastSubmission.value).toBeUndefined()
  })
  it('rejects unrequested, superseded same-revision, old-host and old-revision submit identities without changing the mirror', () => {
    const session = createPreviewSession()
    const host = runtimeIdentity(accept(session)!, 'host-a')
    session.handleRuntimeMounted(host)
    const result = { requestId: 'old', fields: flatFields('name'), status: 'invalid' as const, values: { name: 'stale' }, touched: ['name'], validation: { name: ['stale'] } }
    session.handleSubmitResult({ ...host, result })
    expect(session.lastSubmission.value).toBeUndefined()
    session.handleSubmit({ ...host, phase: 'request', requestId: 'old' })
    session.handleSubmit({ ...host, phase: 'request', requestId: 'new' })
    session.handleSubmit({ ...host, phase: 'success', requestId: 'old', values: result.values })
    session.handleSubmitResult({ ...host, result })
    session.handleSubmitResult({ ...host, hostId: 'old-host', result: { ...result, requestId: 'new' } })
    session.handleSubmitResult({ ...host, revision: 'old-revision', result: { ...result, requestId: 'new' } })
    expect(session.lastSubmission.value).toBeUndefined()
    expect(session.runtimeState.value.values).toEqual({ name: 'Default' })
    expect(session.runtimeState.value.touched).toEqual([])
    session.handleSubmitResult({ ...host, result: { ...result, requestId: 'new', values: { name: 'current' } } })
    expect(session.lastSubmission.value).toMatchObject({ requestId: 'new', status: 'invalid', values: { name: 'current' } })
    session.handleSubmitResult({ ...host, result: { ...result, requestId: 'new' } })
    expect(session.runtimeState.value.values).toEqual({ name: 'current' })
    session.dispose()
  })
})

function flatFields(...names: string[]) {
  return names.map(nodeId => ({ nodeId, scope: [], instanceKey: nodeId, valuePath: [nodeId] }))
}
