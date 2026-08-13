import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAppConfig, createLibConfig, inspectViteFeatures } from '@moluoxixi/vite-config'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'

const buildEnv: ConfigEnv = { command: 'build', mode: 'production' }
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

/**
 * 解析 Vite defineConfig 返回的对象或工厂，确保测试断言拿到真实运行配置。
 */
async function resolveConfig(config: UserConfigExport): Promise<UserConfig> {
  return typeof config === 'function' ? config(buildEnv) : config
}

/**
 * 清理并执行真实 app fixture 构建，避免上一次产物掩盖本次失败。
 */
async function buildAppFixture(name: string, options: Omit<Parameters<typeof createAppConfig>[0], 'viteConfig'> = {}): Promise<{
  fixturePath: string
  jsOutput: string
  outDir: string
}> {
  const fixturePath = path.resolve(__dirname, `fixtures/${name}`)
  const outDir = path.resolve(fixturePath, 'dist')

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }

  const config = await resolveConfig(createAppConfig({
    ...options,
    viteConfig: {
      build: { emptyOutDir: true, outDir },
      root: fixturePath,
    },
  }))

  await build({ ...config, logLevel: 'silent' })

  return {
    fixturePath,
    jsOutput: readBuiltJavaScript(outDir),
    outDir,
  }
}

/**
 * 读取构建产物中的全部 JavaScript chunk，用于验证真实输出内容。
 */
function readBuiltJavaScript(outDir: string): string {
  const assetsDir = path.join(outDir, 'assets')
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
  return assetFiles
    .filter(file => file.endsWith('.js'))
    .map(file => fs.readFileSync(path.join(assetsDir, file), 'utf-8'))
    .join('\n')
}

/**
 * 读取构建产物中的全部 CSS chunk，用于验证样式类 addon 真实生成资源。
 */
function readBuiltCss(outDir: string): string {
  const assetsDir = path.join(outDir, 'assets')
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
  return assetFiles
    .filter(file => file.endsWith('.css'))
    .map(file => fs.readFileSync(path.join(assetsDir, file), 'utf-8'))
    .join('\n')
}

