import type { LivePreviewSession } from '@moluoxixi/config-form-studio/client'
import { createStudioNode } from '@moluoxixi/config-form-studio'
import { WORKSPACE_API_PATH, WORKSPACE_REQUEST_HEADER, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { assistantModelFromEnvironment } from '../src/services/assistant'
import { startLocalWorkspace } from '../src/services/server'
import { cleanup, temporaryWorkspace } from './helpers'

type StreamPart = Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer T> ? T : never

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }

async function workspace(model?: MockLanguageModelV3) {
  const service = await startLocalWorkspace({ directory: await temporaryWorkspace(), port: 0, assistant: { model } })
  cleanup(() => service.close())
  return { ...service, call: <T = LivePreviewSession>(path: string, input: unknown = {}) => workspaceRequest<T>(`${service.url}${WORKSPACE_API_PATH}${path}`, input) }
}

describe('conversation and live preview', () => {
  it('streams a real AI SDK tool call into an undoable draft before saving', async () => {
    const node = createStudioNode({ preset: 'element-plus', component: 'element.input', id: 'customer', field: 'customer', label: '客户名称' })
    let step = 0
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream<StreamPart>({
      chunks: step++ === 0
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'insert', toolName: 'apply_operations', input: JSON.stringify({ label: '添加客户名称', expectedSessionRevision: 0, operations: [{ type: 'node.insert', surfaceId: 'home', subgraph: node, target: { parentId: null } }] }) },
            { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
          ]
        : [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: '已添加客户名称，可以继续调整。' },
            { type: 'text-end', id: 'answer' },
            { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
          ],
      initialDelayInMs: null,
      chunkDelayInMs: null,
    }) }) })
    const app = await workspace(model)
    const session = await app.call('/preview-session/create', { preset: 'element-plus' })
    const response = await fetch(`${app.url}${WORKSPACE_API_PATH}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', [WORKSPACE_REQUEST_HEADER]: '1' }, body: JSON.stringify({ sessionId: session.id, message: '添加客户名称', expectedSessionRevision: 0 }) })
    expect(response.ok).toBe(true)
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
    expect(events.map(event => event.type)).toEqual(expect.arrayContaining(['started', 'preview', 'text', 'done']))
    const current = await app.call('/preview-session/read', { sessionId: session.id })
    expect(current.document.surfacesById.home?.graph.nodesById.customer).toMatchObject({ field: 'customer', label: '客户名称' })
    expect(current).toMatchObject({ revision: 1, dirty: true, busy: false, canUndo: true })
    expect(await app.repository.get(session.document.id)).toBeUndefined()
    expect((await app.call('/preview-session/save', { sessionId: session.id, expectedSessionRevision: 1 })).dirty).toBe(false)
    expect((await app.repository.get(session.document.id))?.document.surfacesById.home?.graph.root).toHaveLength(1)
    const undone = await app.call('/preview-session/undo', { sessionId: session.id, expectedSessionRevision: 1 })
    expect(undone.document.surfacesById.home?.graph.root).toEqual([])
    expect(undone).toMatchObject({ revision: 2, dirty: true })
  })

  it('rejects invalid batches and stale edits, replays retries, and preserves concurrent saved changes', async () => {
    const app = await workspace()
    const session = await app.call('/preview-session/create', { preset: 'antd-vue' })
    const input = { sessionId: session.id, commandId: 'rename', expectedSessionRevision: 0, label: '命名表单', operations: [{ type: 'project.rename', name: '联系人' }] }
    await app.call('/preview-session/apply', input)
    expect((await app.call('/preview-session/apply', input)).revision).toBe(1)
    await expect(app.call('/preview-session/apply', { ...input, commandId: 'stale' })).rejects.toMatchObject({ code: 'PREVIEW_CONFLICT' })
    await expect(app.call('/preview-session/apply', { ...input, label: 'changed' })).rejects.toMatchObject({ code: 'PREVIEW_COMMAND_REUSED' })
    await expect(app.call('/preview-session/apply', { ...input, commandId: 'invalid', expectedSessionRevision: 1, operations: [{ type: 'project.rename', name: 'Should not persist' }, { type: 'node.remove', surfaceId: 'home', nodeId: 'missing' }] })).rejects.toMatchObject({ code: 'PREVIEW_INVALID' })
    expect((await app.call('/preview-session/read', { sessionId: session.id })).document.name).toBe('联系人')
    await app.call('/preview-session/save', { sessionId: session.id, expectedSessionRevision: 1 })
    const persisted = (await app.repository.get(session.document.id))!
    await app.repository.commit({ id: session.document.id, document: { ...persisted.document, name: '人工修改' }, expectedRepositoryRevision: 0, commandId: 'human', metadata: { source: 'manual' } })
    await app.call('/preview-session/apply', { ...input, commandId: 'next', expectedSessionRevision: 1, operations: [{ type: 'project.rename', name: 'AI 修改' }] })
    await expect(app.call('/preview-session/save', { sessionId: session.id, expectedSessionRevision: 2 })).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    expect((await app.repository.get(session.document.id))?.document.name).toBe('人工修改')
    expect((await app.call('/preview-session/read', { sessionId: session.id })).dirty).toBe(true)
    expect(await app.call('/ai/status')).toEqual({ configured: false })
  })

  it('never exposes upstream credentials in stream failures', async () => {
    const model = new MockLanguageModelV3({ doStream: async () => {
      throw new Error('secret-test-key https://private-gateway.invalid?key=secret-test-key')
    } })
    const app = await workspace(model)
    const session = await app.call('/preview-session/create', {})
    const response = await fetch(`${app.url}${WORKSPACE_API_PATH}/ai/chat`, { method: 'POST', headers: { [WORKSPACE_REQUEST_HEADER]: '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, message: '测试', expectedSessionRevision: 0 }) })
    const text = await response.text()
    expect(text).toContain('"type":"error"')
    expect(text).not.toContain('secret-test-key')
    expect(text).not.toContain('private-gateway')
    expect((await app.call('/preview-session/read', { sessionId: session.id })).busy).toBe(false)
  })

  it('stops generation, releases the session and retains completed edits', async () => {
    let step = 0
    const model = new MockLanguageModelV3({ doStream: async (options) => {
      if (step++ === 0) {
        return { stream: simulateReadableStream<StreamPart>({ chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'tool-call', toolCallId: 'rename', toolName: 'apply_operations', input: JSON.stringify({ label: '命名草稿', expectedSessionRevision: 0, operations: [{ type: 'project.rename', name: '已完成的修改' }] }) },
          { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
        ], initialDelayInMs: null, chunkDelayInMs: null }) }
      }
      return { stream: new ReadableStream<StreamPart>({ start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] })
        const cancel = () => controller.error(new DOMException('Stopped', 'AbortError'))
        if (options.abortSignal?.aborted)
          cancel()
        else
          options.abortSignal?.addEventListener('abort', cancel, { once: true })
      } }) }
    } })
    const app = await workspace(model)
    const session = await app.call('/preview-session/create', {})
    const response = await fetch(`${app.url}${WORKSPACE_API_PATH}/ai/chat`, { method: 'POST', headers: { [WORKSPACE_REQUEST_HEADER]: '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, message: '命名并继续生成', expectedSessionRevision: 0 }) })
    await expect.poll(async () => (await app.call('/preview-session/read', { sessionId: session.id })).revision).toBe(1)
    await expect(app.call('/preview-session/undo', { sessionId: session.id, expectedSessionRevision: 1 })).rejects.toMatchObject({ code: 'PREVIEW_BUSY' })
    await app.call('/preview-session/stop', { sessionId: session.id })
    expect(await response.text()).toContain('"type":"stopped"')
    const current = await app.call('/preview-session/read', { sessionId: session.id })
    expect(current).toMatchObject({ busy: false, dirty: true, document: { name: '已完成的修改' } })
    await app.call('/preview-session/close', { sessionId: session.id })
    await expect(app.call('/preview-session/read', { sessionId: session.id })).rejects.toMatchObject({ code: 'PREVIEW_NOT_FOUND' })
  })

  it.each(['openai-responses', 'openai-chat-completions', 'anthropic-messages', 'gemini'])('configures %s through official AI SDK providers', (format) => {
    const target = assistantModelFromEnvironment({ CONFIG_FORM_AI_API_FORMAT: format, CONFIG_FORM_AI_MODEL: 'model', CONFIG_FORM_AI_API_KEY: 'test', CONFIG_FORM_AI_BASE_URL: 'http://127.0.0.1:9999/v1' })
    expect(target?.modelId).toBe('model')
    expect(target?.provider).toBe(({ 'openai-responses': 'openai.responses', 'openai-chat-completions': 'openai.chat', 'anthropic-messages': 'anthropic.messages', 'gemini': 'google.generative-ai' })[format])
  })
})
