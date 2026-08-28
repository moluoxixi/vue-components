import type { RetrievalStrategy, StrategyResult } from '../src/core/retrieval-strategy'
import type { ServerContext } from '../src/server/context'
import type { AiDocUIMessage } from '../src/shared/protocol'
// @vitest-environment node
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { dispatch } from '../src/server/router'

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

function languageModel(answer = 'Hello world'): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 'answer' },
          { type: 'text-delta' as const, id: 'answer', delta: answer },
          { type: 'text-end' as const, id: 'answer' },
          { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage: USAGE },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    },
  })
}

function user(id: string, text: string): AiDocUIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] }
}

function assistant(id: string, text: string): AiDocUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] }
}

function makeRes() {
  const res: any = new EventEmitter()
  Object.assign(res, {
    statusCode: 0,
    headers: {} as Record<string, unknown>,
    chunks: [] as Array<string | Uint8Array>,
    headersSent: false,
    destroyed: false,
    writableEnded: false,
    writeHead(status: number, headers?: Record<string, unknown>) {
      res.statusCode = status
      if (headers)
        res.headers = headers
      res.headersSent = true
      return res
    },
    write(chunk: string | Uint8Array) {
      res.chunks.push(chunk)
      return true
    },
    end(chunk?: string | Uint8Array) {
      if (chunk)
        res.chunks.push(chunk)
      res.ended = true
      res.writableEnded = true
    },
    json() {
      return JSON.parse(res.body)
    },
  })
  Object.defineProperty(res, 'body', {
    configurable: true,
    get: () => Buffer.concat(res.chunks.map((chunk: string | Uint8Array) =>
      typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))).toString('utf8'),
  })
  return res
}

function makeReq(method: string, url: string, body?: unknown): any {
  const raw = body === undefined ? '' : JSON.stringify(body)
  const stream: any = Readable.from(raw ? [Buffer.from(raw)] : [])
  stream.method = method
  stream.url = url
  return stream
}

function makeRawReq(method: string, url: string, raw: string): any {
  const stream: any = Readable.from(raw ? [Buffer.from(raw)] : [])
  stream.method = method
  stream.url = url
  return stream
}

function strategy(result: StrategyResult): RetrievalStrategy {
  return {
    mode: 'content',
    isReady: () => true,
    build: async () => ({ builtAt: 'x', componentCount: result.chunks.length }),
    retrieve: vi.fn(async () => result),
  }
}

function hitStrategy(): RetrievalStrategy {
  return strategy({
    empty: false,
    chunks: [{
      component: 'Btn',
      packageName: '@x/c',
      docPath: 'packages/Btn/src/index.vue',
      source: 'internal',
      knowledgeKey: 'internal:%40x%2Fc:Btn',
      body: 'Btn docs',
      example: '<Btn />',
      exampleCode: { ts: '<Btn />', js: '<Btn />' },
      score: 0.9,
    }],
  })
}

function makeCtx(overrides: Partial<Record<string, unknown>> = {}): ServerContext {
  const config = {
    chat: { provider: 'openai', apiKey: 'secret', model: 'gpt-4o-mini' },
    embedding: null,
  }
  const base: any = {
    config,
    languageModel: languageModel(),
    mode: 'content',
    initialize: vi.fn(async () => {}),
    state: { snapshot: () => ({ status: 'idle', meta: null, error: null }) },
    getStrategy: () => strategy({ chunks: [], empty: true }),
    getContracts: () => [],
    getExternalContracts: () => [],
    buildIndex: async () => {},
  }
  return Object.assign(base, overrides) as ServerContext
}

