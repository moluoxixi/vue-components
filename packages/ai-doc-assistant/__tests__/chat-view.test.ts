import type { ExampleBlock, SourceRef } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

const fetchMock = vi.fn<typeof fetch>()
const requestBodies: Array<Record<string, unknown>> = []

vi.mock('../src/ui/App/components/ChatView/components/DemoPreview.vue', () => ({
  default: defineComponent({
    name: 'DemoPreviewStub',
    props: {
      ts: { type: String, required: true },
      js: { type: String, required: false },
      renderable: { type: Boolean, required: false },
      reason: { type: String, required: false },
    },
    setup(props) {
      return () => h('section', {
        'data-testid': 'answer-demo',
        'data-ts': props.ts,
        'data-js': props.js,
        'data-renderable': props.renderable === false ? 'false' : 'true',
        'data-reason': props.reason,
      })
    },
  }),
}))

interface StreamFixture {
  answer?: string
  blocks?: ExampleBlock[]
  sources?: SourceRef[]
  failAfterText?: string
  waitForAbort?: boolean
}

function streamResponse(fixture: StreamFixture, signal?: AbortSignal | null): Response {
  const answer = fixture.answer ?? ''
  const stream = createUIMessageStream({
    onError: error => error instanceof Error ? error.message : String(error),
    execute: async ({ writer }) => {
      writer.write({ type: 'data-sources', data: fixture.sources ?? [] })
      writer.write({ type: 'start' })
      writer.write({ type: 'start-step' })
      writer.write({ type: 'text-start', id: 'answer' })
      if (answer)
        writer.write({ type: 'text-delta', id: 'answer', delta: answer })
      if (fixture.waitForAbort) {
        await new Promise<void>((resolve) => {
          if (signal?.aborted)
            resolve()
          else
            signal?.addEventListener('abort', () => resolve(), { once: true })
        })
        signal?.throwIfAborted()
      }
      if (fixture.failAfterText)
        throw new Error(fixture.failAfterText)
      writer.write({ type: 'text-end', id: 'answer' })
      writer.write({ type: 'finish-step' })
      if (fixture.blocks?.length) {
        writer.write({
          type: 'data-example',
          data: { blocks: fixture.blocks },
        })
      }
      writer.write({ type: 'finish', finishReason: 'stop' })
    },
  })
  return createUIMessageStreamResponse({ stream })
}

function answerOnce(fixture: StreamFixture): void {
  fetchMock.mockImplementationOnce(async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return streamResponse(fixture, init?.signal)
  })
}

