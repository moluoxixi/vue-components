// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadProjectTransfer,
  downloadSourceFile,
  downloadSurfaceTransfer,
  sourceFileBlob,
} from '../export'
import { createProjectDocumentFixture } from './fixtures'

const EMPTY_CONTENT_HASH = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function stubBlobDownload(): { blobs: Blob[], click: ReturnType<typeof vi.fn>, revokeObjectURL: ReturnType<typeof vi.fn> } {
  vi.useFakeTimers()
  const blobs: Blob[] = []
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return `blob:config-form-export-${blobs.length}`
  })
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const click = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
  return { blobs, click, revokeObjectURL }
}

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

  it('downloads a strict Project transfer with embedded bytes as pretty JSON', async () => {
    const download = stubBlobDownload()
    const document = createProjectDocumentFixture({
      id: 'customer-portal',
      name: 'Customer Portal',
      resources: {
        logo: {
          id: 'logo',
          name: 'Brand logo',
          kind: 'embedded',
          fileName: 'logo.png',
          mediaType: 'image/png',
          byteLength: 0,
          contentHash: EMPTY_CONTENT_HASH,
        },
      },
    })
    const readEmbedded = vi.fn(async () => new Uint8Array())

    await expect(downloadProjectTransfer({ document, readEmbedded }))
      .resolves
      .toBe('customer-portal.project.json')
    expect(readEmbedded).toHaveBeenCalledExactlyOnceWith({
      projectId: 'customer-portal',
      resourceId: 'logo',
      contentHash: EMPTY_CONTENT_HASH,
    })
    expect(download.click).toHaveBeenCalledOnce()
    expect(download.blobs).toHaveLength(1)

    const blob = download.blobs[0]!
    const source = await blob.text()
    expect(blob.type).toBe('application/json;charset=utf-8')
    expect(source).toBe(`${JSON.stringify(JSON.parse(source), null, 2)}\n`)
    expect(JSON.parse(source)).toEqual({
      kind: 'config-form-project',
      version: 1,
      document,
      embeddedContents: [{
        resourceId: 'logo',
        content: { encoding: 'base64', data: '' },
      }],
    })
    vi.runAllTimers()
    expect(download.revokeObjectURL).toHaveBeenCalledWith('blob:config-form-export-1')
  })

  it('downloads the current Surface transfer with its suggested filename', async () => {
    const download = stubBlobDownload()
    const document = createProjectDocumentFixture({
      id: 'customer-portal',
      name: 'Customer Portal',
    })
    const surface = document.surfacesById[document.homeSurfaceId]!
    surface.name = 'Profile Entry'
    const readEmbedded = vi.fn(async () => undefined)

    await expect(downloadSurfaceTransfer({
      document,
      surfaceId: surface.id,
      readEmbedded,
    })).resolves.toBe('customer-portal-profile-entry.surface.json')
    expect(readEmbedded).not.toHaveBeenCalled()
    expect(download.click).toHaveBeenCalledOnce()

    const blob = download.blobs[0]!
    const source = await blob.text()
    expect(blob.type).toBe('application/json;charset=utf-8')
    expect(source).toBe(`${JSON.stringify(JSON.parse(source), null, 2)}\n`)
    expect(JSON.parse(source)).toEqual({
      kind: 'config-form-surface',
      version: 1,
      rootSurfaceId: surface.id,
      surfaceOrder: [surface.id],
      surfacesById: { [surface.id]: surface },
      datasetOrder: [],
      datasetsById: {},
      resources: {},
      embeddedContents: [],
      registryLock: document.registryLock,
    })
    vi.runAllTimers()
  })

  it('does not start a download when Project transfer creation fails', async () => {
    const download = stubBlobDownload()
    const document = createProjectDocumentFixture({
      resources: {
        logo: {
          id: 'logo',
          name: 'Brand logo',
          kind: 'embedded',
          fileName: 'logo.png',
          mediaType: 'image/png',
          byteLength: 0,
          contentHash: EMPTY_CONTENT_HASH,
        },
      },
    })

    await expect(downloadProjectTransfer({
      document,
      readEmbedded: async () => undefined,
    })).rejects.toThrow('Resource reader returned no bytes.')
    expect(download.blobs).toEqual([])
    expect(download.click).not.toHaveBeenCalled()
  })
})
