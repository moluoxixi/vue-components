// @vitest-environment happy-dom

import type {
  ConfigFormDataSourceHost,
  ConfigFormFlowHttpRequestOutput,
  ConfigFormPageRuntimeConfiguration,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectOperation } from '@moluoxixi/config-form-model'
import type { DataWorkspaceProps } from '../types'
import { createProjectDomainEngine } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createProjectDocumentFixture } from '../../../project/__tests__/fixtures'
import { DataWorkspace } from '../components'

const PAGE_ID = 'home'

function runtimeFixture(): ConfigFormPageRuntimeConfiguration {
  return {
    variables: [{ id: 'customer-variable', name: 'Customer', initialValue: 'initial' }],
    dataSources: [
      {
        auto: true,
        cacheTtlMs: 0,
        dependencies: [{ $ref: { kind: 'field', nodeId: 'country-node' } }],
        id: 'customer-source',
        mapping: { $ref: { kind: 'event', path: ['data'] } },
        name: 'Customers',
        request: {
          body: { includeInactive: false },
          headers: { Authorization: 'Bearer test' },
          method: 'GET',
          query: { country: { $ref: { kind: 'field', nodeId: 'country-node' } } },
          responseType: 'json',
          url: '/api/customers',
        },
        timeoutMs: 0,
      },
      {
        id: 'orders-source',
        name: 'Orders',
        request: { method: 'POST', responseType: 'json', url: '/api/orders' },
      },
    ],
  }
}

function operationFrom(command: ProjectCommand): ProjectOperation {
  const action = command.actions[0]
  if (action?.type !== 'operation.apply' || action.operations.length !== 1)
    throw new Error('Expected one operation.apply action containing one operation.')
  return action.operations[0]!
}

function mountWorkspace(overrides: Partial<DataWorkspaceProps> = {}) {
  const suppliedExecute = overrides.execute
  const execute = vi.fn((command: ProjectCommand) => suppliedExecute
    ? suppliedExecute(command)
    : Promise.resolve({ changed: true, diagnostics: [] }))
  const runtime = overrides.runtime ?? runtimeFixture()
  const wrapper = mount(DataWorkspace, {
    attachTo: document.body,
    props: {
      active: true,
      pageId: PAGE_ID,
      referenceFields: [{ nodeId: 'country-node', field: 'country', label: 'Country' }],
      runtime,
      testContext: { fields: { 'country-node': 'US' } },
      ...overrides,
      execute,
    },
  })
  return { execute, runtime, wrapper }
}

async function selectDataSources(wrapper: ReturnType<typeof mountWorkspace>['wrapper']): Promise<void> {
  const segmented = wrapper.findComponent({ name: 'ElSegmented' })
  segmented.vm.$emit('change', 'dataSources')
  await nextTick()
}