function failOnce(message: string): void {
  fetchMock.mockImplementationOnce(async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return new Response(JSON.stringify({ error: 'UPSTREAM_ERROR', message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  })
}

async function mountChat(question = 'EnterNextContainer 怎么用？', onOpenSource = vi.fn()) {
  const { default: ChatView } = await import('../src/ui/App/components/ChatView/index.vue')
  const Host = defineComponent({
    setup() {
      const value = ref(question)
      return () => h(ChatView, {
        'question': value.value,
        'indexReady': true,
        'indexState': 'ready',
        'onUpdate:question': (next: string) => {
          value.value = next
        },
        'onOpen-source': onOpenSource,
      })
    },
  })
  return mount(Host)
}

describe('chat view', () => {
  beforeEach(() => {
    requestBodies.length = 0
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the ask panel after the answer area and disables it while the index builds', async () => {
    const { default: ChatView } = await import('../src/ui/App/components/ChatView/index.vue')
    const wrapper = mount(ChatView, {
      props: {
        'question': 'Button 怎么用？',
        'indexReady': false,
        'indexState': 'building',
        'onUpdate:question': vi.fn(),
      },
    })

    expect(wrapper.element.lastElementChild).toBe(wrapper.get('[data-testid="ask-panel"]').element)
    expect(wrapper.get('[data-testid="chat-need-index"]').text()).toContain('正在准备')
    expect(wrapper.get('[data-testid="ask-btn"]').attributes('disabled')).toBeDefined()
  })

  it('sends a trimmed UI message and renders text, sources, Markdown, and examples', async () => {
    const ts = '<template><EnterNextContainer /></template>'
    const source: SourceRef = {
      component: 'EnterNextContainer',
      packageName: '@moluoxixi/components',
      docPath: 'enter-next.vue',
      score: 0.91,
      source: 'external',
      knowledgeKey: 'external:%40moluoxixi%2Fcomponents:EnterNextContainer',
    }
    const onOpenSource = vi.fn()
    answerOnce({
      answer: '## 用法\n\n- 先配置',
      blocks: [{ ts, renderable: true }],
      sources: [source],
    })
    const wrapper = await mountChat('  EnterNextContainer 怎么用？  ', onOpenSource)

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('先配置'))

    const sent = requestBodies[0].messages as Array<{ parts: Array<{ text?: string }> }>
    expect(sent[0].parts[0].text).toBe('EnterNextContainer 怎么用？')
    expect((wrapper.get('[data-testid="question-input"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('[data-testid="answer-text"] h2').text()).toBe('用法')
    expect(wrapper.get('[data-testid="answer-demo"]').attributes('data-ts')).toBe(ts)
    await wrapper.get('[data-testid="source-button"]').trigger('click')
    expect(onOpenSource).toHaveBeenCalledWith(source.knowledgeKey)
    expect(wrapper.get('[data-testid="source-button"]').text()).toContain('0.910')
  })

  it('keeps completed rounds and sends only text parts as the next history', async () => {
    answerOnce({ answer: '第一轮回答', sources: [{
      component: 'Button',
      packageName: '@x/c',
      docPath: 'button.vue',
      score: 1,
    }] })
    answerOnce({ answer: '第二轮回答' })
    const wrapper = await mountChat('第一问')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('第一轮回答'))
    await wrapper.get('[data-testid="question-input"]').setValue('第二问')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('第二轮回答'))

    expect(wrapper.findAll('[data-testid="chat-turn"]')).toHaveLength(2)
    const history = requestBodies[1].messages as Array<{ role: string, parts: Array<{ type: string, text?: string }> }>
    expect(history.map(message => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(history[1].parts).toEqual([{ type: 'text', text: '第一轮回答' }])
  })

  it('stops an active response, keeps partial text, and excludes it from later history', async () => {
    answerOnce({ answer: '已生成部分', waitForAbort: true })
    answerOnce({ answer: '新回答' })
    const wrapper = await mountChat('会被停止的问题')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('已生成部分'))
    await wrapper.get('[data-testid="stop-btn"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('已停止'))

    expect(wrapper.find('[data-testid="chat-error"]').exists()).toBe(false)
    await wrapper.get('[data-testid="question-input"]').setValue('新问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('新回答'))
    expect(requestBodies[1].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user' }),
    ]))
    expect(requestBodies[1].messages).toHaveLength(1)
  })

  it('persists a request error on its original user turn after the next question', async () => {
    failOnce('provider unavailable')
    answerOnce({ answer: '恢复后的回答' })
    const wrapper = await mountChat('失败问题')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="chat-error"]').exists()).toBe(true))
    await wrapper.get('[data-testid="question-input"]').setValue('新问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('恢复后的回答'))

    const turns = wrapper.findAll('[data-testid="chat-turn"]')
    expect(turns).toHaveLength(2)
    expect(turns[0].text()).toContain('provider unavailable')
    expect(requestBodies[1].messages).toHaveLength(1)
  })

  it('keeps partial text and an error outcome when the UI message stream fails', async () => {
    answerOnce({ answer: '残缺回答', failAfterText: 'query stream interrupted' })
    const wrapper = await mountChat('会断流的问题')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('残缺回答'))
    await vi.waitFor(() => expect(wrapper.get('[data-testid="chat-error"]').text()).toContain('interrupted'))
  })

  it('clears the conversation and aborts an active request', async () => {
    answerOnce({ answer: '部分回答', waitForAbort: true })
    const wrapper = await mountChat('第一问')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('部分回答'))

    await wrapper.get('[data-testid="clear-chat"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="chat-turn"]')).toHaveLength(0)
  })

  it('aborts an active request when unmounted', async () => {
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementationOnce(async (_input, init) => {
      signal = init?.signal
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return streamResponse({ answer: '部分', waitForAbort: true }, signal)
    })
    const wrapper = await mountChat('未完成问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('部分'))

    wrapper.unmount()
    await vi.waitFor(() => expect(signal?.aborted).toBe(true))
  })
})
