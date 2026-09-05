import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlow,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type { ModelJsonValue, PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { PAGE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import {
  createPreviewSession,
  createWorkbenchPreviewSession,
} from '..'
import { createPageFlowEngine } from '../../flow'

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
      events: {},
      bindings: {},
      ...(field.defaultValue === undefined ? {} : { defaultValue: field.defaultValue }),
    }])),
  }
}

function executionPlan(flow: ConfigFormFlow): ConfigFormFlowExecutionPlan {
  const result = analyzeConfigFormFlow(flow)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Invalid Preview Session test flow.')
  return result.plan
}

function actionFlow(options: {
  actionInput?: ModelJsonValue
  input: string
  projection?: boolean
  trigger: ConfigFormFlowTrigger
}): ConfigFormFlowExecutionPlan {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'trigger', type: 'trigger' },
    {
      id: 'work',
      type: 'action',
      ref: 'notify',
      config: {
        input: options.actionInput ?? options.input,
        output: { result: { $output: 'work' } },
      },
    },
  ]
  const edges: ConfigFormFlow['edges'] = [
    { id: 'trigger-work', source: 'trigger', target: 'work', condition: 'next' },
  ]
  if (options.projection) {
    nodes.push({
      id: 'project',
      type: 'reaction',
      config: {
        reactions: [{
          id: 'show-result',
          when: { kind: 'literal', value: true },
          then: [{
            kind: 'setProps',
            target: 'result',
            props: { placeholder: { kind: 'literal', value: 'Completed' } },
          }],
        }],
      },
    })
    edges.push({ id: 'work-project', source: 'work', target: 'project', condition: 'next' })
  }
  nodes.push({ id: 'success', type: 'success' })
  edges.push({
    id: 'finish',
    source: options.projection ? 'project' : 'work',
    target: 'success',
    condition: 'next',
  })
  return executionPlan({
    version: 1,
    id: `flow-${options.input}`,
    name: `Flow ${options.input}`,
    trigger: options.trigger,
    concurrency: 'latest',
    nodes,
    edges,
  })
}

function compilation(options: {
  componentFingerprint?: string
  editVersion?: number
  pageId?: string
  plans?: readonly ConfigFormFlowExecutionPlan[]
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
      flows: (options.plans ?? []).map(plan => ({
        semanticHash: `fnv1a:${plan.flowId}`,
        plan,
      })),
    },
  }
}

