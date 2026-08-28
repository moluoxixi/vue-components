import type { ComponentListItem, HealthResponse, IndexStatusResponse } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import WorkspaceTopbar from '../src/ui/components/WorkspaceTopbar.vue'

const readyHealth: HealthResponse = {
  ok: true,
  providers: {
    chat: { availability: 'configured', provider: 'openai', model: 'gpt-4o-mini' },
    embedding: { availability: 'missing', provider: null, model: null },
  },
  mode: 'content',
  index: 'ready',
}
const readyStatus: IndexStatusResponse = {
  state: 'ready',
  builtAt: 'now',
  stale: false,
  componentCount: 1,
  internalCount: 1,
  externalCount: 0,
  embeddingIdentity: null,
}
const components: ComponentListItem[] = [
  { name: 'PopoverTableSelect', packageName: '@moluoxixi/components', propsCount: 8, docPath: 'x', knowledgeKey: 'internal:%40moluoxixi%2Fcomponents:PopoverTableSelect' },
]

let health: HealthResponse = readyHealth
let status: IndexStatusResponse = readyStatus
const buildIndexMock = vi.fn(async () => status)
const fetchHealthMock = vi.fn(async () => health)
const fetchStatusMock = vi.fn(async () => status)
const fetchComponentsMock = vi.fn(async () => components)

vi.mock('../src/ui/api', () => ({
  fetchHealth: () => fetchHealthMock(),
  fetchStatus: () => fetchStatusMock(),
  fetchComponents: () => fetchComponentsMock(),
  buildIndex: () => buildIndexMock(),
}))

vi.mock('../src/ui/views/ChatView.vue', () => ({
  default: defineComponent({
    name: 'ChatView',
    props: { question: String, indexReady: Boolean, indexState: String },
    emits: ['update:question', 'open-source'],
    setup(props, { emit }) {
      return () => h('section', { 'data-testid': 'chat-view' }, [
        `AI Chat ${props.indexState}:${props.indexReady}`,
        h('button', {
          'data-testid': 'chat-source',
          'onClick': () => emit('open-source', 'internal:%40moluoxixi%2Fcomponents:PopoverTableSelect'),
        }, 'source'),
      ])
    },
  }),
}))

vi.mock('../src/ui/views/DetailView.vue', () => ({
  default: defineComponent({
    name: 'DetailView',
    props: { name: String },
    emits: ['back', 'ask'],
    setup(props) {
      return () => h('section', { 'data-testid': 'detail-view' }, props.name)
    },
  }),
}))

describe('app shell', () => {
  beforeEach(() => {
    health = readyHealth
    status = readyStatus
    buildIndexMock.mockClear()
    buildIndexMock.mockImplementation(async () => status)
    fetchHealthMock.mockReset()
    fetchHealthMock.mockImplementation(async () => health)
    fetchStatusMock.mockReset()
    fetchStatusMock.mockImplementation(async () => status)
    fetchComponentsMock.mockReset()
    fetchComponentsMock.mockImplementation(async () => components)
  })

  it('默认展示 AI 对话，并将知识库作为保留 Chat 挂载的一级视图', async () => {
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('[data-testid="chat-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="overview-view"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="build-btn"]').exists()).toBe(false)

    await wrapper.get('[data-testid="workspace-knowledge-tab"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="chat-view"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="chat-view"]').element.parentElement as HTMLElement).style.display).toBe('none')
    expect(wrapper.find('[data-testid="knowledge-workspace"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="overview-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="component-card"]').text()).toContain('PopoverTableSelect')
  })

  it('content 模式首次未就绪时自动构建知识库', async () => {
    status = {
      state: 'not_built',
      builtAt: null,
      stale: false,
      componentCount: 0,
      internalCount: 0,
      externalCount: 0,
      embeddingIdentity: null,
    }
    let resolveBuild!: (value: IndexStatusResponse) => void
    buildIndexMock.mockImplementationOnce(() => new Promise<IndexStatusResponse>((resolve) => {
      resolveBuild = resolve
    }))

    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    expect(buildIndexMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="chat-view"]').text()).toContain('building:false')

    resolveBuild(readyStatus)
    await flushPromises()

    expect(wrapper.get('[data-testid="chat-view"]').text()).toContain('ready:true')
  })

  it('点击 AI 来源后直接打开对应知识库详情', async () => {
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="chat-source"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="detail-view"]').text())
      .toBe('internal:%40moluoxixi%2Fcomponents:PopoverTableSelect')
  })

  it('首次请求未返回时显示连接中，而不是未构建空态', async () => {
    let resolveHealth!: (value: HealthResponse) => void
    fetchHealthMock.mockImplementationOnce(() => new Promise<HealthResponse>((resolve) => {
      resolveHealth = resolve
    }))
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.get('[data-testid="index-chip"]').text()).toContain('正在连接')

    resolveHealth(readyHealth)
    await flushPromises()
    expect(wrapper.get('[data-testid="index-chip"]').text()).toContain('知识库可用')
  })

  it('vector 运行态披露远程 embedding 的数据与费用边界', async () => {
    health = {
      ...readyHealth,
      mode: 'vector',
      providers: {
        ...readyHealth.providers,
        embedding: {
          availability: 'configured',
          provider: 'google',
          model: 'gemini-embedding-001',
        },
      },
    }
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    const detail = wrapper.findComponent(WorkspaceTopbar).props('statusDetail')
    expect(detail).toContain('远程 embedding google/gemini-embedding-001')
    expect(detail).toContain('组件契约会发送给 Provider，并可能产生费用')
  })

  it('组件列表失败时在知识库内显示错误并可重试', async () => {
    fetchComponentsMock.mockRejectedValueOnce(new Error('组件列表离线'))
    const { default: App } = await import('../src/ui/App.vue')
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.get('[data-testid="error-bar"]').attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="workspace-knowledge-tab"]').trigger('click')
    expect(wrapper.get('[data-testid="overview-error"]').text()).toContain('组件列表离线')

    await wrapper.get('[data-testid="overview-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="overview-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="component-card"]').exists()).toBe(true)
  })
})
