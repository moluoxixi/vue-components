// @vitest-environment happy-dom

import { strFromU8, unzipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createStructuredSourceArchive,
  downloadProjectTransfer,
  downloadSourceFile,
  downloadStructuredSourceArchive,
  downloadSurfaceTransfer,
  sourceFileBlob,
  sourceSurfaceDirectory,
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
  it('downloads a project source archive with views, components, and assets', async () => {
    const download = stubBlobDownload()
    await expect(downloadStructuredSourceArchive({
      name: 'Customer Portal',
      projectId: 'customer-portal',
      files: [
        { kind: 'text', path: 'src/surfaces/home/Surface.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/surfaces/settings/config.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/components/Brand.vue', language: 'vue', content: '<template />' },
        { kind: 'binary', path: 'src/assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
        { kind: 'binary', path: 'public/favicon.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
      ],
    })).resolves.toBe('customer-portal.zip')
    const archive = unzipSync(new Uint8Array(await download.blobs[0]!.arrayBuffer()))
    expect(Object.keys(archive).sort()).toEqual([
      'customer-portal/assets/favicon.png',
      'customer-portal/assets/logo.png',
      'customer-portal/components/Brand.vue',
      'customer-portal/export-manifest.json',
      'customer-portal/views/home/Surface.vue',
      'customer-portal/views/settings/config.ts',
    ])
    expect(JSON.parse(strFromU8(archive['customer-portal/export-manifest.json']!))).toMatchObject({
      scope: 'project',
      project: { id: 'customer-portal', name: 'Customer Portal' },
      directories: { views: 'views', components: 'components', assets: 'assets', shared: 'shared' },
    })
  })

  it('rewrites generated relative imports for the projected directory layout', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Customer Portal',
      files: [
        { kind: 'text', path: 'index.html', language: 'text', content: '<script src="/src/main.ts"></script><link href="./favicon.png">' },
        { kind: 'text', path: 'src/main.ts', language: 'typescript', content: 'import App from \'./App.vue\'' },
        { kind: 'text', path: 'src/App.vue', language: 'vue', content: 'import \'./surfaces/home/Surface.vue\'' },
        { kind: 'text', path: 'src/router.ts', language: 'typescript', content: 'import Surface from \'./surfaces/home/Surface.vue\'' },
        { kind: 'text', path: 'src/data/resources.ts', language: 'typescript', content: 'new URL(\'../assets/logo.png\', import.meta.url)' },
        { kind: 'text', path: 'src/surfaces/home/Surface.vue', language: 'vue', content: 'import { resources } from \'../../data/resources.ts\'\nimport values from \'../../demo-values.ts\'' },
        { kind: 'binary', path: 'src/assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
        { kind: 'binary', path: 'public/favicon.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
      ],
    }))

    expect(strFromU8(archive['customer-portal/index.html']!)).toContain('/shared/main.ts')
    expect(strFromU8(archive['customer-portal/index.html']!)).toContain('./assets/favicon.png')
    expect(strFromU8(archive['customer-portal/shared/App.vue']!)).toContain('../views/home/Surface.vue')
    expect(strFromU8(archive['customer-portal/shared/router.ts']!)).toContain('../views/home/Surface.vue')
    expect(strFromU8(archive['customer-portal/shared/data/resources.ts']!)).toContain('../../assets/logo.png')
    expect(strFromU8(archive['customer-portal/views/home/Surface.vue']!)).toContain('../../shared/data/resources.ts')
    expect(strFromU8(archive['customer-portal/views/home/Surface.vue']!)).toContain('../../shared/demo-values.ts')
  })

  it('keeps a page source archive self-contained while excluding sibling views', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Customer Portal-Profile Entry',
      projectId: 'customer-portal',
      scope: 'surface',
      surfaceId: 'profile',
      surfaceName: 'Profile Entry',
      surfaceDirectory: 'profile',
      files: [
        { kind: 'text', path: 'src/surfaces/profile/Surface.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/surfaces/settings/Surface.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/components/Brand.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/main.ts', language: 'typescript', content: 'export {}' },
      ],
    }))
    expect(Object.keys(archive).sort()).toEqual([
      'customer-portal-profile-entry/components/Brand.vue',
      'customer-portal-profile-entry/export-manifest.json',
      'customer-portal-profile-entry/shared/main.ts',
      'customer-portal-profile-entry/views/profile/Surface.vue',
    ])
    expect(Object.keys(archive).some(path => path.includes('/views/settings/'))).toBe(false)
  })

  it('resolves generated directories for non-ascii surface ids', () => {
    expect(sourceSurfaceDirectory([
      { path: 'src/surfaces/surface/Surface.vue' },
      { path: 'src/surfaces/surface-2/Surface.vue' },
    ], '设置', ['表单', '设置'])).toBe('surface-2')
  })

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
