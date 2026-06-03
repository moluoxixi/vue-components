// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installExternalContextSync } from '../src/client/interactions'

describe('external context sync', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces external attribute mutations while a context render is pending', async () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)

    const root = document.createElement('div')
    const externalPanel = document.createElement('section')
    document.body.append(root, externalPanel)
    const containsSpy = vi.spyOn(root, 'contains')

    /**
     * 直接安装上下文同步器，避免完整 overlay 测试中历史全局 observer 对 RAF 计数造成干扰。
     */
    installExternalContextSync(root, vi.fn(), vi.fn())

    externalPanel.classList.add('first-change')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
    const containsCallsAfterFirstMutation = containsSpy.mock.calls.length

    externalPanel.classList.add('second-change')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
    expect(containsSpy).toHaveBeenCalledTimes(containsCallsAfterFirstMutation)

    frameCallbacks[0]!(0)
    externalPanel.classList.add('third-change')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2)
  })
})
