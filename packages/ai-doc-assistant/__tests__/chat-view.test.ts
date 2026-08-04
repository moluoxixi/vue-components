import type { ChatHistoryMessage, ExampleBlock, SourceRef, SseEvent } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

const streamQuery = vi.fn()

vi.mock('../src/ui/api', () => ({
  streamQuery: (...args: unknown[]) => streamQuery(...args),
}))

vi.mock('../src/ui/components/DemoPreview.vue', () => ({
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

async function mountChat(question = 'EnterNextContainer 怎么用？', onOpenSource = vi.fn()) {
  const { default: ChatView } = await import('../src/ui/views/ChatView.vue')
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

function answerOnce(answer: string, blocks: ExampleBlock[] = [], sources: SourceRef[] = []) {
  return async (
    _question: string,
    _topK: number,
    _history: ChatHistoryMessage[],
    onEvent: (event: SseEvent) => void,
  ) => {
    onEvent({ type: 'sources', sources })
    if (answer)
      onEvent({ type: 'token', text: answer })
    if (blocks.length > 0) {
      const first = blocks.find(block => block.renderable) ?? blocks[0]
      onEvent({
        type: 'example',
        code: first.ts,
        lang: 'vue',
        ts: first.ts,
        js: first.js ?? '',
        component: 'DemoComponent',
        packageName: '@moluoxixi/components',
        blocks,
      })
    }
    onEvent({ type: 'done' })
  }
}

describe('chat view', () => {
  beforeEach(() => {
    streamQuery.mockReset()
  })

  it('把提问表单固定在回答区域之后，并在知识库构建中提示等待', async () => {
    const { default: ChatView } = await import('../src/ui/views/ChatView.vue')
    const wrapper = mount(ChatView, {
      props: {
        'question': 'Button 怎么用？',
        'indexReady': false,
        'indexState': 'building',
        'onUpdate:question': vi.fn(),
      },
    })

    expect(wrapper.get('[data-testid="answer"]').exists()).toBe(true)
    expect(wrapper.element.lastElementChild).toBe(wrapper.get('[data-testid="ask-panel"]').element)
    expect(wrapper.get('[data-testid="chat-need-index"]').text()).toContain('正在准备')
    expect(wrapper.get('[data-testid="ask-btn"]').attributes('disabled')).toBeDefined()
  })

  it('回答正文没有 vue 代码块时，渲染后端 example 事件提供的回退 demo 块', async () => {
    const ts = '<script setup lang="ts"></script><template><EnterNextContainer /></template>'
    const js = '<script setup></script><template><EnterNextContainer /></template>'
    streamQuery.mockImplementationOnce(answerOnce(
      '这个组件用于 Enter 键聚焦下一项。',
      [{ ts, js, renderable: true }],
    ))

    const wrapper = await mountChat()
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    const demo = wrapper.get('[data-testid="answer-demo"]')
    expect(demo.attributes('data-ts')).toBe(ts)
    expect(demo.attributes('data-js')).toBe(js)
  })

  it('发送 trim 后的问题并清空输入框', async () => {
    streamQuery.mockImplementationOnce(answerOnce('回答'))
    const wrapper = await mountChat('  ElButton 怎么用？  ')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    expect(streamQuery).toHaveBeenCalledWith(
      'ElButton 怎么用？',
      5,
      [],
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect((wrapper.get('[data-testid="question-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('保留多轮回答，并把已完成轮次作为下一问历史', async () => {
    streamQuery
      .mockImplementationOnce(answerOnce('第一轮回答'))
      .mockImplementationOnce(answerOnce('第二轮回答'))
    const wrapper = await mountChat('第一问')

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="question-input"]').setValue('第二问')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="chat-turn"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('第一轮回答')
    expect(wrapper.text()).toContain('第二轮回答')
    expect(streamQuery.mock.calls[1][2]).toEqual([
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一轮回答' },
    ])
  })

  it('停止生成会中止 signal、保留部分回答，并排除该轮历史', async () => {
    let firstSignal: AbortSignal | undefined
    streamQuery.mockImplementationOnce(async (
      _question: string,
      _topK: number,
      _history: ChatHistoryMessage[],
      onEvent: (event: SseEvent) => void,
      signal: AbortSignal,
    ) => {
      firstSignal = signal
      onEvent({ type: 'token', text: '已生成部分' })
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    })

    const wrapper = await mountChat('会被停止的问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="stop-btn"]').trigger('click')
    await flushPromises()

    expect(firstSignal?.aborted).toBe(true)
    expect(wrapper.text()).toContain('已生成部分')
    expect(wrapper.text()).toContain('已停止')
    expect(wrapper.find('[data-testid="chat-error"]').exists()).toBe(false)

    streamQuery.mockImplementationOnce(answerOnce('新回答'))
    await wrapper.get('[data-testid="question-input"]').setValue('新问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()
    expect(streamQuery.mock.calls[1][2]).toEqual([])
  })

  it('组件卸载时中止仍在进行的请求', async () => {
    let signal: AbortSignal | undefined
    streamQuery.mockImplementationOnce(async (
      _question: string,
      _topK: number,
      _history: ChatHistoryMessage[],
      _onEvent: (event: SseEvent) => void,
      activeSignal: AbortSignal,
    ) => {
      signal = activeSignal
      await new Promise<void>(resolve => activeSignal.addEventListener('abort', () => resolve(), { once: true }))
    })
    const wrapper = await mountChat('未完成问题')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    wrapper.unmount()
    await flushPromises()
    expect(signal?.aborted).toBe(true)
  })

  it('点击来源时优先发送唯一 knowledgeKey', async () => {
    const onOpenSource = vi.fn()
    streamQuery.mockImplementationOnce(answerOnce('回答', [], [{
      component: 'CopyText',
      packageName: '@moluoxixi/components',
      docPath: 'copy-text.vue',
      score: 0.91,
      source: 'external',
      knowledgeKey: 'external:%40moluoxixi%2Fcomponents:CopyText',
    }]))
    const wrapper = await mountChat('CopyText', onOpenSource)

    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="source-button"]').trigger('click')

    expect(onOpenSource).toHaveBeenCalledWith('external:%40moluoxixi%2Fcomponents:CopyText')
  })

  it('按归一化后的源码匹配后端双码块', async () => {
    const inlineTs = '<script setup lang="ts">\nconst count = 1\n</script>\n<template><div>{{ count }}</div></template>'
    const backendTs = `${inlineTs}\n`
    const js = '<script setup>\nconst count = 1\n</script>\n<template><div>{{ count }}</div></template>'
    streamQuery.mockImplementationOnce(answerOnce(
      `示例：\n\`\`\`vue\n${inlineTs}\n\`\`\``,
      [{ ts: backendTs, js, renderable: true }],
    ))

    const wrapper = await mountChat('CounterDemo 怎么用？')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    const demo = wrapper.get('[data-testid="answer-demo"]')
    expect(demo.attributes('data-ts')).toBe(inlineTs)
    expect(demo.attributes('data-js')).toBe(js)
  })

  it('正文坏块不误挂，并追加可运行兜底 demo', async () => {
    const broken = '<script setup lang="ts">\nconst columns = [\n  { field: \'name\', title商品名称\', width: 150 },\n]\n</script>\n<template><PopoverTableSelect :columns="columns" /></template>'
    const fallback = '<script setup lang="ts"></script><template><PopoverTableSelect /></template>'
    streamQuery.mockImplementationOnce(answerOnce(
      `示例：\n\`\`\`vue\n${broken}\n\`\`\``,
      [
        { ts: broken, renderable: false, reason: '示例语法不可用，已改用兜底示例。' },
        { ts: fallback, js: '<script setup></script><template><PopoverTableSelect /></template>', renderable: true },
      ],
    ))

    const wrapper = await mountChat('PopoverTableSelect 怎么用？')
    await wrapper.get('[data-testid="ask-panel"]').trigger('submit')
    await flushPromises()

    const demos = wrapper.findAll('[data-testid="answer-demo"]')
    expect(demos).toHaveLength(2)
    expect(demos[0].attributes('data-renderable')).toBe('false')
    expect(demos[0].attributes('data-reason')).toContain('语法')
    expect(demos[1].attributes('data-ts')).toBe(fallback)
  })
})
