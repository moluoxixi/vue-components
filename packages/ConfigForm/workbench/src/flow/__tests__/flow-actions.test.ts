import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchFlowActionRegistry } from '..'

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
  }
}

describe('workbench flow actions', () => {
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
})
