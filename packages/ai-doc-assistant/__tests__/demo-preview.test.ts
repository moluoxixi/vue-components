/**
 * DemoPreview 组件单测：验证双码切换、复制、编译错误显式呈现与真实组件挂载契约。
 *
 * compileSfc 在单测环境（happy-dom）下 mock：真实浏览器运行时编译由 __e2e__ Playwright
 * 用真实组件断言（不信任日志），此处只验证组件自身的交互契约与对 compile 的调用契约。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

// 受控的 compileSfc mock：默认返回 { component, dispose }，可在用例内改写为抛错。
const compileSfc = vi.fn()
vi.mock('../src/ui/preview', () => ({
  compileSfc: (...args: unknown[]) => compileSfc(...args),
}))

/** 构造 compileSfc 成功返回值：真实实现返回 { component, dispose }。 */
function okResult(render?: () => unknown) {
  return {
    component: defineComponent({
      render: render ?? (() => h('div', { 'data-testid': 'real-comp' }, 'REAL')),
    }),
    dispose: vi.fn(),
  }
}

// 动态导入被测组件（确保 mock 在其依赖解析前生效）。
async function mountDemo(props?: Partial<{ ts: string, js: string, component: string, packageName: string, renderable: boolean, reason: string }>) {
  const { default: DemoPreview } = await import('../src/ui/components/DemoPreview.vue')
  return mount(DemoPreview, {
    props: {
      ts: 'TS_SOURCE',
      js: 'JS_SOURCE',
      component: 'PopoverTableSelect',
      packageName: '@moluoxixi/components',
      ...props,
    },
  })
}

