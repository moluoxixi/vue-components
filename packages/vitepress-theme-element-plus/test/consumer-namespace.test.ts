import { flushPromises, mount } from '@vue/test-utils'
import { ElButton, ElConfigProvider, useGlobalConfig } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import Layout from '../src/runtime/element-plus-docs-layout'
import ConsumerBoundary from '../src/runtime/ElementPlusDocsConsumerBoundary.vue'
import { provideDocsUi } from '../src/runtime/provide-docs-ui'

vi.mock('../src/upstream/vitepress/composables/lang', () => ({ useLang: () => ref('zh-CN') }))
const Consumer = defineComponent({
  setup() {
    const locale = useGlobalConfig('locale')
    return () => h(ElButton, { 'id': 'consumer-control', 'data-locale': locale.value?.name }, () => 'Consumer')
  },
})

const ThemeTools = defineComponent({
  setup() {
    provideDocsUi()
    return () => h('section', [
      h(ElButton, { id: 'theme-control' }, () => 'Theme'),
      h(ConsumerBoundary, null, () => h(Consumer)),
    ])
  },
})

vi.mock('../src/upstream/vitepress/components/vp-app.vue', () => ({
  __esModule: true,
  default: defineComponent({
    setup() {
      return () => h('main', [
        h(ElButton, { id: 'markdown-control' }, () => 'Direct Markdown consumer'),
        h(ThemeTools),
      ])
    },
  }),
}))

describe('documentation Element Plus namespace boundary', () => {
  it('preserves the default namespace without an ancestor provider', async () => {
    const wrapper = mount(Layout)
    await flushPromises()
    expect(wrapper.get('#theme-control').classes()).toContain('epd-button')
    expect(wrapper.get('#consumer-control').classes()).toContain('el-button')
    expect(wrapper.get('#markdown-control').classes()).toContain('el-button')
    wrapper.unmount()
  })

  it.each(['el', 'consumer'])('keeps the %s consumer namespace, locale and reactive provider updates', async (initial) => {
    const namespace = ref(initial)
    const wrapper = mount(defineComponent({
      setup: () => () => h(ElConfigProvider, { namespace: namespace.value }, () => h(Layout)),
    }))
    await flushPromises()
    expect(wrapper.get('#theme-control').classes()).toContain('epd-button')
    expect(wrapper.get('#consumer-control').classes()).toContain(`${initial}-button`)
    expect(wrapper.get('#markdown-control').classes()).toContain(`${initial}-button`)
    expect(wrapper.get('#consumer-control').attributes('data-locale')).toBe('zh-cn')
    namespace.value = 'changed'
    await flushPromises()
    expect(wrapper.get('#consumer-control').classes()).toContain('changed-button')
    expect(wrapper.get('#markdown-control').classes()).toContain('changed-button')
    expect(wrapper.get('#theme-control').classes()).toContain('epd-button')
    wrapper.unmount()
  })
})
