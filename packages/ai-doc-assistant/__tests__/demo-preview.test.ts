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
async function mountDemo(props?: Partial<{ ts: string, js: string, renderable: boolean, reason: string }>) {
  const { default: DemoPreview } = await import('../src/ui/components/DemoPreview.vue')
  return mount(DemoPreview, {
    props: {
      ts: 'TS_SOURCE',
      js: 'JS_SOURCE',
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
    // 操作栏四个按钮均在（有 js 时）
    expect(wrapper.find('[data-testid="view-ts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copy-ts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="view-js"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copy-js"]').exists()).toBe(true)
  })

  it('点击「查看 JS」展开源码并用 JS 源码重新编译预览', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    await wrapper.find('[data-testid="view-js"]').trigger('click')
    await flushPromises()
    // 第二次编译入参为 js 源码
    expect(compileSfc).toHaveBeenCalledTimes(2)
    expect(compileSfc.mock.calls[1][0]).toBe('JS_SOURCE')
    // 源码区展开并显示 JS 源码 + 语言标识
    expect(wrapper.find('[data-testid="code-block"]').text()).toContain('JS_SOURCE')
    expect(wrapper.find('[data-testid="code-lang"]').text()).toBe('JavaScript')
  })

  it('「复制 TS」「复制 JS」无需展开即可直接复制对应语言源码', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    // 源码区默认折叠，直接点复制 TS
    expect((wrapper.find('[data-testid="demo-code"]').element as HTMLElement).style.display).toBe('none')
    await wrapper.find('[data-testid="copy-ts"]').trigger('click')
    await flushPromises()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TS_SOURCE')
    expect(wrapper.find('[data-testid="copy-ts"]').text()).toContain('已复制')
    // 直接点复制 JS（仍未展开）
    await wrapper.find('[data-testid="copy-js"]').trigger('click')
    await flushPromises()
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('JS_SOURCE')
    expect(wrapper.find('[data-testid="copy-js"]').text()).toContain('已复制')
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
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
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
    expect(err.text()).toContain('Ctrl+C')
    expect(wrapper.find('[data-testid="copy-current"]').text()).toContain('已选中')
  })

  it('顶部复制失败时展开并选中源码，源码折叠状态也显式反馈', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Document is not focused')) },
      configurable: true,
    })
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    })
    const wrapper = await mountDemo()
    await flushPromises()
    const codeEl = wrapper.find('[data-testid="demo-code"]')
    expect((codeEl.element as HTMLElement).style.display).toBe('none')

    await wrapper.find('[data-testid="copy-ts"]').trigger('click')
    await flushPromises()

    expect((codeEl.element as HTMLElement).style.display).not.toBe('none')
    expect(wrapper.find('[data-testid="copy-ts"]').text()).toContain('已选中')
    expect(wrapper.find('[data-testid="copy-error"]').text()).toContain('Document is not focused')
    expect(wrapper.find('[data-testid="copy-error"]').text()).toContain('Ctrl+C')
  })

  it('clipboard API 不可用时使用 textarea fallback 复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    })
    const wrapper = await mountDemo()
    await flushPromises()
    await wrapper.find('[data-testid="copy-ts"]').trigger('click')
    await flushPromises()

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(wrapper.find('[data-testid="copy-ts"]').text()).toContain('已复制')
    expect(wrapper.find('[data-testid="copy-error"]').exists()).toBe(false)
  })

  it('源码区默认折叠，点击「查看 TS」展开、再点收起', async () => {
    const wrapper = await mountDemo()
    await flushPromises()
    // 预览区始终可见；源码区由 v-show 控制，默认折叠
    expect(wrapper.find('[data-testid="demo-live"]').exists()).toBe(true)
    const codeEl = wrapper.find('[data-testid="demo-code"]')
    expect(codeEl.exists()).toBe(true)
    expect((codeEl.element as HTMLElement).style.display).toBe('none')
    const viewTs = wrapper.find('[data-testid="view-ts"]')
    expect(viewTs.attributes('aria-expanded')).toBe('false')
    expect(viewTs.text()).toContain('查看 TS')
    // 点击展开
    await viewTs.trigger('click')
    expect((codeEl.element as HTMLElement).style.display).not.toBe('none')
    expect(viewTs.attributes('aria-expanded')).toBe('true')
    expect(viewTs.text()).toContain('收起 TS')
    // 再点同语言收起
    await viewTs.trigger('click')
    expect((codeEl.element as HTMLElement).style.display).toBe('none')
    expect(viewTs.attributes('aria-expanded')).toBe('false')
  })

  it('快速切换语言时仅最新一次编译结果生效（并发守卫）', async () => {
    // 第一次（TS）编译挂起，第二次（JS）先 resolve；最终应呈现 JS 的组件，且第一次结果被丢弃。
    let resolveFirst!: (v: unknown) => void
    compileSfc
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(okResult(() => h('div', { 'data-testid': 'js-comp' }, 'JS')))
    const wrapper = await mountDemo()
    // 立即点「查看 JS」，触发第二次（JS）编译
    await wrapper.find('[data-testid="view-js"]').trigger('click')
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
    // 无独立 JS 版本 → 不渲染 JS 按钮（不伪造降级），TS 按钮仍在
    expect(wrapper.find('[data-testid="view-js"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="copy-js"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-ts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copy-ts"]').exists()).toBe(true)
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
    await wrapper.find('[data-testid="view-ts"]').trigger('click')
    expect(wrapper.find('[data-testid="code-block"]').text()).toContain('TS_SOURCE')
  })
})