function success(value: PageCompilation): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: value.key,
      pageId: value.page.id,
      plan: { renderer: { fields: [] } },
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

  it('reconciles touched and validation with compatible field contracts and rejects stale hosts', () => {
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
      state: {
        values: { name: 'Edited', age: 42 },
        touched: ['name', 'age'],
        validation: { name: ['Required'], age: ['Too young'] },
      },
    })
    session.handleRuntimeReady(firstHost)

    const next = accept(session, {
      editVersion: 1,
      graph: graph(
        { id: 'name', field: 'name', defaultValue: 'Changed default' },
        { id: 'age', field: 'age', component: 'element.date', defaultValue: '2026-08-31' },
      ),
    })!

    expect(session.runtimeState.value).toEqual({
      values: { name: 'Edited', age: '2026-08-31' },
      touched: ['name'],
      validation: { name: ['Required'] },
    })

    session.handleRuntimeState({
      ...firstHost,
      state: { values: { name: 'Stale' }, touched: [], validation: {} },
    })
    expect(session.runtimeState.value.values.name).toBe('Edited')

    const nextHost = runtimeIdentity(next, 'host-b')
    session.handleRuntimeMounted(nextHost)
    session.handleRuntimeState({
      ...nextHost,
      state: {
        values: { name: 'Reopened', age: '2026-08-31' },
        touched: ['name'],
        validation: { name: ['Still required'] },
      },
    })
    expect(session.runtimeState.value).toEqual({
      values: { name: 'Reopened', age: '2026-08-31' },
      touched: ['name'],
      validation: { name: ['Still required'] },
    })
    session.dispose()
  })

  it('captures revision-bound submit results without letting stale results or clearing reset runtime values', () => {
    const session = createWorkbenchPreviewSession()
    const first = accept(session, {
      graph: graph({ id: 'name', field: 'name', defaultValue: 'Initial' }),
    })!
    const firstHost = runtimeIdentity(first, 'host-a')
    session.handleRuntimeMounted(firstHost)
    session.handleSubmitResult({
      ...firstHost,
      result: {
        status: 'invalid',
        values: { name: '' },
        touched: ['name'],
        validation: { name: ['Required'] },
      },
    })

    expect(session.lastSubmission.value).toMatchObject({
      status: 'invalid',
      values: { name: '' },
      touched: ['name'],
      validation: { name: ['Required'] },
      revisionKey: first.current.revisionKey,
    })
    expect(session.runtimeState.value).toEqual({
      values: { name: '' },
      touched: ['name'],
      validation: { name: ['Required'] },
    })

    const next = accept(session, { editVersion: 1 })!
    expect(session.lastSubmission.value).toBeUndefined()
    session.handleSubmitResult({
      ...firstHost,
      result: {
        status: 'success',
        values: { name: 'stale' },
        touched: ['name'],
        validation: {},
      },
    })
    expect(session.lastSubmission.value).toBeUndefined()

    const nextHost = runtimeIdentity(next, 'host-b')
    session.handleRuntimeMounted(nextHost)
    session.handleSubmitResult({
      ...nextHost,
      result: {
        status: 'success',
        values: { name: 'Submitted' },
        touched: ['name'],
        validation: {},
      },
    })
    expect(session.lastSubmission.value).toMatchObject({
      status: 'success',
      values: { name: 'Submitted' },
      revisionKey: next.current.revisionKey,
    })
    session.clearSubmission()
    expect(session.lastSubmission.value).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({ name: 'Submitted' })
    session.dispose()
  })

  it('owns a bounded Flow trace and forwards trace events to diagnostics consumers', async () => {
    const onTrace = vi.fn()
    const session = createWorkbenchPreviewSession({ onTrace })
    const trigger: ConfigFormFlowTrigger = { kind: 'component.event', nodeId: 'submit', event: 'click' }
    accept(session, {
      compilation: compilation({ plans: [actionFlow({ input: 'trace', trigger })] }),
    })

    await session.dispatch(trigger)

    expect(session.trace.value.length).toBeGreaterThan(0)
    expect(session.trace.value.length).toBeLessThanOrEqual(200)
    expect(onTrace).toHaveBeenCalledTimes(session.trace.value.length)
    session.dispose()
  })

  it('updates Preview values before resolving a field-change Flow input', async () => {
    const execute = vi.fn((input: unknown) => input)
    const actions: ConfigFormFlowActionRegistry = {
      get: () => ({ execute }),
    }
    const session = createPreviewSession({
      createFlowEngine: ports => createPageFlowEngine({ ...ports, actions }),
    })
    const fieldChange = actionFlow({
      actionInput: { $field: 'name' },
      input: 'field-change',
      trigger: { kind: 'component.event', nodeId: 'name', event: 'update:modelValue' },
    })
    accept(session, {
      compilation: compilation({ plans: [fieldChange] }),
    })

    await session.handleFieldChange({
      field: 'name',
      values: { name: 'Latest value' },
    })
    await expect(session.handleRuntimeEvent({
      nodeId: 'name',
      event: 'update:modelValue',
    })).resolves.toMatchObject({ status: 'committed' })

    expect(execute.mock.calls[0]?.[0]).toBe('Latest value')
    expect(session.getRuntimeModel()).toEqual({
      name: 'Latest value',
      result: 'Latest value',
    })
    session.dispose()
  })

  it('keeps fallback compilation, values, and Flow plans on the same ready revision only', async () => {
    const actions: ConfigFormFlowActionRegistry = {
      get: () => ({ execute: input => input }),
    }
    const session = createPreviewSession({
      createFlowEngine: ports => createPageFlowEngine({ ...ports, actions }),
    })
    const trigger: ConfigFormFlowTrigger = { kind: 'component.event', nodeId: 'submit', event: 'click' }
    const oldCompilation = compilation({ plans: [actionFlow({ input: 'old', projection: true, trigger })] })
    const first = accept(session, { compilation: oldCompilation })!
    session.handleRuntimeMounted(runtimeIdentity(first, 'host-a'))
    session.handleRuntimeReady(runtimeIdentity(first, 'host-a'))
    session.updateRuntimeModel({ name: 'Latest input' })

    const newCompilation = compilation({
      editVersion: 1,
      plans: [actionFlow({ input: 'new', projection: true, trigger })],
    })
    accept(session, { compilation: newCompilation, editVersion: 1, runtime: failure })

    expect(session.getCompilation()).toBe(oldCompilation)
    expect(session.getRuntimeModel()).toEqual({ name: 'Latest input' })
    await expect(session.dispatch(trigger)).resolves.toMatchObject({ status: 'committed' })
    expect(session.getRuntimeModel()).toEqual({ name: 'Latest input', result: 'old' })
    expect(session.flowProjection.value.props).toEqual({ result: { placeholder: 'Completed' } })

    accept(session, {
      compilation: compilation({ editVersion: 2, pageId: 'other' }),
      editVersion: 2,
      graph: graph({ id: 'other-name', field: 'name', defaultValue: 'Other page' }),
      pageId: 'other',
      runtime: failure,
    })
    expect(session.getCompilation()).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({ name: 'Other page' })
    expect(session.flowProjection.value.props).toEqual({})
    session.dispose()
  })

  it('mounts once per RuntimeHost page session and remounts after reopen or page change', async () => {
    const notify = vi.fn()
    const session = createWorkbenchPreviewSession({ onNotify: notify })
    const mountPlan = actionFlow({ input: 'mounted', trigger: { kind: 'page.mount' } })
    const firstCompilation = compilation({ plans: [mountPlan] })
    const first = accept(session, { compilation: firstCompilation })!

    await session.handleRuntimeMounted(runtimeIdentity(first, 'host-a'))
    const secondCompilation = compilation({ editVersion: 1, plans: [mountPlan] })
    const second = accept(session, { compilation: secondCompilation, editVersion: 1 })!
    expect(session.handleRuntimeMounted(runtimeIdentity(second, 'host-a'))).toBeUndefined()
    expect(notify).toHaveBeenCalledTimes(1)

    await session.handleRuntimeMounted(runtimeIdentity(second, 'host-b'))
    const otherCompilation = compilation({ editVersion: 2, pageId: 'other', plans: [mountPlan] })
    const other = accept(session, {
      compilation: otherCompilation,
      editVersion: 2,
      pageId: 'other',
    })!
    await session.handleRuntimeMounted(runtimeIdentity(other, 'host-b'))
    expect(notify).toHaveBeenCalledTimes(3)
    session.dispose()
  })

  it('invalidates stale async Flow work and all future events when disposed', async () => {
    let release!: (value: unknown) => void
    const actions: ConfigFormFlowActionRegistry = {
      get: () => ({ execute: () => new Promise(resolve => release = resolve) }),
    }
    const session = createPreviewSession({
      createFlowEngine: ports => createPageFlowEngine({ ...ports, actions }),
    })
    const trigger: ConfigFormFlowTrigger = { kind: 'component.event', nodeId: 'submit', event: 'click' }
    const currentCompilation = compilation({ plans: [actionFlow({ input: 'late', trigger })] })
    accept(session, { compilation: currentCompilation })
    const pending = session.dispatch(trigger)!
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    session.dispose()
    release('too late')

    await expect(pending).resolves.toMatchObject({ status: 'stale' })
    expect(session.projection.value).toBeUndefined()
    expect(session.getRuntimeModel()).toEqual({})
    expect(session.dispatch(trigger)).toBeUndefined()
    expect(session.handleFieldChange({ field: 'name', values: { name: 'Ignored' } })).toBeUndefined()
    expect(session.handleSubmit({ name: 'Ignored' })).toBeUndefined()
    session.updateRuntimeModel({ name: 'Ignored' })
    expect(session.getRuntimeModel()).toEqual({})
  })

  it('invalidates pending Flow work when the same page advances revision', async () => {
    let release!: (value: unknown) => void
    const actions: ConfigFormFlowActionRegistry = {
      get: () => ({ execute: () => new Promise(resolve => release = resolve) }),
    }
    const session = createPreviewSession({
      createFlowEngine: ports => createPageFlowEngine({ ...ports, actions }),
    })
    const trigger: ConfigFormFlowTrigger = { kind: 'component.event', nodeId: 'submit', event: 'click' }
    const firstCompilation = compilation({ plans: [actionFlow({ input: 'late', trigger })] })
    accept(session, { compilation: firstCompilation })
    const pending = session.dispatch(trigger)!
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    const nextCompilation = compilation({ editVersion: 1 })
    accept(session, { compilation: nextCompilation, editVersion: 1 })
    release('too late')

    await expect(pending).resolves.toMatchObject({ status: 'stale' })
    expect(session.getRuntimeModel()).toEqual({ name: 'Default' })
    session.dispose()
  })
})
