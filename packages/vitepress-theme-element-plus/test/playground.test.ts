// @vitest-environment happy-dom
import type { ElementPlusDocsSfcCompiler } from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted } from 'vue'
import { ElementPlusDocsPlayground } from '../index'

const starterSource = '<template><p>Hello, fixture!</p></template>'
const messages = {
  copied: 'Copied',
  copy: 'Copy',
  diagnostics: 'Runtime error',
  editor: 'Editor',
  editorAria: 'SFC source',
  preview: 'Preview',
  reset: 'Reset',
  run: 'Run',
  running: 'Running',
  title: 'Playground',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function previewComponent(text: string) {
  return defineComponent(() => () => h('p', text))
}

function mountPlayground(compile: ElementPlusDocsSfcCompiler) {
  return mount(ElementPlusDocsPlayground, {
    props: { compile, messages, starterSource },
  })
}

describe('elementPlusDocsPlayground', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/playground')
    window.sessionStorage.clear()
  })

  it('keeps the newest run and disposes a stale successful result', async () => {
    const first = deferred<{ component: ReturnType<typeof previewComponent>, dispose: () => void }>()
    const second = deferred<{ component: ReturnType<typeof previewComponent>, dispose: () => void }>()
    const disposeFirst = vi.fn()
    const disposeSecond = vi.fn()
    const compile = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mountPlayground(compile)
    await flushPromises()
    expect(compile).toHaveBeenCalledOnce()
    await wrapper.get('[data-testid="playground-reset"]').trigger('click')
    await flushPromises()
    expect(compile).toHaveBeenCalledTimes(2)

    second.resolve({ component: previewComponent('new preview'), dispose: disposeSecond })
    await flushPromises()
    expect(wrapper.get('[data-testid="playground-preview"]').text()).toContain('new preview')

    first.resolve({ component: previewComponent('stale preview'), dispose: disposeFirst })
    await flushPromises()
    expect(disposeFirst).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="playground-preview"]').text()).not.toContain('stale preview')

    wrapper.unmount()
    expect(disposeSecond).toHaveBeenCalledOnce()
  })

  it('disposes a compile that resolves after unmount', async () => {
    const pending = deferred<{ component: ReturnType<typeof previewComponent>, dispose: () => void }>()
    const dispose = vi.fn()
    const compile = vi.fn().mockReturnValueOnce(pending.promise)

    const wrapper = mountPlayground(compile)
    await nextTick()
    wrapper.unmount()
    pending.resolve({ component: previewComponent('late preview'), dispose })
    await flushPromises()

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('renders descendant runtime failures as diagnostics', async () => {
    const runtimeFailure = defineComponent(() => {
      onMounted(() => {
        throw new Error('runtime boom')
      })
      return () => h('p', 'failing preview')
    })
    const compile = vi.fn().mockResolvedValue({ component: runtimeFailure, dispose: vi.fn() })

    const wrapper = mountPlayground(compile)
    await flushPromises()

    expect(wrapper.get('[data-testid="playground-diagnostics"]').text()).toContain('runtime boom')
    wrapper.unmount()
  })

  it('copies the current editor source and exposes success state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const compile = vi.fn().mockResolvedValue({ component: previewComponent('preview'), dispose: vi.fn() })
    const wrapper = mountPlayground(compile)
    await flushPromises()
    await wrapper.get('[data-testid="playground-editor"]').setValue('<template><p>copied source</p></template>')

    await wrapper.get('[data-testid="playground-copy"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('<template><p>copied source</p></template>')
    expect(wrapper.get('[data-testid="playground-copy"]').text()).toContain('Copied')
    wrapper.unmount()
  })
})
