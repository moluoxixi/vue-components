// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadSourceFile, sourceFileBlob } from '../export'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('export downloads', () => {
  it('creates exact text and binary blobs from Source files', async () => {
    const text = sourceFileBlob({
      kind: 'text',
      path: 'src/main.ts',
      language: 'typescript',
      content: 'const value = 1\n',
    })
    const binary = sourceFileBlob({
      kind: 'binary',
      path: 'assets/payload.bin',
      mediaType: 'application/octet-stream',
      encoding: 'base64',
      contentBase64: 'AAF//w==',
    })

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

    expect(downloadSourceFile({
      file: {
        kind: 'binary',
        path: 'assets/payload.bin',
        mediaType: 'application/octet-stream',
        encoding: 'base64',
        contentBase64: 'AP8=',
      },
      filename: 'payload.bin',
    })).toBe('payload.bin')

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config-form-export')
  })
})
