import type { ComponentListItem, HealthResponse, IndexStatusResponse } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const readyHealth: HealthResponse = {
  ok: true,
  providers: { chat: 'configured' },
  mode: 'content',
  index: 'ready',
}
const readyStatus: IndexStatusResponse = {
  state: 'ready',
  builtAt: 'now',
  stale: false,
  componentCount: 1,
}
const components: ComponentListItem[] = [
  { name: 'PopoverTableSelect', packageName: '@moluoxixi/components', propsCount: 8, docPath: 'x' },
]

let health: HealthResponse = readyHealth
let status: IndexStatusResponse = readyStatus
const buildIndexMock = vi.fn(async () => status)

vi.mock('../src/ui/api', () => ({
  fetchHealth: vi.fn(async () => health),
  fetchStatus: vi.fn(async () => status),
  fetchComponents: vi.fn(async () => components),
  buildIndex: () => buildIndexMock(),
}))

vi.mock('../src/ui/views/ChatView.vue', () => ({
  default: defineComponent({
    name: 'ChatView',
    props: { question: String, indexReady: Boolean, indexState: String },
    emits: ['update:question'],
    setup(props) {
      return () => h('section', { 'data-testid': 'chat-view' }, `AI Chat ${props.indexState}:${props.indexReady}`)
    },
  }),
}))

describe('app shell', () => {
  beforeEach(() => {
    health = readyHealth
    status = readyStatus
    buildIndexMock.mockClear()
    buildIndexMock.mockImplementation(async () => status)
  })

  it('默认展示 AI 对话，知识库总览放在知识库弹框内', async () => {
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
    expect(wrapper.find('[data-testid="build-btn"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="kb-debug-btn"]').text()).toBe('知识库')

    await wrapper.get('[data-testid="kb-debug-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="kb-debug-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="overview-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="component-card"]').text()).toContain('PopoverTableSelect')
  })

  it('content 模式首次未就绪时自动构建知识库', async () => {
    status = {
      state: 'not_built',
      builtAt: null,
      stale: false,
      componentCount: 0,
    }
    let resolveBuild!: (value: IndexStatusResponse) => void
    buildIndexMock.mockImplementationOnce(() => new Promise<IndexStatusResponse>((resolve) => {
      resolveBuild = resolve
    }))

    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App, {
      global: {
        stubs: {
          ElDialog: true,
        },
      },
    })
    await flushPromises()

    expect(buildIndexMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="chat-view"]').text()).toContain('building:false')

    resolveBuild(readyStatus)
    await flushPromises()

    expect(wrapper.get('[data-testid="chat-view"]').text()).toContain('ready:true')
  })
})