describe('dispatch', () => {
  it('returns false outside the plugin prefix', async () => {
    const res = makeRes()
    expect(await dispatch(makeCtx(), makeReq('GET', '/other'), res)).toBe(false)
    expect(res.headersSent).toBe(false)
  })

  it('returns a secret-free health projection', async () => {
    const res = makeRes()
    await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/health'), res)

    expect(res.statusCode).toBe(200)
    expect(res.json().providers).toEqual({
      chat: { availability: 'configured', provider: 'openai', model: 'gpt-4o-mini' },
      embedding: { availability: 'missing', provider: null, model: null },
    })
    expect(res.body).not.toContain('secret')
    expect(res.body).not.toContain('AI_DOC_CHAT_API_KEY')
  })

  it('returns index status including embedding identity', async () => {
    const identity = {
      provider: 'openai' as const,
      model: 'text-embedding-3-small',
      endpointFingerprint: 'hash',
      dimension: 1536,
    }
    const res = makeRes()
    await dispatch(makeCtx({
      state: { snapshot: () => ({
        status: 'stale',
        meta: { builtAt: 'now', componentCount: 2, sourceHash: 'source', embeddingIdentity: identity },
        error: null,
      }) },
    }), makeReq('GET', '/__ai-doc/api/index/status'), res)

    expect(res.json()).toMatchObject({ state: 'stale', stale: true, embeddingIdentity: identity })
  })

  it('maps components and resolves encoded detail names', async () => {
    const contract = {
      name: 'Foo Bar',
      packageName: '@x/c',
      sourceFile: 'a.vue',
      description: 'demo',
      props: [],
      emits: [],
      slots: [],
      models: [],
      typeDefs: [],
    }
    const ctx = makeCtx({ getContracts: () => [contract] })
    const listRes = makeRes()
    await dispatch(ctx, makeReq('GET', '/__ai-doc/api/components'), listRes)
    expect(listRes.json()[0]).toMatchObject({ name: 'Foo Bar', knowledgeKey: 'internal:%40x%2Fc:Foo%20Bar' })

    const detailRes = makeRes()
    await dispatch(ctx, makeReq('GET', '/__ai-doc/api/components/Foo%20Bar'), detailRes)
    expect(detailRes.json().name).toBe('Foo Bar')
  })

  it('rejects malformed JSON before invoking knowledge import', async () => {
    const importKnowledge = vi.fn()
    const res = makeRes()
    await dispatch(
      makeCtx({ importKnowledge }),
      makeRawReq('POST', '/__ai-doc/api/knowledge/import', '{ bad json'),
      res,
    )
    expect(res.json()).toMatchObject({ error: 'INVALID_REQUEST', message: 'invalid json body' })
    expect(importKnowledge).not.toHaveBeenCalled()
  })

  it('validates complete UI message history limits', async () => {
    const twentyHistory = Array.from({ length: 10 }, (_, index) => [
      user(`u${index}`, index === 0 ? 'u'.repeat(19_981) : 'u'),
      assistant(`a${index}`, 'a'),
    ]).flat()
    const okRes = makeRes()
    await dispatch(makeCtx(), makeReq('POST', '/__ai-doc/api/query', {
      messages: [...twentyHistory, user('current', 'hi')],
    }), okRes)
    expect(okRes.statusCode).toBe(200)

    const tooManyRes = makeRes()
    await dispatch(makeCtx(), makeReq('POST', '/__ai-doc/api/query', {
      messages: [...twentyHistory, user('u10', 'q'), assistant('a10', 'a'), user('current', 'hi')],
    }), tooManyRes)
    expect(tooManyRes.statusCode).toBe(400)
    expect(tooManyRes.json().message).toContain('20 messages')

    const tooLongRes = makeRes()
    await dispatch(makeCtx(), makeReq('POST', '/__ai-doc/api/query', {
      messages: [user('u1', 'u'.repeat(20_000)), assistant('a1', 'a'), user('current', 'hi')],
    }), tooLongRes)
    expect(tooLongRes.statusCode).toBe(400)
    expect(tooLongRes.json().message).toContain('20000 characters')
  })

  it('allows no-match responses without a chat provider', async () => {
    const res = makeRes()
    await dispatch(makeCtx({
      config: { chat: null, embedding: null },
      languageModel: null,
    }), makeReq('POST', '/__ai-doc/api/query', {
      messages: [user('u1', 'missing component')],
    }), res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('data-sources')
    expect(res.body).toContain('未找到')
  })

  it('returns a pre-stream JSON error when hits require an unconfigured chat provider', async () => {
    const res = makeRes()
    await dispatch(makeCtx({
      config: { chat: null, embedding: null },
      languageModel: null,
      getStrategy: () => hitStrategy(),
    }), makeReq('POST', '/__ai-doc/api/query', {
      messages: [user('u1', 'Btn')],
    }), res)

    expect(res.statusCode).toBe(502)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.json().error).toBe('UPSTREAM_ERROR')
  })

  it('returns retrieval failures as JSON before starting the UI stream', async () => {
    const failing = strategy({ chunks: [], empty: true })
    failing.retrieve = async () => {
      throw new Error('embedding upstream unavailable')
    }
    const res = makeRes()
    await dispatch(makeCtx({ getStrategy: () => failing }), makeReq('POST', '/__ai-doc/api/query', {
      messages: [user('u1', 'Btn')],
    }), res)

    expect(res.statusCode).toBe(502)
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('streams standard UI message chunks in sources-text-example-finish order', async () => {
    const res = makeRes()
    await dispatch(makeCtx({ getStrategy: () => hitStrategy() }), makeReq('POST', '/__ai-doc/api/query', {
      messages: [user('u1', 'Btn')],
    }), res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    const sourceIndex = res.body.indexOf('data-sources')
    const textIndex = res.body.indexOf('Hello world')
    const exampleIndex = res.body.indexOf('data-example')
    const finishIndex = res.body.lastIndexOf('"type":"finish"')
    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(textIndex).toBeGreaterThan(sourceIndex)
    expect(exampleIndex).toBeGreaterThan(textIndex)
    expect(finishIndex).toBeGreaterThan(exampleIndex)
  })

  it('aborts the model signal when the client disconnects', async () => {
    let upstreamSignal: AbortSignal | undefined
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        upstreamSignal = options.abortSignal
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] })
              controller.enqueue({ type: 'text-start', id: 'answer' })
              controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'first' })
              options.abortSignal?.addEventListener('abort', () => {
                controller.error(new DOMException('aborted', 'AbortError'))
              }, { once: true })
            },
          }),
        }
      },
    })
    const res = makeRes()
    const pending = dispatch(makeCtx({
      languageModel: model,
      getStrategy: () => hitStrategy(),
    }), makeReq('POST', '/__ai-doc/api/query', { messages: [user('u1', 'Btn')] }), res)

    await vi.waitFor(() => expect(res.body).toContain('first'))
    res.emit('close')
    await pending
    expect(upstreamSignal?.aborted).toBe(true)
    expect(res.body).not.toContain('AI provider request failed')
  })

  it('maps build failures and unknown routes', async () => {
    const buildRes = makeRes()
    await dispatch(makeCtx({
      buildIndex: async () => { throw new Error('provider not configured') },
    }), makeReq('POST', '/__ai-doc/api/index/build'), buildRes)
    expect(buildRes.json().error).toBe('UPSTREAM_ERROR')

    const unknownRes = makeRes()
    expect(await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/nope'), unknownRes)).toBe(true)
    expect(unknownRes.json().error).toBe('INVALID_REQUEST')
  })
})
