import type { ComponentListItem, HealthResponse, IndexStatusResponse } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const health: HealthResponse = {
  ok: true,
  providers: { chat: 'configured' },
  mode: 'content',
  index: 'ready',
}
const status: IndexStatusResponse = {
  state: 'ready',
  builtAt: 'now',
  stale: false,
  componentCount: 1,
}
const components: ComponentListItem[] = [
  { name: 'PopoverTableSelect', packageName: '@moluoxixi/components', propsCount: 8, docPath: 'x' },
]

vi.mock('../src/ui/api', () => ({
  fetchHealth: vi.fn(async () => health),
  fetchStatus: vi.fn(async () => status),
  fetchComponents: vi.fn(async () => components),
  buildIndex: vi.fn(async () => status),
}))

vi.mock('../src/ui/views/ChatView.vue', () => ({
  default: defineComponent({
    name: 'ChatView',
    props: { question: String, indexReady: Boolean },
    emits: ['update:question'],
    setup() {
      return () => h('section', { 'data-testid': 'chat-view' }, 'AI Chat')
    },
  }),
}))

describe('app shell', () => {
  it('默认展示 AI 对话，知识库总览放在调试弹框内', async () => {
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App, {
      global: {
        stubs: {
          ElDialog: defineComponent({
            name: 'ElDialog',
            props: { modelValue: Boolean },
            emits: ['update:modelValue'],
            setup(props, { slots }) {
              return () => props.modelValue
                ? h('section', { 'data-testid': 'kb-debug-dialog' }, slots.default?.())
                : null
            },
          }),
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="chat-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="overview-view"]').exists()).toBe(false)

    await wrapper.get('[data-testid="kb-debug-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="kb-debug-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="overview-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="component-card"]').text()).toContain('PopoverTableSelect')
  })
})
