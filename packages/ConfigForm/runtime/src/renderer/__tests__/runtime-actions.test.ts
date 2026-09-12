import type { ConfigFormFlowActionContext } from '@moluoxixi/config-form-core'
import { describe, expect, it, vi } from 'vitest'
import { createRendererBuiltinActions, listConfigFormRendererBuiltinActionDescriptors } from '../services/runtime-actions'

function context(overrides: Partial<ConfigFormFlowActionContext> = {}): ConfigFormFlowActionContext {
  return {
    flow: {} as ConfigFormFlowActionContext['flow'],
    node: { id: 'node', type: 'action', ref: 'test' } as ConfigFormFlowActionContext['node'],
    revision: 1,
    runId: 'run',
    signal: new AbortController().signal,
    values: {},
    outputs: {},
    event: { trigger: { kind: 'component.event', nodeId: 'field', event: 'run' }, args: [], scope: [] },
    form: { getValue: () => undefined, getValues: () => ({}), setValue: vi.fn(), setValues: vi.fn(), setField: vi.fn(), setVariable: vi.fn(), setFieldState: vi.fn(), getField: vi.fn(), getVariable: vi.fn() },
    ...overrides,
  }
}

describe('renderer builtin actions', () => {
  it('exports JSON-safe descriptors for every reserved renderer action', () => {
    const descriptors = listConfigFormRendererBuiltinActionDescriptors()
    expect(descriptors.map(item => item.ref)).toEqual([
      'builtin.field.set',
      'builtin.variable.set',
      'builtin.field.state',
      'builtin.form.validate',
      'builtin.form.submit',
      'builtin.form.reset',
      'builtin.dataSource.load',
    ])
    expect(() => structuredClone(descriptors)).not.toThrow()
    expect(descriptors.find(item => item.ref === 'builtin.dataSource.load')?.capabilities).toContain('dataSourceHost.request')
  })

  it('executes field, variable, state, form and source builtins through explicit context methods', async () => {
    const form = {
      getValue: vi.fn(),
      getValues: vi.fn(() => ({})),
      setValue: vi.fn(),
      setValues: vi.fn(),
      setField: vi.fn(),
      setVariable: vi.fn(),
      setFieldState: vi.fn(),
      getField: vi.fn(),
      getVariable: vi.fn(),
    }
    const host = {
      validate: vi.fn(async () => true),
      submit: vi.fn(async () => false),
      reset: vi.fn(async () => true),
      loadDataSource: vi.fn(async () => ({ sourceId: 'source', status: 'empty' as const, data: [] })),
    }
    const actions = createRendererBuiltinActions(host)
    const base = context({ form })
    await actions['builtin.field.set'].execute({ fieldId: 'field', value: 2, scope: 'parent' }, base)
    await actions['builtin.variable.set'].execute({ variableId: 'variable', value: 3 }, base)
    await actions['builtin.field.state'].execute({ fieldId: 'field', state: 'disabled', value: true }, base)
    expect(form.setField).toHaveBeenCalledWith('field', 2, 'parent')
    expect(form.setVariable).toHaveBeenCalledWith('variable', 3)
    expect(form.setFieldState).toHaveBeenCalledWith('field', 'disabled', true, 'current')
    await expect(actions['builtin.form.validate'].execute(null, base)).resolves.toEqual({ valid: true })
    await expect(actions['builtin.form.submit'].execute(null, base)).resolves.toEqual({ submitted: false })
    await expect(actions['builtin.form.reset'].execute(null, base)).resolves.toEqual({ reset: true })
    await expect(actions['builtin.dataSource.load'].execute({ dataSourceId: 'source', params: { q: 'x' } }, base)).resolves.toEqual({ state: { sourceId: 'source', status: 'empty', data: [] } })
    expect(host.loadDataSource).toHaveBeenCalledWith('source', expect.objectContaining({ scope: [] }), base)
  })

  it('rejects invalid source input and aborted operations without touching host methods', async () => {
    const host = { validate: vi.fn(async () => true), submit: vi.fn(async () => true), reset: vi.fn(async () => true), loadDataSource: vi.fn() }
    const actions = createRendererBuiltinActions(host)
    const controller = new AbortController()
    controller.abort('cancelled')
    const base = context({ signal: controller.signal })
    await expect(actions['builtin.dataSource.load'].execute({ dataSourceId: 'source', params: [] }, base)).rejects.toMatchObject({ code: 'FLOW_ACTION_INPUT_INVALID' })
    await expect(actions['builtin.form.validate'].execute(null, base)).rejects.toThrow()
    expect(host.loadDataSource).not.toHaveBeenCalled()
    expect(host.validate).not.toHaveBeenCalled()
  })
})
