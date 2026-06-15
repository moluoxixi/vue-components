import type { SseEvent } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const streamQuery = vi.fn()

vi.mock('../src/ui/api', () => ({
  streamQuery: (...args: unknown[]) => streamQuery(...args),
}))

vi.mock('../src/ui/components', () => ({
  DemoPreview: defineComponent({
    name: 'DemoPreviewStub',
    props: {
      ts: { type: String, required: true },
      js: { type: String, required: false },
      component: { type: String, required: false },
      packageName: { type: String, required: false },
      renderable: { type: Boolean, required: false },
      reason: { type: String, required: false },
    },
    setup(props) {
      return () => h('section', {
        'data-testid': 'answer-demo',
        'data-ts': props.ts,
        'data-js': props.js,
        'data-component': props.component,
        'data-package': props.packageName,
        'data-renderable': props.renderable === false ? 'false' : 'true',
        'data-reason': props.reason,
      })
    },
  }),
}))

async function mountChat(question = 'EnterNextContainer 怎么用？') {
  const { default: ChatView } = await import('../src/ui/views/ChatView.vue')
  return mount(ChatView, {
    props: {
      'question': question,
      'indexReady': true,
      'onUpdate:question': vi.fn(),
    },
  })
}

describe('chat view', () => {
  it('回答正文没有 vue 代码块时，渲染后端 example 事件提供的回退 demo 块', async () => {
    const ts = '<script setup lang="ts"></script><template><EnterNextContainer /></template>'
    const js = '<script setup></script><template><EnterNextContainer /></template>'
    streamQuery.mockImplementationOnce(async (
      _question: string,
      _topK: number,
      onEvent: (event: SseEvent) => void,
    ) => {
      onEvent({ type: 'sources', sources: [] })
      onEvent({ type: 'token', text: '这个组件用于 Enter 键聚焦下一项。' })
      onEvent({
        type: 'example',
        code: ts,
        lang: 'vue',
        ts,
        js,
        component: 'EnterNextContainer',
        packageName: '@moluoxixi/components',
        blocks: [{ ts, js, renderable: true }],
      })
      onEvent({ type: 'done' })
    })

    const wrapper = await mountChat()
    await wrapper.get('[data-testid="ask-btn"]').trigger('click')
    await flushPromises()

    const demo = wrapper.get('[data-testid="answer-demo"]')
    expect(demo.attributes('data-ts')).toBe(ts)
    expect(demo.attributes('data-js')).toBe(js)
    expect(demo.attributes('data-component')).toBeUndefined()
    expect(demo.attributes('data-package')).toBeUndefined()
  })

  it('按归一化后的源码匹配后端双码块，避免尾随空白导致 JS 切换丢失', async () => {
    const inlineTs = '<script setup lang="ts">\nconst count = 1\n</script>\n<template><div>{{ count }}</div></template>'
    const backendTs = `${inlineTs}\n`
    const js = '<script setup>\nconst count = 1\n</script>\n<template><div>{{ count }}</div></template>'
    streamQuery.mockImplementationOnce(async (
      _question: string,
      _topK: number,
      onEvent: (event: SseEvent) => void,
    ) => {
      onEvent({ type: 'sources', sources: [] })
      onEvent({ type: 'token', text: `示例：\n\`\`\`vue\n${inlineTs}\n\`\`\`` })
      onEvent({
        type: 'example',
        code: backendTs,
        lang: 'vue',
        ts: backendTs,
        js,
        component: 'CounterDemo',
        packageName: '@moluoxixi/components',
        blocks: [{ ts: backendTs, js, renderable: true }],
      })
      onEvent({ type: 'done' })
    })

    const wrapper = await mountChat('CounterDemo 怎么用？')
    await wrapper.get('[data-testid="ask-btn"]').trigger('click')
    await flushPromises()

    const demo = wrapper.get('[data-testid="answer-demo"]')
    expect(demo.attributes('data-ts')).toBe(inlineTs)
    expect(demo.attributes('data-js')).toBe(js)
  })

  it('正文内 vue 块使用后端 renderable 判定，坏块不误挂并追加兜底 demo', async () => {
    const broken = '<script setup lang="ts">\nconst columns = [\n  { field: \'name\', title商品名称\', width: 150 },\n]\n</script>\n<template><PopoverTableSelect :columns="columns" /></template>'
    const fallback = '<script setup lang="ts"></script><template><PopoverTableSelect /></template>'
    streamQuery.mockImplementationOnce(async (
      _question: string,
      _topK: number,
      onEvent: (event: SseEvent) => void,
    ) => {
      onEvent({ type: 'sources', sources: [] })
      onEvent({ type: 'token', text: `示例：\n\`\`\`vue\n${broken}\n\`\`\`` })
      onEvent({
        type: 'example',
        code: fallback,
        lang: 'vue',
        ts: fallback,
        js: '<script setup></script><template><PopoverTableSelect /></template>',
        component: 'PopoverTableSelect',
        packageName: '@moluoxixi/components',
        blocks: [
          { ts: broken, renderable: false, reason: '示例语法不可用，已改用兜底示例。' },
          { ts: fallback, js: '<script setup></script><template><PopoverTableSelect /></template>', renderable: true },
        ],
      })
      onEvent({ type: 'done' })
    })

    const wrapper = await mountChat('PopoverTableSelect 怎么用？')
    await wrapper.get('[data-testid="ask-btn"]').trigger('click')
    await flushPromises()

    const demos = wrapper.findAll('[data-testid="answer-demo"]')
    expect(demos).toHaveLength(2)
    expect(demos[0].attributes('data-ts')).toBe(broken)
    expect(demos[0].attributes('data-renderable')).toBe('false')
    expect(demos[0].attributes('data-reason')).toContain('语法')
    expect(demos[1].attributes('data-ts')).toBe(fallback)
    expect(demos[1].attributes('data-renderable')).toBe('true')
  })
})
