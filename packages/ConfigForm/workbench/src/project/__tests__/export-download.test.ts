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
} from '../export'
import { sourceSurfaceDirectory } from '../export/services/structured-projection'
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
      'customer-portal/public/favicon.png',
      'customer-portal/src/assets/logo.png',
      'customer-portal/src/components/Brand.vue',
      'customer-portal/src/views/home/index.vue',
      'customer-portal/src/views/settings/utils/config.ts',
    ])
    expect(Object.keys(archive).some(path => path.endsWith('export-manifest.json'))).toBe(false)
  })

  it('exports standard src directories with aliases in Vite, TypeScript, and module imports', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Customer Portal',
      files: [
        { kind: 'text', path: 'index.html', language: 'text', content: '<script src="/src/main.ts"></script><link href="./favicon.png">' },
        { kind: 'text', path: 'src/main.ts', language: 'typescript', content: 'import App from \'./App.vue\'\nimport router from \'./router\'\nimport \'./styles.css\'' },
        { kind: 'text', path: 'src/App.vue', language: 'vue', content: '<script setup lang="ts">\nimport \'./surfaces/home/Surface.vue\'\nimport \'./demo-navigation\'\n</script>\n<template />' },
        { kind: 'text', path: 'src/router.ts', language: 'typescript', content: 'import Surface from \'./surfaces/home/Surface.vue\'' },
        { kind: 'text', path: 'src/bindings.ts', language: 'typescript', content: 'export { createFields } from \'./surfaces/home/config.ts\'' },
        { kind: 'text', path: 'tsconfig.json', language: 'json', content: '{"compilerOptions":{"strict":true,"paths":{"#custom/*":["src/custom/*"]}},"include":["src/**/*.ts","src/**/*.vue"]}' },
        { kind: 'text', path: 'vite.config.ts', language: 'typescript', content: 'import Vue from \'@vitejs/plugin-vue\'\nimport Tailwind from \'@tailwindcss/vite\'\nimport { defineConfig } from \'vite\'\nexport default defineConfig({ plugins: [Vue(), Tailwind()], build: { lib: { entry: \'src/bindings.ts\', formats: [\'es\'] } } })' },
        { kind: 'text', path: 'src/data/resources.ts', language: 'typescript', content: 'new URL(\'../assets/logo.png\', import.meta.url)' },
        { kind: 'text', path: 'src/data/datasets.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/surfaces/home/Surface.vue', language: 'vue', content: '<script setup lang="ts">\nimport { resources } from \'../../data/resources.ts\'\nimport values from \'../../demo-values.ts\'\nimport { demoFieldValidators } from \'./validation.ts\'\nimport Item from \'../../components/ConfigFormItem.vue\'\n</script>\n<template />' },
        { kind: 'text', path: 'src/components/ConfigFormItem.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/surfaces/home/validation.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/surfaces/home/config.ts', language: 'typescript', content: 'import type { ConfigBindingActions } from \'../../host.ts\'\nimport { demoValues } from \'../../demo-values.ts\'\nimport { datasetViews } from \'../../data/datasets.ts\'' },
        { kind: 'text', path: 'src/demo-navigation.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/demo-values.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/host.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/styles.css', language: 'css', content: '@import \'tailwindcss\';\n@import \'./theme.css\';' },
        { kind: 'binary', path: 'src/assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
        { kind: 'binary', path: 'public/favicon.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
      ],
    }))

    expect(strFromU8(archive['customer-portal/index.html']!)).toContain('/src/main.ts')
    expect(strFromU8(archive['customer-portal/index.html']!)).toContain('./favicon.png')
    expect(strFromU8(archive['customer-portal/src/main.ts']!)).toContain('from \'@/App.vue\'')
    expect(strFromU8(archive['customer-portal/src/main.ts']!)).toContain('from \'@/router\'')
    expect(strFromU8(archive['customer-portal/src/main.ts']!)).toContain('import \'@/styles.css\'')
    expect(strFromU8(archive['customer-portal/src/App.vue']!)).toContain('@/views/home/index.vue')
    expect(strFromU8(archive['customer-portal/src/App.vue']!)).toContain('@/composables/demo-navigation')
    expect(strFromU8(archive['customer-portal/src/router/index.ts']!)).toContain('@/views/home/index.vue')
    expect(strFromU8(archive['customer-portal/src/bindings.ts']!)).toContain('@/views/home/utils/config')
    expect(JSON.parse(strFromU8(archive['customer-portal/tsconfig.json']!))).toEqual({
      compilerOptions: { strict: true, baseUrl: '.', paths: { '#custom/*': ['src/custom/*'], '@/*': ['src/*'] } },
      include: ['src/**/*.ts', 'src/**/*.vue'],
    })
    const viteConfig = strFromU8(archive['customer-portal/vite.config.ts']!)
    expect(viteConfig).toContain('import { fileURLToPath } from \'node:url\'')
    expect(viteConfig).toContain('\'@\': fileURLToPath(new URL(\'./src\', import.meta.url))')
    expect(viteConfig).toContain('entry: \'src/bindings.ts\'')
    expect(viteConfig).toContain('plugins: [Vue(), Tailwind()]')
    expect(strFromU8(archive['customer-portal/src/constants/assets.ts']!)).toContain('../assets/logo.png')
    const page = strFromU8(archive['customer-portal/src/views/home/index.vue']!)
    expect(page).toContain('@/constants/assets')
    expect(page).toContain('@/utils/demo-values')
    expect(page).toContain('@/views/home/utils/validation')
    expect(page).toContain('@/components/ConfigFormItem.vue')
    const config = strFromU8(archive['customer-portal/src/views/home/utils/config.ts']!)
    expect(config).toContain('@/host')
    expect(config).toContain('@/utils/demo-values')
    expect(config).toContain('@/constants/options')
    expect(strFromU8(archive['customer-portal/src/composables/demo-navigation.ts']!)).toBe('export {}')
    expect(strFromU8(archive['customer-portal/src/styles.css']!)).toContain('@import \'./theme.css\'')
    expect(Object.keys(archive).some(path => path.includes('/shared/') || path.includes('/surfaces/'))).toBe(false)
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
        { kind: 'text', path: 'src/surfaces/profile/validation.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/surfaces/settings/Surface.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/components/Brand.vue', language: 'vue', content: '<template />' },
        { kind: 'text', path: 'src/main.ts', language: 'typescript', content: 'export {}' },
      ],
    }))
    expect(Object.keys(archive).sort()).toEqual([
      'customer-portal-profile-entry/src/components/Brand.vue',
      'customer-portal-profile-entry/src/main.ts',
      'customer-portal-profile-entry/src/views/profile/index.vue',
      'customer-portal-profile-entry/src/views/profile/utils/validation.ts',
    ])
    expect(Object.keys(archive).some(path => path.includes('/views/settings/'))).toBe(false)
  })

  it('resolves generated directories for non-ascii surface ids', () => {
    expect(sourceSurfaceDirectory([
      { path: 'src/surfaces/surface/Surface.vue' },
      { path: 'src/surfaces/surface-2/Surface.vue' },
    ], '设置', ['表单', '设置'])).toBe('surface-2')
  })

  it('rewrites static, dynamic, and type imports without changing ordinary strings or templates', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Imports',
      files: [
        { kind: 'text', path: 'src/main.ts', language: 'typescript', content: `export * from './data/resources.ts'
export type Resource = import('./data/resources').Resource
const page = () => import('./surfaces/home/Surface.vue')
// import './surfaces/home/Surface.vue'
const description = './surfaces/home/Surface.vue'
` },
        { kind: 'text', path: 'src/surfaces/home/Surface.vue', language: 'vue', content: `<script lang="ts">
import { resources } from '../../data/resources'
export default { data: () => ({ resources }) }
</script>
<script setup lang="ts">
import content from '../../assets/description.txt?raw'
const example = '../../data/resources.ts'
</script>
<template><span>./surfaces/home/Surface.vue</span></template>
<style>.example::after { content: '../../data/resources.ts'; }</style>
` },
        { kind: 'text', path: 'src/data/resources.ts', language: 'typescript', content: 'export {}' },
        { kind: 'text', path: 'src/assets/description.txt', language: 'text', content: 'Description' },
      ],
    }))
    const main = strFromU8(archive['imports/src/main.ts']!)
    expect(main).toContain('export * from \'@/constants/assets\'')
    expect(main).toContain('import(\'@/constants/assets\').Resource')
    expect(main).toContain('import(\'@/views/home/index.vue\')')
    expect(main).toContain('// import \'./surfaces/home/Surface.vue\'')
    expect(main).toContain('const description = \'./surfaces/home/Surface.vue\'')
    const page = strFromU8(archive['imports/src/views/home/index.vue']!)
    expect(page).toContain('from \'@/constants/assets\'')
    expect(page).toContain('from \'@/assets/description.txt?raw\'')
    expect(page).toContain('const example = \'../../data/resources.ts\'')
    expect(page).toContain('<span>./surfaces/home/Surface.vue</span>')
    expect(page).toContain('content: \'../../data/resources.ts\'')
  })

  it('keeps module-relative asset URLs valid when their owner moves into page utils', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Assets',
      files: [
        { kind: 'text', path: 'src/surfaces/home/config.ts', language: 'typescript', content: 'export const logo = new URL(\'../../assets/logo.png\', import.meta.url).href\nexport const description = \'../../assets/logo.png\'' },
        { kind: 'binary', path: 'src/assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'iVBORw0KGgo=' },
      ],
    }))
    const config = strFromU8(archive['assets/src/views/home/utils/config.ts']!)
    expect(config).toContain('new URL(\'../../../assets/logo.png\', import.meta.url)')
    expect(config).toContain('description = \'../../assets/logo.png\'')
  })

  it('updates an existing Vite source alias while preserving other configuration', async () => {
    const archive = unzipSync(await createStructuredSourceArchive({
      name: 'Aliases',
      files: [{ kind: 'text', path: 'vite.config.ts', language: 'typescript', content: `import { fileURLToPath as toPath } from 'node:url'
import { defineConfig } from 'vite'
export default defineConfig({
  resolve: { alias: { '@': '/previous', '#custom': '/custom' }, dedupe: ['vue'] },
  plugins: [],
  build: { lib: { entry: 'src/bindings.ts', formats: ['es'] } },
})
` }],
    }))
    const config = strFromU8(archive['aliases/vite.config.ts']!)
    expect(config).toContain('\'@\': toPath(new URL(\'./src\', import.meta.url))')
    expect(config).toContain('\'#custom\': \'/custom\'')
    expect(config).toContain('dedupe: [\'vue\']')
    expect(config).toContain('entry: \'src/bindings.ts\'')
    expect(config.match(/from 'node:url'/gu)).toHaveLength(1)
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
