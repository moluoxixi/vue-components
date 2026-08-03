import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { ClipboardCopyError, CopyText, copyText, HeadlessCopyText } from '../../index'

const writeText = vi.fn<(text: string) => Promise<void>>()
const execCommand = vi.fn<(command: string) => boolean>()

function setClipboard(value: { writeText: typeof writeText } | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  })
}

describe('copy text', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockReset()
    writeText.mockResolvedValue()
    execCommand.mockReset()
    execCommand.mockReturnValue(false)
    setClipboard({ writeText })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('复制文本并向用户呈现可访问的成功状态', async () => {
    const wrapper = mount(CopyText, {
      props: {
        text: 'INV-2026-001',
      },
    })

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('复制')

    await button.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('INV-2026-001')
    expect(wrapper.emitted('copy')).toEqual([['INV-2026-001']])
    expect(button.attributes('aria-label')).toBe('已复制')
    expect(wrapper.get('[role="status"]').text()).toBe('已复制')

    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(button.attributes('aria-label')).toBe('复制')
  })

  it('headless 组件通过作用域插槽暴露状态、命令和错误', async () => {
    writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mount(HeadlessCopyText, {
      props: {
        resetDelay: 0,
        text: 'headless value',
      },
      slots: {
        default: ({ copied, copying, error, copy, reset }) => h('div', [
          h('button', {
            'data-testid': 'copy',
            'onClick': () => copy().catch(() => undefined),
          }, 'copy'),
          h('button', {
            'data-testid': 'reset',
            'onClick': reset,
          }, 'reset'),
          h('span', { 'data-testid': 'state' }, `${copying}:${copied}:${error?.message ?? ''}`),
        ]),
      },
    })

    await wrapper.get('[data-testid="copy"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.get('[data-testid="state"]').text()).toContain('permission denied')

    await wrapper.get('[data-testid="reset"]').trigger('click')
    expect(wrapper.get('[data-testid="state"]').text()).toBe('false:false:')
  })

  it('clipboard API 不可用时退回 textarea copy 并恢复原焦点', async () => {
    setClipboard(undefined)
    execCommand.mockReturnValue(true)
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()

    await copyText('fallback value')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.activeElement).toBe(input)
    expect(document.querySelector('textarea[aria-hidden="true"]')).toBeNull()
    input.remove()
  })

  it('clipboard API 被拒绝时使用 fallback，并公开可判别的最终错误', async () => {
    const primaryError = new Error('clipboard denied')
    writeText.mockRejectedValue(primaryError)
    execCommand.mockReturnValue(true)

    await copyText('fallback after rejection')
    expect(execCommand).toHaveBeenCalledWith('copy')

    const fallbackError = new Error('legacy copy failed')
    execCommand.mockImplementation(() => {
      throw fallbackError
    })

    const failure = await copyText('unavailable').catch(error => error)
    expect(failure).toBeInstanceOf(ClipboardCopyError)
    expect(failure).toMatchObject({
      fallbackError,
      name: 'ClipboardCopyError',
      primaryError,
    })
  })

  it('禁用时不执行复制', async () => {
    const wrapper = mount(CopyText, {
      props: {
        disabled: true,
        text: 'disabled value',
      },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('button').trigger('click')
    expect(writeText).not.toHaveBeenCalled()
  })
})
