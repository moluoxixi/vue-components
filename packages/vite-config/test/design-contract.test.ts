import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAppConfig, getBaseConfig, inspectViteFeatures } from '@moluoxixi/vite-config'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

function createTempDir(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

describe('vite-config design contract', () => {
  it('keeps base config free of behavior-changing production optimizations', async () => {
    const root = createTempDir('moluoxixi-base-contract-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: {} }))

    const config = await getBaseConfig({ viteConfig: { root } })

    expect(config.esbuild).toBeUndefined()
  })

  it('routes public addon option types through the source addons entry', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/types/index.ts'), 'utf-8')
    const optionalAddonImports = [
      '@intlify/unplugin-vue-i18n',
      '@vitejs/plugin-react',
      '@vitejs/plugin-vue',
      'unocss/vite',
      'unplugin-auto-import',
      'unplugin-vue-components',
      'unplugin-vue-markdown',
      'unplugin-vue-router',
      'vite-plugin-pages',
      'vite-plugin-vue-devtools',
      'vite-ssg',
      'vitest/node',
    ]

    for (const specifier of optionalAddonImports) {
      expect(source).not.toContain(`from '${specifier}`)
    }

    expect(source).toContain(`from '../addons'`)
    expect(source).not.toMatch(/@moluoxixi\/vite-config\/addons/)
  })

  it('keeps runtime addon modules on the source addons entry', () => {
    const addonsRoot = path.resolve(__dirname, '../src/config/base/addons/services')
    const files = fs.readdirSync(addonsRoot)
      .filter(file => file.endsWith('.ts'))
      .filter(file => !['config.ts', 'index.ts', 'plugin-factory.ts', 'registry.ts', 'runtime.ts'].includes(file))

    expect(files).toHaveLength(15)

    for (const file of files) {
      const source = fs.readFileSync(path.join(addonsRoot, file), 'utf-8')
      expect(source, file).toContain(`from '../../../../addons'`)
      expect(source, file).not.toMatch(/@moluoxixi\/vite-config/)
    }
  })

  it('uses concrete addon option types instead of Record-based config casts', () => {
    const addonsRoot = path.resolve(__dirname, '../src/config/base/addons/services')
    const files = fs.readdirSync(addonsRoot)
      .filter(file => file.endsWith('.ts'))
      .filter(file => !['config.ts', 'index.ts', 'plugin-factory.ts', 'registry.ts', 'runtime.ts'].includes(file))

    expect(files).toHaveLength(15)

    for (const file of files) {
      const source = fs.readFileSync(path.join(addonsRoot, file), 'utf-8')
      expect(source, file).not.toContain('options as Record<string, unknown>')
      expect(source, file).not.toContain('defineFeature<Record<string, unknown>>')
    }
  })

  it('keeps app config free of empty placeholder build overrides', async () => {
    const root = createTempDir('moluoxixi-app-contract-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: {} }))
    const exported = createAppConfig({ viteConfig: { base: '/docs/', root } })
    const config = await Promise.resolve(
      typeof exported === 'function'
        ? exported({ command: 'build', mode: 'production' })
        : exported,
    )

    expect(config.base).toBe('/docs/')
    expect(config.build?.rollupOptions?.output).toBeUndefined()
  })

  it('auto-enables build-time addons from devDependencies-only detection', () => {
    const root = createTempDir('moluoxixi-design-dev-only-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      devDependencies: {
        'vue': '^3.5.0',
        '@vitejs/plugin-vue': '^6.0.0',
      },
    }))

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const vue = inspection.features.find(feature => feature.name === 'vue')

    expect(vue).toMatchObject({
      enabled: true,
      matchedTriggers: ['vue', '@vitejs/plugin-vue'],
      missingRequires: [],
      reason: 'dependency-detected',
    })
  })

  it('treats sitemap as an optional vite-ssg enhancement rather than a hard runtime requirement', () => {
    const root = createTempDir('moluoxixi-design-ssg-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'vite-ssg': '^28.0.0' } }))

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const viteSsg = inspection.features.find(feature => feature.name === 'viteSsg')

    expect(viteSsg).toMatchObject({
      enabled: true,
      missingRequires: [],
      requires: ['vite-ssg'],
    })
  })

  it('treats sitemap in devDependencies as an installed build-time enhancement', () => {
    const root = createTempDir('moluoxixi-design-ssg-dev-sitemap-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      devDependencies: {
        'vite-ssg': '^28.0.0',
        'vite-ssg-sitemap': '^0.10.0',
      },
    }))

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const viteSsg = inspection.features.find(feature => feature.name === 'viteSsg')

    expect(viteSsg).toMatchObject({
      enabled: true,
      matchedTriggers: ['vite-ssg'],
      missingRequires: [],
      reason: 'dependency-detected',
      requires: ['vite-ssg'],
    })
  })

  it('detects the pages addon from declared build dependencies', () => {
    const root = createTempDir('moluoxixi-design-pages-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      devDependencies: {
        'vite-plugin-pages': '^0.33.3',
      },
    }))

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const pages = inspection.features.find(feature => feature.name === 'pages')

    expect(pages).toMatchObject({
      enabled: true,
      matchedTriggers: ['vite-plugin-pages'],
      missingRequires: [],
      reason: 'dependency-detected',
    })
  })
})
