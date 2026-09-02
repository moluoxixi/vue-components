// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadWorkspaceFile, workspaceFileBlob } from '../export'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('export downloads', () => {
  it('creates exact text and binary blobs without sharing binary storage', async () => {
    const text = workspaceFileBlob({ content: 'const value = 1\n', kind: 'text' })
    const source = new Uint8Array([0, 1, 127, 255])
    const binary = workspaceFileBlob({ content: source, kind: 'binary' })
    source.fill(9)

    expect(text.type).toBe('text/plain;charset=utf-8')
    expect(await text.text()).toBe('const value = 1\n')
    expect(binary.type).toBe('application/octet-stream')
    expect([...new Uint8Array(await binary.arrayBuffer())]).toEqual([0, 1, 127, 255])
  })

  it('clicks the requested filename before asynchronously revoking the URL', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:config-form-export')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('payload.bin')
      expect(this.href).toContain('blob:config-form-export')
    })

    expect(downloadWorkspaceFile({
      file: { content: new Uint8Array([0, 255]), kind: 'binary' },
      filename: 'payload.bin',
    })).toBe('payload.bin')

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config-form-export')
  })
})
