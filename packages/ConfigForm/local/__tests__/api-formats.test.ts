import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { generateText } from 'ai'
import { describe, expect, it } from 'vitest'
import { assistantModelFromEnvironment } from '../src/services/assistant'

const cases = [
  {
    format: 'openai-responses',
    path: '/v1/responses',
    auth: 'authorization',
    authValue: 'Bearer test-key',
    response: { id: 'resp_test', object: 'response', created_at: 1, status: 'completed', model: 'test-model', output: [{ type: 'message', id: 'msg_test', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'ready', annotations: [] }] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, error: null, incomplete_details: null },
  },
  {
    format: 'openai-chat-completions',
    path: '/v1/chat/completions',
    auth: 'authorization',
    authValue: 'Bearer test-key',
    response: { id: 'chat_test', object: 'chat.completion', created: 1, model: 'test-model', choices: [{ index: 0, message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } },
  },
  {
    format: 'anthropic-messages',
    path: '/v1/messages',
    auth: 'x-api-key',
    authValue: 'test-key',
    response: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text: 'ready' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
  },
  {
    format: 'gemini',
    path: '/v1/models/test-model:generateContent',
    auth: 'x-goog-api-key',
    authValue: 'test-key',
    response: { candidates: [{ content: { role: 'model', parts: [{ text: 'ready' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }, modelVersion: 'test-model' },
  },
]

describe('official provider HTTP contracts', () => {
  it.each(cases)('$format sends the correct protocol to a configured gateway', async (fixture) => {
    const requests: { path: string, headers: Record<string, unknown>, body: Record<string, unknown> }[] = []
    const server = createServer(async (request, response) => {
      let body = ''
      for await (const chunk of request)
        body += chunk
      requests.push({ path: request.url!, headers: request.headers, body: JSON.parse(body) })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(fixture.response))
    })
    await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept))
    try {
      const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
      const model = assistantModelFromEnvironment({ CONFIG_FORM_AI_API_FORMAT: fixture.format, CONFIG_FORM_AI_MODEL: 'test-model', CONFIG_FORM_AI_API_KEY: 'test-key', CONFIG_FORM_AI_BASE_URL: baseURL })!
      expect((await generateText({ model, prompt: 'Test', maxRetries: 0, maxOutputTokens: 128 })).text).toBe('ready')
      expect(requests).toHaveLength(1)
      expect(requests[0]!.path).toBe(fixture.path)
      expect(requests[0]!.headers[fixture.auth]).toBe(fixture.authValue)
      expect(requests[0]!.body).not.toHaveProperty('apiKey')
    }
    finally { await new Promise<void>(accept => server.close(() => accept())) }
  })
})
