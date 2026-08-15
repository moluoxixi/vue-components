import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { inspectViteFeatures } from '@moluoxixi/vite-config'
import {
  createAddonContext,
  defineFeature,
  getPackageName,
  isObjectOption,
  resolveFeatureConfig,
  resolveFeatureOrder,
} from '@moluoxixi/vite-config/config/base/addons/runtime'
import { callDefaultFactory, mergeAddonOptions } from '@moluoxixi/vite-config/config/base/addons/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockDeps: Record<string, string> = {}
let mockRuntimeDeps: Record<string, string> = {}

vi.mock('@moluoxixi/utils/node', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    detectDependencies: () => ({
      dependencies: {},
      devDependencies: mockDeps,
      deps: {
        ...mockRuntimeDeps,
        ...mockDeps,
      },
      optionalDependencies: {},
      peerDependencies: {},
      addonDeps: {
        ...mockRuntimeDeps,
        ...mockDeps,
      },
      runtimeDeps: mockRuntimeDeps,
    }),
  }
})

beforeEach(() => {
  mockDeps = {}
  mockRuntimeDeps = {}
})

describe('addon runtime helpers', () => {
  it('extracts package names from bare and scoped specifiers', () => {
    expect(getPackageName('vite-plugin-pwa')).toBe('vite-plugin-pwa')
    expect(getPackageName('unplugin-vue-router/vite')).toBe('unplugin-vue-router')
    expect(getPackageName('@vitejs/plugin-vue')).toBe('@vitejs/plugin-vue')
    expect(getPackageName('@scope/pkg/subpath')).toBe('@scope/pkg')
  })

  it('treats object-shaped addon options as configurable payloads', () => {
    expect(isObjectOption({ dts: true })).toBe(true)
    expect(isObjectOption([])).toBe(false)
    expect(isObjectOption(true)).toBe(false)
    expect(isObjectOption('uno.config.ts')).toBe(false)
    expect(isObjectOption(null)).toBe(false)
  })

  it('wraps failed dynamic imports with addon context', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-missing-import')
    mockRuntimeDeps = { 'missing-runtime-package': '^1.0.0' }
    const ctx = createAddonContext({ viteConfig: { root } })

    await expect(ctx.importRequired('missingOwner', 'missing-runtime-package')).rejects.toThrow(
      /\[ViteConfig\] missingOwner failed to load missing-runtime-package/,
    )
  })

  it('loads addon modules from the consumer workspace instead of the vite-config installation', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-runtime-workspace-'))
    const root = path.resolve(workspaceRoot, 'packages/app')
    const packageName = 'moluoxixi-root-only-addon'
    const moduleRoot = path.resolve(workspaceRoot, 'node_modules', packageName)
    fs.mkdirSync(root, { recursive: true })
    fs.mkdirSync(moduleRoot, { recursive: true })
    fs.writeFileSync(path.resolve(root, 'package.json'), JSON.stringify({ name: 'consumer-app', private: true }))
    fs.writeFileSync(path.resolve(moduleRoot, 'package.json'), JSON.stringify({
      exports: {
        '.': {
          import: './index.js',
          require: './index.cjs',
        },
        './subpath': {
          import: './subpath.js',
          require: './subpath.cjs',
        },
      },
      name: packageName,
      type: 'module',
    }))
    fs.writeFileSync(path.resolve(moduleRoot, 'index.js'), 'export const source = "consumer-workspace"\n')
    fs.writeFileSync(path.resolve(moduleRoot, 'index.cjs'), 'module.exports = { source: "require-workspace" }\n')
    fs.writeFileSync(path.resolve(moduleRoot, 'subpath.js'), 'export const source = "consumer-subpath"\n')
    fs.writeFileSync(path.resolve(moduleRoot, 'subpath.cjs'), 'module.exports = { source: "require-subpath" }\n')
    mockRuntimeDeps = { [packageName]: '^1.0.0' }

    try {
      const ctx = createAddonContext({ viteConfig: { root } })
      const imported = await ctx.importRequired<{ source: string }>('rootOnlyAddon', packageName)
      const importedSubpath = await ctx.importRequired<{ source: string }>('rootOnlyAddon', `${packageName}/subpath`)

      expect(imported.source).toBe('consumer-workspace')
      expect(importedSubpath.source).toBe('consumer-subpath')
    }
    finally {
      fs.rmSync(workspaceRoot, { force: true, recursive: true })
    }
  })

  it('dedupes addon arrays while preserving nested defaults and user functions', () => {
    const sharedItem = { name: 'shared' }
    const transform = () => 'user'
    const merged = mergeAddonOptions<{
      include: string[]
      items: Array<{ name: string }>
      nested: { formats: string[], retained?: boolean }
      transform: () => string
    }>({
      include: ['user.ts', 'shared.ts', 'user.ts'],
      items: [sharedItem, sharedItem],
      nested: { formats: ['cjs', 'shared'] },
      transform,
    }, {
      include: ['shared.ts', 'default.ts'],
      items: [sharedItem, { name: 'default' }],
      nested: { formats: ['shared', 'esm'], retained: true },
      transform: () => 'default',
    })

    expect(merged.include).toEqual(['user.ts', 'shared.ts', 'default.ts'])
    expect(merged.items).toHaveLength(2)
    expect(merged.items[0]).toBe(sharedItem)
    expect(merged.nested).toEqual({ formats: ['cjs', 'shared', 'esm'], retained: true })
    expect(merged.transform).toBe(transform)
  })

  it('wraps unexpected feature setup failures', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-feature-error')
    const ctx = createAddonContext({ viteConfig: { root } })
    const feature = defineFeature({
      name: 'vue',
      triggers: [],
      setup() {
        throw new Error('setup failed')
      },
    })

    await expect(resolveFeatureConfig(ctx, feature, {})).rejects.toThrow(
      /\[ViteConfig\] failed to resolve addon vue/,
    )
  })

  it('orders dependent addons after their dependencies and rejects cycles', () => {
    const dependency = defineFeature({
      name: 'react',
      triggers: [],
      setup: () => ({}),
    })
    const dependent = defineFeature({
      dependsOn: ['react'],
      name: 'vue',
      triggers: [],
      setup: () => ({}),
    })

    expect(resolveFeatureOrder([dependent, dependency]).map(feature => feature.name)).toEqual(['react', 'vue'])

    const cycleA = defineFeature({
      dependsOn: ['vue'],
      name: 'react',
      triggers: [],
      setup: () => ({}),
    })
    const cycleB = defineFeature({
      dependsOn: ['react'],
      name: 'vue',
      triggers: [],
      setup: () => ({}),
    })

    expect(() => resolveFeatureOrder([cycleA, cycleB])).toThrow(/circular addon dependency/)

    const missingDependency = defineFeature({
      dependsOn: ['pages'],
      name: 'react',
      triggers: [],
      setup: () => ({}),
    })

    expect(() => resolveFeatureOrder([missingDependency])).toThrow(/unknown addon pages/)
  })

  it('fails when a plugin module has no default factory', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-missing-default')
    mockRuntimeDeps = { vite: '^7.0.0' }
    const ctx = createAddonContext({ viteConfig: { root } })

    await expect(callDefaultFactory(ctx, 'virtualOwner', 'vite')).rejects.toThrow(
      /\[ViteConfig\] virtualOwner expected vite to expose a default plugin factory/,
    )
  })

  it('explains addon enablement without loading plugin modules', () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-inspect')
    mockRuntimeDeps = { vue: '^3.5.0' }

    const inspection = inspectViteFeatures({ react: true, tailwindcss: false, viteConfig: { root } })
    const vue = inspection.features.find(feature => feature.name === 'vue')
    const react = inspection.features.find(feature => feature.name === 'react')
    const tailwindcss = inspection.features.find(feature => feature.name === 'tailwindcss')

    expect(inspection.root).toBe(root)
    expect(vue).toMatchObject({
      enabled: true,
      matchedTriggers: ['vue'],
      missingRequires: ['@vitejs/plugin-vue'],
      reason: 'dependency-detected',
    })
    expect(react).toMatchObject({
      enabled: true,
      matchedTriggers: [],
      missingRequires: ['@vitejs/plugin-react'],
      reason: 'explicit-enabled',
    })
    expect(tailwindcss).toMatchObject({
      enabled: false,
      reason: 'explicit-disabled',
    })
  })

  it('auto-enables addons from devDependencies because Vite plugins are build-time packages', () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-dev-only')
    mockDeps = { 'vue': '^3.5.0', '@vitejs/plugin-vue': '^6.0.0' }

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const vue = inspection.features.find(feature => feature.name === 'vue')

    expect(vue).toMatchObject({
      enabled: true,
      matchedTriggers: ['vue', '@vitejs/plugin-vue'],
      missingRequires: [],
      reason: 'dependency-detected',
    })
  })

  it('does not treat the bare tailwindcss package as a Vite integration plugin', () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-runtime-tailwind-bare')
    mockDeps = { tailwindcss: '^4.0.0' }

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const tailwindcss = inspection.features.find(feature => feature.name === 'tailwindcss')

    expect(tailwindcss).toMatchObject({
      enabled: false,
      matchedTriggers: [],
      reason: 'dependency-missing',
    })
  })
})
