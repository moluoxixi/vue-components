import type { Plugin } from 'vite'
import { getBaseConfig } from '@moluoxixi/vite-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 全局拦截通过引用暴露给测试动态改写的对象，高度控制模拟环境
let mockDeps: Record<string, string> = {}

vi.mock('@moluoxixi/utils/node', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    detectDependencies: () => ({
      dependencies: {},
      devDependencies: mockDeps,
      deps: mockDeps,
      optionalDependencies: {},
      peerDependencies: {},
      addonDeps: mockDeps,
      runtimeDeps: mockDeps,
    }),
  }
})

describe('dynamic Dependency Evaluator (Unit)', () => {
  beforeEach(() => {
    mockDeps = {} // reset
  })

  it('should skip heavyweight instantiation if no major framework dependencies detected', async () => {
    const config = await getBaseConfig()
    // Array should be undefined or absent since addons did not append anything
    expect(config.plugins).toBeUndefined()
  })

  it('should naturally load and configure Vue compiler if Vue is present but React is not', async () => {
    mockDeps = { 'vue': '^3.3.0', '@vitejs/plugin-vue': '^6.0.0' }
    const config = await getBaseConfig()

    expect(Array.isArray(config.plugins)).toBe(true)

    // Flatten Vite Plugin Array
    const flatPlugins = config.plugins!.flat(10).filter(Boolean) as Plugin[]
    const hasVuePlugin = flatPlugins.some(p => p.name === 'vite:vue')
    const hasReactPlugin = flatPlugins.some(p => p.name === 'vite:react-babel')

    expect(hasVuePlugin).toBe(true)
    expect(hasReactPlugin).toBe(false) // 独立解耦验证
  })

  it('should exclusively spawn React build pipelines if Vue is excluded', async () => {
    mockDeps = { 'react': '^18.0.0', '@vitejs/plugin-react': '^4.0.0' }
    const config = await getBaseConfig()

    expect(Array.isArray(config.plugins)).toBe(true)

    const flatPlugins = config.plugins!.flat(10).filter(Boolean) as Plugin[]
    const hasVuePlugin = flatPlugins.some(p => p.name === 'vite:vue')
    const hasReactPlugin = flatPlugins.some(p => p.name === 'vite:react-babel')

    expect(hasVuePlugin).toBe(false)
    expect(hasReactPlugin).toBe(true)
  })

  it('should fail loudly when an auto-enabled addon misses its runtime plugin package', async () => {
    mockDeps = { vue: '^3.3.0' }

    await expect(getBaseConfig()).rejects.toThrow(/@vitejs\/plugin-vue/)
  })

  it('should respect explicit false over detected dependencies', async () => {
    mockDeps = { 'vue': '^3.3.0', '@vitejs/plugin-vue': '^6.0.0' }

    const config = await getBaseConfig({ vue: false })

    expect(config.plugins).toBeUndefined()
  })

  it('should not auto-enable Vitest from a detected devDependency', async () => {
    mockDeps = { vitest: '^4.0.0' }

    const config = await getBaseConfig()

    expect((config as { test?: unknown }).test).toBeUndefined()
  })

  it('should configure Vitest when explicitly enabled', async () => {
    const config = await getBaseConfig({ vitest: true })

    expect((config as { test?: unknown }).test).toMatchObject({
      environment: 'jsdom',
      include: ['test/**/*.test.ts'],
    })
  })
})
