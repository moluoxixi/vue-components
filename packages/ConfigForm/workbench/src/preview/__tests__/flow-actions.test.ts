import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchFlowActionRegistry } from '..'

describe('workbench flow actions', () => {
  it('registers only the safe notify action and reports transient feedback', async () => {
    const notify = vi.fn()
    const action = createWorkbenchFlowActionRegistry(notify).get('notify')
    expect(createWorkbenchFlowActionRegistry().get('fetch')).toBeUndefined()
    expect(action).toBeDefined()
    const result = await action!.execute({ ok: true }, {
      flow: {} as never,
      node: {
        id: 'notify',
        type: 'action',
        ref: 'notify',
        incoming: [],
        outgoing: [],
      },
      revision: 1,
      runId: 'run-1',
      signal: new AbortController().signal,
      values: {},
      outputs: {},
    })
    expect(result).toEqual({ notified: '{"ok":true}' })
    expect(notify).toHaveBeenCalledWith('{"ok":true}')
  })
})
