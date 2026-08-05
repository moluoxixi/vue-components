// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted } from 'vue'
import Playground from './Playground.vue'

const { compileLocalSfc, consumePlaygroundSession } = vi.hoisted(() => ({
  compileLocalSfc: vi.fn(),
  consumePlaygroundSession: vi.fn(() => null),
}))

vi.mock('../sfc-compiler', () => ({ compileLocalSfc }))
vi.mock('../playground-session', () => ({
  consumePlaygroundSession,
  playgroundSessionQuery: 'session',
}))
vi.mock('../use-docs-locale', async () => {
  const { ref } = await import('vue')
  return {
    useDocsLocale: () => ({
      messages: ref({
        playground: {
          title: 'Playground',
          editor: 'Editor',
          preview: 'Preview',
          run: 'Run',
          running: 'Running',
          reset: 'Reset',
          copy: 'Copy',
          copied: 'Copied',
          editorAria: 'SFC source',
          diagnostics: 'Runtime error',
        },
      }),
    }),
  }
})

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

describe('playground', () => {
  beforeEach(() => {
    compileLocalSfc.mockReset()
    consumePlaygroundSession.mockReset()
    consumePlaygroundSession.mockReturnValue(null)
    window.history.replaceState(null, '', '/playground')
  })

  it('keeps the newest run and disposes a stale successful result', async () => {
    const first = deferred<{ component: ReturnType<typeof previewComponent>, dispose: () => void }>()
    const second = deferred<{ component: ReturnType<typeof previewComponent>, dispose: () => void }>()
    const disposeFirst = vi.fn()
    const disposeSecond = vi.fn()
    compileLocalSfc
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mount(Playground)
    await flushPromises()
    expect(compileLocalSfc).toHaveBeenCalledOnce()
    await wrapper.get('[data-testid="playground-reset"]').trigger('click')
    await flushPromises()
    expect(compileLocalSfc).toHaveBeenCalledTimes(2)

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
    compileLocalSfc.mockReturnValueOnce(pending.promise)

    const wrapper = mount(Playground)
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
    compileLocalSfc.mockResolvedValue({ component: runtimeFailure, dispose: vi.fn() })

    const wrapper = mount(Playground)
    await flushPromises()

    expect(wrapper.get('[data-testid="playground-diagnostics"]').text()).toContain('runtime boom')
    wrapper.unmount()
  })

  it('falls back to the starter when session storage is unavailable', async () => {
    consumePlaygroundSession.mockImplementationOnce(() => {
      throw new Error('storage denied')
    })
    compileLocalSfc.mockResolvedValue({ component: previewComponent('starter preview'), dispose: vi.fn() })

    const wrapper = mount(Playground)
    await flushPromises()

    expect(wrapper.get('[data-testid="playground-editor"]').element).toHaveProperty('value', expect.stringContaining('Hello, MX Components!'))
    wrapper.unmount()
  })

  it('copies the current editor source and exposes success state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    compileLocalSfc.mockResolvedValue({ component: previewComponent('preview'), dispose: vi.fn() })
    const wrapper = mount(Playground)
    await flushPromises()
    const editor = wrapper.get('[data-testid="playground-editor"]')
    await editor.setValue('<template><p>copied source</p></template>')

    await wrapper.get('[data-testid="playground-copy"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('<template><p>copied source</p></template>')
    expect(wrapper.get('[data-testid="playground-copy"]').text()).toContain('Copied')
    wrapper.unmount()
  })
})
