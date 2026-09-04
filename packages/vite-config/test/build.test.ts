import type { ConfigEnv, Plugin, UserConfig, UserConfigExport } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { createAppConfig, createLibConfig } from '@moluoxixi/vite-config'
import { mergeConfigWithUserPlugins } from '@moluoxixi/vite-config/config/services/merge'
import { build } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv: ConfigEnv = { command: 'build', mode: 'production' }
let mockDeps: Record<string, string> = {}
let mockDependencies: Record<string, string> = {}
let mockOptionalDependencies: Record<string, string> = {}
let mockPeerDependencies: Record<string, string> = {}

async function resolveConfig(config: UserConfigExport): Promise<UserConfig> {
  return typeof config === 'function' ? config(mockEnv) : config
}

vi.mock('@moluoxixi/utils/node', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    detectDependencies: () => ({
      dependencies: mockDependencies,
      devDependencies: mockDeps,
      deps: mockDeps,
      optionalDependencies: mockOptionalDependencies,
      peerDependencies: mockPeerDependencies,
      addonDeps: {
        ...mockDeps,
        ...mockPeerDependencies,
      },
      runtimeDeps: {
        ...mockDeps,
        ...mockPeerDependencies,
      },
    }),
  }
})

describe('vite Pipeline Integration Build', () => {
  beforeEach(() => {
    mockDeps = {}
    mockDependencies = {}
    mockOptionalDependencies = {}
    mockPeerDependencies = {}
  })

  it('config factories should resolve function-style user options without injecting empty app build config', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')

    const appConfig = await resolveConfig(createAppConfig(({ mode }) => ({
      viteConfig: {
        base: mode === 'production' ? '/prod/' : '/',
      },
    })))
    const libConfig = await resolveConfig(createLibConfig(({ mode }) => ({
      viteConfig: {
        build: {
          sourcemap: mode === 'production',
        },
        root: fixturePath,
      },
    })))

    expect(appConfig.base).toBe('/prod/')
    expect(appConfig.build?.rollupOptions?.output).toBeUndefined()
    expect(libConfig.build?.sourcemap).toBe(true)
    expect(libConfig.build?.lib).toMatchObject({
      entry: path.resolve(fixturePath, 'src/index.ts'),
      formats: ['es', 'cjs'],
    })
  })

  it('lib Mode: should resolve explicit entry from the consumer root', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    const config = await resolveConfig(createLibConfig({
      entry: 'src/main.ts',
      viteConfig: {
        root: fixturePath,
      },
    }))

    expect(config.build?.lib).toMatchObject({
      entry: path.resolve(fixturePath, 'src/main.ts'),
    })
  })

  it('uses Vite merge semantics for user arrays and functions', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    const aliases = [{ find: '@', replacement: path.resolve(fixturePath, 'custom-src') }]
    const external = (id: string) => id === 'user-external'

    const appConfig = await resolveConfig(createAppConfig({
      viteConfig: {
        resolve: { alias: aliases },
      },
    }))
    const libConfig = await resolveConfig(createLibConfig({
      viteConfig: {
        build: {
          lib: {
            entry: path.resolve(fixturePath, 'src/index.ts'),
            formats: ['umd'],
          },
          rollupOptions: { external },
        },
        root: fixturePath,
      },
    }))

    expect(appConfig.resolve?.alias).toEqual(expect.arrayContaining(aliases))
    expect((appConfig.resolve?.alias as unknown[])[0]).toEqual(aliases[0])
    expect(libConfig.build?.lib).toMatchObject({ formats: ['es', 'cjs', 'umd'] })
    expect(typeof libConfig.build?.rollupOptions?.external).toBe('function')
    expect((libConfig.build?.rollupOptions?.external as (id: string) => boolean)('user-external')).toBe(true)
    expect((libConfig.build?.rollupOptions?.external as (id: string) => boolean)('other')).toBe(false)
  })

  it('keeps caller-owned business plugins in the final application config', async () => {
    const businessPlugin = { name: 'business-observability' }
    const config = await resolveConfig(createAppConfig({
      viteConfig: {
        plugins: [businessPlugin],
      },
    }))

    expect(config.plugins).toContain(businessPlugin)
  })

  it('dedupes only cross-source plugin conflicts', async () => {
    const sharedAnonymous = {} as Plugin
    const baseAnonymous = {} as Plugin
    const userAnonymous = {} as Plugin
    const baseNamed = { name: 'shared-name' }
    const baseRepeated = [{ name: 'base-repeat' }, { name: 'base-repeat' }]
    const userNamed = [{ name: 'shared-name' }, { name: 'shared-name' }]

    const config = await mergeConfigWithUserPlugins({
      plugins: [sharedAnonymous, baseAnonymous, baseNamed, ...baseRepeated],
    }, {
      plugins: [sharedAnonymous, userAnonymous, ...userNamed],
    })

    expect(config.plugins).toEqual([
      baseAnonymous,
      ...baseRepeated,
      sharedAnonymous,
      userAnonymous,
      ...userNamed,
    ])
  })

  it('app Mode: should successfully compile realistic chunks', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/app')
    const outDir = path.resolve(fixturePath, 'dist')

    // 清理遗留目录
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }

    const config = await resolveConfig(createAppConfig())

    // 执行真实的 Vite 打包 (基于配置)
    await build({
      ...config,
      root: fixturePath,
      logLevel: 'info',
      build: { ...config.build, outDir, emptyOutDir: true },
    })

    const hasHtml = fs.existsSync(path.resolve(outDir, 'index.html'))

    expect(hasHtml).toBe(true)
  }, 30000) // 彻底放宽时间保证大型插件加载不超时

  it('lib Mode: should successfully execute Rollup CJS/ESM distribution', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    const outDir = path.resolve(fixturePath, 'dist')

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }

    const config = await resolveConfig(createLibConfig({ viteConfig: { root: fixturePath } }))

    await build({
      ...config,
      root: fixturePath,
      logLevel: 'info',
      build: {
        ...config.build,
        outDir,
        emptyOutDir: true,
      },
    })

    const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : []

    const hasOutput = files.some(f => f.includes('index'))
    expect(hasOutput).toBe(true)
  }, 30000)

  it('lib Mode: should externalize dependency subpath imports', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    mockDeps = {}
    mockPeerDependencies = { vite: '^7.3.1' }

    const config = await resolveConfig(createLibConfig({ viteConfig: { root: fixturePath } }))
    const external = config.build?.rollupOptions?.external

    expect(typeof external).toBe('function')
    expect((external as (id: string) => boolean)('vite')).toBe(true)
    expect((external as (id: string) => boolean)('vite/module-runner')).toBe(true)
    expect((external as (id: string) => boolean)('@scope/pkg/subpath')).toBe(false)
  })

  it.each([
    ['string', 'user-external', 'user-external'],
    ['regular expression', /^virtual:/, 'virtual:module'],
    ['array', ['array-external', /^custom:/], 'custom:module'],
  ])('lib Mode: combines automatic externalization with a user %s rule', async (_, userExternal, userMatch) => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    mockDependencies = { 'runtime-dep': '^1.0.0' }
    mockOptionalDependencies = { 'optional-dep': '^1.0.0' }
    mockPeerDependencies = { 'peer-dep': '^1.0.0' }

    const config = await resolveConfig(createLibConfig({
      viteConfig: {
        build: {
          rollupOptions: {
            external: userExternal,
          },
        },
        root: fixturePath,
      },
    }))
    const external = config.build?.rollupOptions?.external as (id: string) => boolean

    expect(external('runtime-dep/subpath')).toBe(true)
    expect(external('optional-dep/subpath')).toBe(true)
    expect(external('peer-dep/subpath')).toBe(true)
    expect(external(userMatch as string)).toBe(true)
    expect(external('not-external')).toBe(false)
  })

  it('lib Mode: forwards Rollup context to a user external predicate', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/lib')
    const userExternal = vi.fn((id: string, importer: string | undefined, isResolved: boolean) => (
      id === 'user-external' && importer === '/src/index.ts' && isResolved
    ))
    mockPeerDependencies = { vite: '^7.3.1' }

    const config = await resolveConfig(createLibConfig({
      viteConfig: {
        build: { rollupOptions: { external: userExternal } },
        root: fixturePath,
      },
    }))
    const external = config.build?.rollupOptions?.external as (
      id: string,
      importer: string | undefined,
      isResolved: boolean,
    ) => boolean

    expect(external('vite', '/src/index.ts', true)).toBe(true)
    expect(userExternal).not.toHaveBeenCalled()
    expect(external('user-external', '/src/index.ts', true)).toBe(true)
    expect(userExternal).toHaveBeenCalledWith('user-external', '/src/index.ts', true)
  })
})