describe('demoPreview', () => {
  beforeEach(() => {
    compileSfc.mockReset()
    // 默认：编译成功，返回 { component, dispose }，component 渲染可断言标记。
    compileSfc.mockResolvedValue(okResult())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('挂载即用 TS 源码编译并渲染真实组件', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    // 默认语言 TS，编译入参应为 ts 源码
    expect(compileSfc).toHaveBeenCalledTimes(1)
    expect(compileSfc.mock.calls[0][0]).toBe('TS_SOURCE')
    // 真实组件已挂载
    expect(wrapper.find('[data-testid="real-comp"]').exists()).toBe(true)
    // 代码块显示 TS 源码
    expect(wrapper.find('[data-testid="code-block"]').text()).toContain('TS_SOURCE')
    expect(wrapper.find('[data-testid="tab-ts"]').attributes('aria-selected')).toBe('true')
  })

  it('切到 JS 标签后用 JS 源码重新编译并切换代码块', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    await wrapper.find('[data-testid="tab-js"]').trigger('click')
    await flushPromises()
    // 第二次编译入参为 js 源码
    expect(compileSfc).toHaveBeenCalledTimes(2)
    expect(compileSfc.mock.calls[1][0]).toBe('JS_SOURCE')
    expect(wrapper.find('[data-testid="code-block"]').text()).toContain('JS_SOURCE')
    expect(wrapper.find('[data-testid="tab-js"]').attributes('aria-selected')).toBe('true')
  })

  it('复制按钮把当前语言源码写入剪贴板并回显已复制', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    await wrapper.find('[data-testid="copy-current"]').trigger('click')
    await flushPromises()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TS_SOURCE')
    expect(wrapper.find('[data-testid="copy-current"]').text()).toContain('已复制')
    // 切到 JS 后复制 JS 源码
    await wrapper.find('[data-testid="tab-js"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="copy-current"]').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('JS_SOURCE')
  })

  it('编译失败时显式呈现错误且不挂载组件（错误不被静默吞）', async () => {
    compileSfc.mockRejectedValueOnce(new Error('boom: 模板语法错误'))
    const wrapper = await mountDemo()
    await flushPromises()
    const err = wrapper.find('[data-testid="demo-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('boom: 模板语法错误')
    expect(wrapper.find('[data-testid="real-comp"]').exists()).toBe(false)
  })

  it('编译回调上报的 error 也被呈现', async () => {
    compileSfc.mockImplementationOnce(async (_src: string, onError: (e: unknown) => void) => {
      onError(new Error('运行期错误'))
      return okResult(() => h('div'))
    })
    const wrapper = await mountDemo()
    await flushPromises()
    expect(wrapper.find('[data-testid="demo-error"]').text()).toContain('运行期错误')
  })

  it('复制失败（剪贴板 reject）时显式提示而非静默吞', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('权限被拒')) },
      configurable: true,
    })
    const wrapper = await mountDemo()
    await flushPromises()
    await wrapper.find('[data-testid="copy-current"]').trigger('click')
    await flushPromises()
    // 失败信息显式呈现，按钮回显「复制失败」，错误不被静默吞
    const err = wrapper.find('[data-testid="copy-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('权限被拒')
    expect(wrapper.find('[data-testid="copy-current"]').text()).toContain('复制失败')
  })

  it('源码区默认折叠，点击操作栏后展开、再点收起（对齐 Element Plus 官网交互）', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    // 预览区始终可见；源码区由 v-show 控制，默认折叠
    expect(wrapper.find('[data-testid="demo-live"]').exists()).toBe(true)
    const codeEl = wrapper.find('[data-testid="demo-code"]')
    expect(codeEl.exists()).toBe(true)
    expect((codeEl.element as HTMLElement).style.display).toBe('none')
    const toggle = wrapper.find('[data-testid="toggle-code"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.text()).toContain('查看源码')
    // 点击展开
    await toggle.trigger('click')
    expect((codeEl.element as HTMLElement).style.display).not.toBe('none')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toContain('收起源码')
    // 再点收起
    await toggle.trigger('click')
    expect((codeEl.element as HTMLElement).style.display).toBe('none')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('快速切换语言时仅最新一次编译结果生效（并发守卫）', async () => {
    // 第一次（TS）编译挂起，第二次（JS）先 resolve；最终应呈现 JS 的组件，且第一次结果被丢弃。
    let resolveFirst!: (v: unknown) => void
    compileSfc
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(okResult(() => h('div', { 'data-testid': 'js-comp' }, 'JS')))
    const wrapper = await mountDemo()
    // 立即切到 JS，触发第二次编译
    await wrapper.find('[data-testid="tab-js"]').trigger('click')
    await flushPromises()
    // 现在让第一次（陈旧）编译 resolve，其 dispose 应被调用、结果不覆盖最新组件
    const firstDispose = vi.fn()
    resolveFirst({ component: defineComponent({ render: () => h('div', { 'data-testid': 'ts-comp' }) }), dispose: firstDispose })
    await flushPromises()
    expect(wrapper.find('[data-testid="js-comp"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ts-comp"]').exists()).toBe(false)
    expect(firstDispose).toHaveBeenCalledTimes(1)
  })

  it('未提供 js 源码时隐藏 JS 切换，仅展示 TS', async () => {
    const wrapper = await mountDemo({ js: undefined })
    await flushPromises()
    // 无独立 JS 版本 → 不渲染 JS tab（不伪造降级）
    expect(wrapper.find('[data-testid="tab-js"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tab-ts"]').exists()).toBe(true)
    // 仍正常编译挂载 TS
    expect(wrapper.find('[data-testid="real-comp"]').exists()).toBe(true)
    expect(compileSfc.mock.calls[0][0]).toBe('TS_SOURCE')
  })

  it('renderable=false 时不编译，仅展示源码与不可渲染原因', async () => {
    const wrapper = await mountDemo({ renderable: false, reason: '该示例依赖 element-plus，预览环境未提供' })
    await flushPromises()
    // 不可渲染 → 不调用编译，不挂载真实组件
    expect(compileSfc).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="real-comp"]').exists()).toBe(false)
    // 显式展示原因
    const hint = wrapper.find('[data-testid="demo-unrenderable"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('element-plus')
    // 源码仍可查看（展开后）
    await wrapper.find('[data-testid="toggle-code"]').trigger('click')
    expect(wrapper.find('[data-testid="code-block"]').text()).toContain('TS_SOURCE')
  })
})
