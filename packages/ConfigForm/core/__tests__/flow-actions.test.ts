import type { ConfigFormFlow } from '../index'
import { describe, expect, it, vi } from 'vitest'
import {
  ConfigFormFlowInterpreter,
  createConfigFormBuiltinFlowActions,
  createConfigFormFlowActionRegistry,
} from '../index'

function actionFlow(ref: string, input: unknown, output?: Record<string, unknown>): ConfigFormFlow {
  return {
    version: 1,
    id: `flow-${ref}`,
    name: ref,
    trigger: { kind: 'form.submit' },
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'act', type: 'action', ref, config: { input, ...(output ? { output } : {}) } as never },
      { id: 'done', type: 'success' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'act' },
      { id: 'e2', source: 'act', target: 'done' },
    ],
  }
}

describe('built-in flow actions', () => {
  it('performs http requests with query, json body, expression templates, and output mapping', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => new Response(
      JSON.stringify({ id: 7, received: init?.body ? JSON.parse(init.body as string) : undefined, url: String(url) }),
      { headers: { 'content-type': 'application/json' }, status: 200 },
    )) as unknown as typeof fetch
    const interpreter = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({ fetch: fetchImpl }),
    ))

    const result = await interpreter.run(actionFlow('builtin.http.request', {
      url: 'https://api.example.test/users',
      method: 'POST',
      query: { page: 1 },
      body: { name: { $expression: 'UPPER(name)' } },
    }, { savedId: { $expression: '$outputs.act.data.id' } }), { values: { name: 'ada' } })

    expect(result.status).toBe('success')
    expect(result.values.savedId).toBe(7)
    expect(result.outputs.act).toMatchObject({ ok: true, status: 200 })
    const [calledUrl, calledInit] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(String(calledUrl)).toBe('https://api.example.test/users?page=1')
    expect(JSON.parse((calledInit as RequestInit).body as string)).toEqual({ name: 'ADA' })
  })

  it('fails the flow on non-2xx responses so error edges can take over', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 })) as unknown as typeof fetch
    const interpreter = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({ fetch: fetchImpl }),
    ))
    const result = await interpreter.run(actionFlow('builtin.http.request', { url: 'https://api.example.test/x' }))
    expect(result.status).toBe('failure')
    expect(result.error?.message).toContain('HTTP 503')
  })

  it('delays, opens urls, and shows messages through host capabilities', async () => {
    const openUrl = vi.fn()
    const message = vi.fn()
    const interpreter = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({ message, openUrl }),
    ))

    expect((await interpreter.run(actionFlow('builtin.delay', { ms: 1 }))).status).toBe('success')
    expect((await interpreter.run(actionFlow('builtin.nav.open', { url: 'https://example.test' }))).status).toBe('success')
    expect(openUrl).toHaveBeenCalledWith('https://example.test', '_blank')
    expect((await interpreter.run(actionFlow('builtin.ui.message', { message: { $expression: 'CONCAT("Hi ", name)' } }))).status).toBe('success')
    // The template resolves before the action runs.
    expect(message).toHaveBeenCalledWith({ message: 'Hi ', type: 'info' })
  })

  it('treats declined confirms and missing host capabilities as failures', async () => {
    const interpreter = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({ confirm: async () => false }),
    ))
    const declined = await interpreter.run(actionFlow('builtin.ui.confirm', { message: 'Delete?' }))
    expect(declined.status).toBe('failure')
    expect(declined.error?.message).toContain('declined')

    const bare = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({}),
    ))
    const missing = await bare.run(actionFlow('builtin.nav.open', { url: 'https://example.test' }))
    expect(missing.status).toBe('failure')
    expect(missing.error?.message).toContain('openUrl')
  })

  it('lets host registries override and extend the built-in library', async () => {
    const registry = createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({}),
      { 'builtin.delay': { execute: () => ({ waitedMs: -1 }) }, 'custom.echo': { execute: input => input } },
    )
    expect(registry.get('custom.echo')).toBeDefined()
    expect(registry.get('missing')).toBeUndefined()
    const interpreter = new ConfigFormFlowInterpreter(registry)
    const overridden = await interpreter.run(actionFlow('builtin.delay', { ms: 999 }))
    expect(overridden.outputs.act).toEqual({ waitedMs: -1 })
  })
})
