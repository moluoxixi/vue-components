import type { LanguageModel } from 'ai'
import type { AddressInfo } from 'node:net'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { MockLanguageModelV3 } from 'ai/test'
import { afterEach, describe, expect, it } from 'vitest'
import {
  I18N_TOOL_API_PREFIX,
  I18N_TOOL_PRIVATE_HEADER,
} from '../protocol'
import { dispatch, ServerContext } from '../server'
import { createTranslationModel } from './model-helpers'
import { testConfig } from './server-helpers'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(dispose => dispose()))
})

async function startServer(model?: LanguageModel): Promise<{ baseUrl: string }> {
  const root = resolve(tmpdir(), `i18n-tool-router-${crypto.randomUUID()}`)
  await mkdir(resolve(root, 'locales'), { recursive: true })
  await writeFile(resolve(root, 'locales/en-US.json'), '{"hello":"Hello"}\n')
  const context = new ServerContext({
    config: testConfig(root),
    env: model ? { TEST_I18N_AI_KEY: 'secret' } : {},
    model,
  })
  const server = createServer(async (request, response) => {
    if (!(await dispatch(context, request, response)))
      response.writeHead(404).end()
  })
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address() as AddressInfo
  cleanup.push(async () => {
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
    await rm(root, { force: true, recursive: true })
  })
  return { baseUrl: `http://127.0.0.1:${address.port}` }
}

function mutationHeaders(baseUrl: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'origin': baseUrl,
    [I18N_TOOL_PRIVATE_HEADER]: '1',
  }
}

describe('local API router', () => {
  it('returns only sanitized configuration', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/config`)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('missing')
    expect(body).not.toContain('TEST_I18N_AI_KEY')
  })

  it('requires the private header, JSON content type and same origin', async () => {
    const { baseUrl } = await startServer()
    const endpoint = `${baseUrl}${I18N_TOOL_API_PREFIX}/scan`

    expect((await fetch(endpoint, { body: '{}', method: 'POST' })).status).toBe(403)
    expect((await fetch(endpoint, {
      body: '{}',
      headers: { 'content-type': 'application/json', [I18N_TOOL_PRIVATE_HEADER]: '1' },
      method: 'POST',
    })).status).toBe(403)
    expect((await fetch(endpoint, {
      body: '{}',
      headers: { ...mutationHeaders(baseUrl), origin: 'https://attacker.example' },
      method: 'POST',
    })).status).toBe(403)
    expect((await fetch(endpoint, {
      body: '{}',
      headers: { ...mutationHeaders(baseUrl), origin: baseUrl.replace('http:', 'https:') },
      method: 'POST',
    })).status).toBe(403)
    expect((await fetch(endpoint, {
      body: '{}',
      headers: { [I18N_TOOL_PRIVATE_HEADER]: '1', origin: baseUrl },
      method: 'POST',
    })).status).toBe(415)
    expect((await fetch(endpoint, {
      body: '{}',
      headers: { ...mutationHeaders(baseUrl), 'content-type': 'application/jsonp' },
      method: 'POST',
    })).status).toBe(415)

    const allowed = await fetch(endpoint, { body: '{}', headers: mutationHeaders(baseUrl), method: 'POST' })
    expect(allowed.status).toBe(200)
    expect((await allowed.json()).resources).toHaveLength(1)
  })

  it('rejects oversized request bodies before route decoding', async () => {
    const { baseUrl } = await startServer()
    const response = await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/scan`, {
      body: JSON.stringify({ value: 'x'.repeat(2_000) }),
      headers: mutationHeaders(baseUrl),
      method: 'POST',
    })
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: 'PAYLOAD_TOO_LARGE' })
  })

  it('streams candidates and exactly one successful terminal event', async () => {
    const { baseUrl } = await startServer(createTranslationModel(() => '你好'))
    const headers = mutationHeaders(baseUrl)
    const scan = await (await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/scan`, {
      body: '{}',
      headers,
      method: 'POST',
    })).json()
    const response = await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/translate`, {
      body: JSON.stringify({
        scanId: scan.scanId,
        targetLocale: 'zh-CN',
        unitIds: [scan.units[0].id],
      }),
      headers,
      method: 'POST',
    })
    const events = (await response.text())
      .split('\n\n')
      .filter(Boolean)
      .map(frame => JSON.parse(frame.replace(/^data: /, '')))

    expect(events.filter(event => event.type === 'done')).toHaveLength(1)
    expect(events.filter(event => event.type === 'error')).toHaveLength(0)
    expect(events).toContainEqual(expect.objectContaining({ type: 'candidate' }))
  })

  it('propagates an HTTP disconnect to the AI SDK model signal', async () => {
    let observeAbort!: () => void
    let observeStart!: () => void
    const aborted = new Promise<void>((resolveAbort) => {
      observeAbort = resolveAbort
    })
    const started = new Promise<void>((resolveStart) => {
      observeStart = resolveStart
    })
    const model = new MockLanguageModelV3({
      doGenerate: async ({ abortSignal }) => {
        observeStart()
        await new Promise<void>((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => {
            observeAbort()
            reject(abortSignal.reason)
          }, { once: true })
        })
        throw new Error('Unreachable')
      },
    })
    const { baseUrl } = await startServer(model)
    const headers = mutationHeaders(baseUrl)
    const scan = await (await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/scan`, {
      body: '{}',
      headers,
      method: 'POST',
    })).json()
    const controller = new AbortController()
    const request = fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/translate`, {
      body: JSON.stringify({
        scanId: scan.scanId,
        targetLocale: 'zh-CN',
        unitIds: [scan.units[0].id],
      }),
      headers,
      method: 'POST',
      signal: controller.signal,
    })
    await started
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    await expect(aborted).resolves.toBeUndefined()
  })

  it('emits exactly one error terminal event when translation fails', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error('upstream failed')
      },
    })
    const { baseUrl } = await startServer(model)
    const headers = mutationHeaders(baseUrl)
    const scan = await (await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/scan`, {
      body: '{}',
      headers,
      method: 'POST',
    })).json()
    const response = await fetch(`${baseUrl}${I18N_TOOL_API_PREFIX}/translate`, {
      body: JSON.stringify({
        scanId: scan.scanId,
        targetLocale: 'zh-CN',
        unitIds: [scan.units[0].id],
      }),
      headers,
      method: 'POST',
    })
    const events = (await response.text())
      .split('\n\n')
      .filter(Boolean)
      .map(frame => JSON.parse(frame.replace(/^data: /, '')))

    expect(events).toEqual([{ error: 'INTERNAL_ERROR', message: expect.any(String), type: 'error' }])
  })
})