describe('real consumer project integration', () => {
  it('builds a Vue app fixture from the consumer package manifest', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-app')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(expect.arrayContaining([
      'vue',
      'vueRouter',
      'autoImport',
      'components',
      'i18n',
      'devtools',
      'vitest',
    ]))

    const { jsOutput, outDir } = await buildAppFixture('real-app')

    expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true)
    expect(jsOutput).toContain('production-ready fixture')
    expect(fs.existsSync(path.join(fixturePath, 'src/typings/auto-imports.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(fixturePath, 'src/typings/components.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(fixturePath, 'src/typings/route-map.d.ts'))).toBe(true)
  }, 30000)

  it('builds a React fixture with the real React plugin', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-react')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(['react'])

    const { jsOutput, outDir } = await buildAppFixture('real-react')

    expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true)
    expect(jsOutput).toContain('real react addon')
  }, 30000)

  it('builds a style fixture with real Tailwind and UnoCSS plugins', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-styles')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(['unocss', 'tailwindcss'])

    const { outDir } = await buildAppFixture('real-styles')
    const cssOutput = readBuiltCss(outDir)

    expect(cssOutput).toContain('.style-fixture')
    expect(cssOutput).toContain('@layer theme')
    expect(cssOutput).toContain('--color-red-500')
    expect(cssOutput).toContain('--un-rotate')
  }, 30000)

  it('builds a Markdown fixture with real Markdown rendering plugins', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-markdown')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(['vue', 'markdown'])

    const { jsOutput } = await buildAppFixture('real-markdown')

    expect(jsOutput).toContain('real markdown addon')
  }, 60000)

  it('loads the real Vite SSG addon module from a consumer manifest', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-ssg')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(['viteSsg'])

    const config = await resolveConfig(createAppConfig({
      viteConfig: {
        root: fixturePath,
      },
    }))
    const plugins = (Array.isArray(config.plugins) ? config.plugins.flat(10) : []).filter(Boolean) as Array<{ name?: string }>
    const ssgConfig = config as UserConfig & { ssgOptions?: { onFinished?: () => void, script?: string } }

    expect(plugins).toHaveLength(0)
    expect(ssgConfig.ssgOptions?.script).toBe('async')
    expect(typeof ssgConfig.ssgOptions?.onFinished).toBe('function')
  }, 30000)

  it('keeps the real Vite SSG addon usable when sitemap is not installed', async () => {
    const root = createTempDir('moluoxixi-real-ssg-no-sitemap-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      dependencies: {
        'vite-ssg': '^28.0.0',
        'vue-i18n': '^10.0.0',
      },
    }))

    const inspection = inspectViteFeatures({ viteConfig: { root } })
    const viteSsg = inspection.features.find(feature => feature.name === 'viteSsg')

    expect(viteSsg).toMatchObject({
      enabled: true,
      missingRequires: [],
      reason: 'dependency-detected',
    })

    const config = await resolveConfig(createAppConfig({ viteConfig: { root } }))
    const ssgConfig = config as UserConfig & { ssgOptions?: { onFinished?: () => void, script?: string }, ssr?: { noExternal?: Array<string | RegExp> | string | RegExp } }
    const noExternal = (
      Array.isArray(ssgConfig.ssr?.noExternal)
        ? ssgConfig.ssr?.noExternal
        : [ssgConfig.ssr?.noExternal]
    ) as Array<string | RegExp | undefined>

    expect(ssgConfig.ssgOptions?.script).toBe('async')
    expect(ssgConfig.ssgOptions?.onFinished).toBeUndefined()
    expect(noExternal.some(entry => entry instanceof RegExp && entry.test('vue-i18n'))).toBe(true)
  })

  it('loads the real Vue layouts addon module from a consumer manifest', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-layouts')
    const inspection = inspectViteFeatures({ viteConfig: { root: fixturePath } })
    const enabledFeatures = inspection.features
      .filter(feature => feature.enabled)
      .map(feature => feature.name)

    expect(enabledFeatures).toEqual(['vue', 'vueLayouts'])

    const config = await resolveConfig(createAppConfig({
      viteConfig: {
        root: fixturePath,
      },
    }))
    const plugins = (Array.isArray(config.plugins) ? config.plugins.flat(10) : []).filter(Boolean) as Array<{ name?: string }>

    expect(plugins.some(plugin => plugin.name?.includes('layouts'))).toBe(true)
  }, 30000)

  it('builds a library fixture while keeping consumer dependencies external', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/real-lib')
    const outDir = path.resolve(fixturePath, 'dist')
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }

    const config = await resolveConfig(createLibConfig({
      vue: false,
      viteConfig: {
        build: { emptyOutDir: true, outDir },
        root: fixturePath,
      },
    }))

    await build({ ...config, logLevel: 'silent' })

    const esmOutput = fs.readFileSync(path.join(outDir, 'index.js'), 'utf-8')
    const cjsOutput = fs.readFileSync(path.join(outDir, 'index.cjs'), 'utf-8')

    expect(esmOutput).toContain('from "vue"')
    expect(esmOutput).toContain('from "@vueuse/core"')
    expect(cjsOutput).toContain('require("vue")')
    expect(cjsOutput).toContain('require("@vueuse/core")')
  }, 30000)

  it('reports missing runtime plugins for a real consumer manifest before build', async () => {
    const root = createTempDir('moluoxixi-real-missing-plugin-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      dependencies: {
        vue: '^3.5.0',
      },
    }))

    await expect(resolveConfig(createAppConfig({ viteConfig: { root } }))).rejects.toThrow(/@vitejs\/plugin-vue/)
  })
})