beforeEach(() => {
  document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays" data-theme="dark"></div>'
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('page data workspace transactions', () => {
  it('saves one page.runtime operation, retains stable ids on rename, and is undoable', async () => {
    const runtime = runtimeFixture()
    delete runtime.dataSources[0]!.dependencies
    runtime.dataSources[0]!.request.query = { country: 'US' }
    const project = createProjectDocumentFixture()
    project.pagesById[PAGE_ID]!.runtime = structuredClone(runtime)
    const engine = createProjectDomainEngine({ document: project })
    const execute = vi.fn((command: ProjectCommand) => engine.execute(command))
    const { wrapper } = mountWorkspace({ execute, runtime })

    expect(wrapper.text()).not.toContain('customer-variable')
    const name = wrapper.get<HTMLInputElement>('input[aria-label="Name"]')
    await name.setValue('Primary customer')
    expect(runtime.variables[0]!.name).toBe('Customer')
    expect(execute).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="save-data"]').trigger('click')
    await flushPromises()

    expect(execute).toHaveBeenCalledTimes(1)
    const operation = operationFrom(execute.mock.calls[0]![0])
    expect(operation.type).toBe('page.runtime')
    if (operation.type === 'page.runtime') {
      expect(operation.pageId).toBe(PAGE_ID)
      expect(operation.runtime?.variables[0]).toMatchObject({
        id: 'customer-variable',
        name: 'Primary customer',
      })
    }
    expect(engine.snapshot.document.pagesById[PAGE_ID]!.runtime?.variables[0]!.name).toBe('Primary customer')
    expect(wrapper.emitted('close')).toHaveLength(1)

    const undone = engine.undo()
    expect(undone.changed).toBe(true)
    expect(engine.snapshot.document.pagesById[PAGE_ID]!.runtime).toEqual(runtime)
    wrapper.unmount()
  })

  it('discards a draft on Cancel without executing or mutating runtime props', async () => {
    const runtime = runtimeFixture()
    const original = structuredClone(runtime)
    const { execute, wrapper } = mountWorkspace({ runtime })

    await wrapper.get('input[aria-label="Name"]').setValue('Draft customer')
    await wrapper.get('[data-testid="cancel-data"]').trigger('click')

    expect(execute).not.toHaveBeenCalled()
    expect(runtime).toEqual(original)
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('normalizes no-op text edits without creating a history entry', async () => {
    const { execute, wrapper } = mountWorkspace()
    await wrapper.get('input[aria-label="Name"]').setValue('Customer ')

    await expect((wrapper.vm as unknown as { save: () => Promise<boolean> }).save()).resolves.toBe(true)
    expect(execute).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('blocks missing required values and creates stable field dependencies', async () => {
    const { execute, wrapper } = mountWorkspace({ runtime: { dataSources: [], variables: [] } })
    await selectDataSources(wrapper)
    await wrapper.get('[data-testid="add-data-entry"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.data-field__error').text()).toContain('URL')
    expect(wrapper.get('.data-diagnostics').text()).toContain('URL is required')
    expect(wrapper.get('[data-testid="save-data"]').attributes('disabled')).toBeDefined()
    await expect((wrapper.vm as unknown as { save: () => Promise<boolean> }).save()).resolves.toBe(false)
    expect(execute).not.toHaveBeenCalled()

    const requiredInput = wrapper.get<HTMLInputElement>('input[aria-required="true"]')
    await requiredInput.setValue('/api/new')
    await wrapper.get('[data-testid="add-dependency"]').trigger('click')
    await wrapper.get('[data-testid="save-data"]').trigger('click')
    await flushPromises()

    const operation = operationFrom(execute.mock.calls[0]![0])
    expect(operation.type).toBe('page.runtime')
    if (operation.type === 'page.runtime') {
      const source = operation.runtime?.dataSources[0]
      expect(source?.dependencies).toEqual([{ $ref: { kind: 'field', nodeId: 'country-node' } }])
      expect(source?.id).toMatch(/^source-/)
    }
    wrapper.unmount()
  })

  it('keeps structured request editors and response mapping out of JSON textareas', async () => {
    const { wrapper } = mountWorkspace()
    await selectDataSources(wrapper)

    expect(wrapper.findAll('.flow-structured-list.is-object').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.findAllComponents({ name: 'FlowValueEditor' }).length).toBeGreaterThan(6)
    expect(wrapper.get('input[aria-label="Timeout (ms, 0 disables)"]').element).toHaveProperty('value', '0')
    expect(wrapper.get('input[aria-label="Cache TTL (ms, 0 disables)"]').element).toHaveProperty('value', '0')
    wrapper.unmount()
  })

  it('refuses to overwrite a changed runtime or revision', async () => {
    const runtime = runtimeFixture()
    const { execute, wrapper } = mountWorkspace({ runtime, runtimeRevision: 7 })
    await wrapper.get('input[aria-label="Name"]').setValue('Local draft')

    const external = runtimeFixture()
    external.variables[0]!.name = 'External change'
    await wrapper.setProps({ runtime: external, runtimeRevision: 8 })
    await nextTick()

    expect(wrapper.get('.data-diagnostics').text()).toContain('changed outside this editor')
    expect(wrapper.get('[data-testid="save-data"]').attributes('disabled')).toBeDefined()
    await expect((wrapper.vm as unknown as { save: () => Promise<boolean> }).save()).resolves.toBe(false)
    expect(execute).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('explicit data-source tests', () => {
  it('resolves multi-level variable dependencies before an explicit request', async () => {
    const runtime = runtimeFixture()
    runtime.variables = [
      { id: 'first', name: 'First', initialValue: 'US' },
      { id: 'second', name: 'Second', initialValue: { $ref: { kind: 'variable', variableId: 'first' } } },
      { id: 'third', name: 'Third', initialValue: { $ref: { kind: 'variable', variableId: 'second' } } },
    ]
    runtime.dataSources[0]!.request.query = { country: { $ref: { kind: 'variable', variableId: 'third' } } }
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockResolvedValue({ data: [], ok: true, status: 200 })
    const { wrapper } = mountWorkspace({ runtime, onRequest: request })
    await selectDataSources(wrapper)
    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0]![0].query).toEqual({ country: 'US' })
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('empty')
    wrapper.unmount()
  })

  it('lets the user stop a test and ignores its late result', async () => {
    let release!: (value: ConfigFormFlowHttpRequestOutput) => void
    let signal!: AbortSignal
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>((_input, requestSignal) => {
      signal = requestSignal
      return new Promise<ConfigFormFlowHttpRequestOutput>(resolve => release = resolve)
    })
    const { wrapper } = mountWorkspace({ onRequest: request })
    await selectDataSources(wrapper)
    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(signal.aborted).toBe(false)
    await wrapper.get('[data-testid="cancel-data-test"]').trigger('click')
    expect(signal.aborted).toBe(true)
    release({ data: ['late'], ok: true, status: 200 })
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')
    expect(wrapper.find('[data-testid="data-test-preview"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('aborts a running test when its request declaration changes', async () => {
    let release!: (value: ConfigFormFlowHttpRequestOutput) => void
    let signal!: AbortSignal
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>((_input, requestSignal) => {
      signal = requestSignal
      return new Promise<ConfigFormFlowHttpRequestOutput>(resolve => release = resolve)
    })
    const { wrapper } = mountWorkspace({ onRequest: request })
    await selectDataSources(wrapper)
    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    await wrapper.get('input[aria-required="true"]').setValue('/api/changed')
    expect(signal.aborted).toBe(true)
    release({ data: ['old'], ok: true, status: 200 })
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')
    wrapper.unmount()
  })

  it('never auto-loads and renders loading, success, empty, and error states only after clicks', async () => {
    let resolveFirst!: (value: { data: unknown, ok: boolean, status: number }) => void
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => new Promise(resolve => resolveFirst = resolve))
      .mockResolvedValueOnce({ data: [], ok: true, status: 200 })
      .mockRejectedValueOnce(new Error('Host offline'))
    const { wrapper } = mountWorkspace({ onRequest: request })
    await selectDataSources(wrapper)
    await flushPromises()

    expect(request).not.toHaveBeenCalled()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('loading')
    resolveFirst({ data: { customers: ['Ada'] }, ok: true, status: 200 })
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('success')
    expect(wrapper.get('[data-testid="data-test-preview"]').text()).toContain('Ada')

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('empty')

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('error')
    expect(wrapper.get('.data-test__result').text()).toContain('Host offline')
    wrapper.unmount()
  })

  it('aborts on source changes and ignores a late response from the previous source', async () => {
    const signals: AbortSignal[] = []
    const releases: Array<(value: { data: unknown, ok: boolean, status: number }) => void> = []
    const request: NonNullable<ConfigFormDataSourceHost['request']> = vi.fn((_input, signal) => {
      signals.push(signal)
      return new Promise<ConfigFormFlowHttpRequestOutput>(resolve => releases.push(resolve))
    })
    const { wrapper } = mountWorkspace({ onRequest: request })
    await selectDataSources(wrapper)

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(signals[0]?.aborted).toBe(false)

    await wrapper.get('[data-data-entry-id="orders-source"]').trigger('click')
    expect(signals[0]?.aborted).toBe(true)
    releases[0]!({ data: { stale: true }, ok: true, status: 200 })
    await flushPromises()

    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')
    expect(wrapper.text()).not.toContain('stale')

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    expect(signals[1]?.aborted).toBe(false)
    await wrapper.get<HTMLInputElement>('input[aria-required="true"]').setValue('/api/orders-next')
    expect(signals[1]?.aborted).toBe(true)
    releases[1]!({ data: { staleEdit: true }, ok: true, status: 200 })
    await flushPromises()
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')
    expect(wrapper.text()).not.toContain('staleEdit')
    wrapper.unmount()
  }, 15_000)

  it('aborts active tests when the panel closes or the page changes', async () => {
    const signals: AbortSignal[] = []
    const request: NonNullable<ConfigFormDataSourceHost['request']> = vi.fn((_input, signal) => {
      signals.push(signal)
      return new Promise<ConfigFormFlowHttpRequestOutput>(() => undefined)
    })
    const { wrapper } = mountWorkspace({ onRequest: request })
    await selectDataSources(wrapper)

    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ active: false })
    expect(signals[0]?.aborted).toBe(true)

    await wrapper.setProps({ active: true })
    await selectDataSources(wrapper)
    await wrapper.get('[data-testid="test-data-source"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ pageId: 'other-page', runtime: runtimeFixture() })
    expect(signals[1]?.aborted).toBe(true)
    expect(wrapper.get('.data-test__result').attributes('data-status')).toBe('idle')
    wrapper.unmount()
  }, 15_000)
})
