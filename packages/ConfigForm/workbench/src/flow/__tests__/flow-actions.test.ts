import { createConfigFormFlowFormApi } from '@moluoxixi/config-form-core'
import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchFlowActionRegistry, listWorkbenchFlowActionDescriptors } from '..'

function actionContext() {
  return {
    flow: {} as never,
    node: {
      id: 'act',
      type: 'action' as const,
      ref: 'notify',
      incoming: [],
      outgoing: [],
    },
    revision: 1,
    runId: 'run-1',
    signal: new AbortController().signal,
    values: {},
    outputs: {},
    event: { trigger: { kind: 'form.submit' as const }, args: [] },
    form: createConfigFormFlowFormApi({}),
  }
}

describe('workbench flow actions', () => {
  it('offers renderer-local descriptors without pretending they have parent implementations', () => {
    const registry = createWorkbenchFlowActionRegistry()
    const catalog = listWorkbenchFlowActionDescriptors(registry)
    const localRefs = ['builtin.field.set', 'builtin.variable.set', 'builtin.field.state', 'builtin.form.validate', 'builtin.form.submit', 'builtin.form.reset', 'builtin.dataSource.load']
    for (const ref of localRefs) {
      expect(catalog.filter(descriptor => descriptor.ref === ref)).toHaveLength(1)
      expect(registry.get(ref)).toBeUndefined()
    }
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog)
    expect(new Set(catalog.map(descriptor => descriptor.ref)).size).toBe(catalog.length)
  })

  it('keeps the safe notify action and reports transient feedback', async () => {
    const onNotify = vi.fn()
    const registry = createWorkbenchFlowActionRegistry({ onNotify })
    expect(registry.get('fetch')).toBeUndefined()
    const result = await registry.get('notify')!.execute({ ok: true }, actionContext())
    expect(result).toEqual({ notified: '{"ok":true}' })
    expect(onNotify).toHaveBeenCalledWith('{"ok":true}')
  })

  it('bridges the built-in ui actions onto the workbench hooks', async () => {
    const onNotify = vi.fn()
    const onConfirm = vi.fn(async () => true)
    const registry = createWorkbenchFlowActionRegistry({ onConfirm, onNotify })

    await registry.get('builtin.ui.message')!.execute({ message: 'Saved', type: 'success' }, actionContext())
    expect(onNotify).toHaveBeenCalledWith('Saved')

    const confirmed = await registry.get('builtin.ui.confirm')!.execute({ message: 'Sure?' }, actionContext())
    expect(confirmed).toEqual({ confirmed: true })
    expect(onConfirm).toHaveBeenCalledWith({ cancelText: undefined, confirmText: undefined, message: 'Sure?', title: undefined })

    // Without hooks the ui actions surface a host-capability failure.
    const bare = createWorkbenchFlowActionRegistry()
    await expect(bare.get('builtin.ui.message')!.execute({ message: 'x' }, actionContext()))
      .rejects
      .toThrow(/host capability/)
    expect(bare.get('builtin.http.request')).toBeDefined()
  })

  it('uses only explicitly provided network and navigation capabilities', async () => {
    const onRequest = vi.fn(async () => new Response('{"cities":["A"]}', { status: 200 }))
    const onOpenUrl = vi.fn()
    const registry = createWorkbenchFlowActionRegistry({ onRequest, onOpenUrl })
    expect(onRequest).not.toHaveBeenCalled()
    expect(onOpenUrl).not.toHaveBeenCalled()
    const result = await registry.get('builtin.http.request')!.execute({ url: 'https://example.test/cities' }, actionContext())
    expect(result).toEqual({ status: 200, ok: true, data: { cities: ['A'] } })
    expect(onRequest).toHaveBeenCalledTimes(1)
    await registry.get('builtin.nav.open')!.execute({ url: 'https://example.test', target: '_self' }, actionContext())
    expect(onOpenUrl).toHaveBeenCalledWith('https://example.test', '_self')

    const bare = createWorkbenchFlowActionRegistry()
    await expect(bare.get('builtin.http.request')!.execute({ url: 'https://example.test' }, actionContext()))
      .rejects.toMatchObject({ code: 'FLOW_ACTION_HOST_MISSING' })
    await expect(Promise.resolve().then(() => bare.get('builtin.nav.open')!.execute({ url: 'https://example.test' }, actionContext())))
      .rejects.toMatchObject({ code: 'FLOW_ACTION_HOST_MISSING' })
  })
})
