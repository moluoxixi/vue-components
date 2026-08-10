import type { LibraryOptions, UserConfig, UserConfigExport } from 'vite'
import type { ViteConfigExport } from '../types'
import path from 'node:path'
import process from 'node:process'
import { detectDependencies } from '@moluoxixi/utils/node'
import { defineConfig, mergeConfig } from 'vite'
import { getBaseConfig } from './base'
import { mergeConfigWithUserPlugins } from './merge'

/**
 * 构造库模式 external 判断器；依赖包本身和其子路径导入都必须排除出产物。
 */
function createDependencyExternal(dependencies: string[]): (id: string) => boolean {
  const uniqueDeps = Array.from(new Set(dependencies))

  return id => uniqueDeps.some(dep => id === dep || id.startsWith(`${dep}/`))
}

/**
 * 将库入口统一解析到项目 root 下，保证 createLibConfig 的默认值和显式入口遵循同一基准目录。
 */
function resolveEntryPath(root: string, entry: string): string {
  return path.isAbsolute(entry) ? entry : path.resolve(root, entry)
}

function resolveLibEntry(root: string, entry: LibraryOptions['entry']): LibraryOptions['entry'] {
  if (typeof entry === 'string') {
    return resolveEntryPath(root, entry)
  }

  if (Array.isArray(entry)) {
    return entry.map(item => resolveEntryPath(root, item))
  }

  return Object.fromEntries(
    Object.entries(entry).map(([name, item]) => [name, resolveEntryPath(root, item)]),
  )
}

/**
 * 构建 Library（库项目）专用的 Vite 配置文件
 *
 * @example
 * // 对象形式
 * export default createLibConfig()
 *
 * export default createLibConfig(({ mode }) => ({
 *   viteConfig: {
 *     build: { sourcemap: mode !== 'production' },
 *   }
 * }))
 */
export function createLibConfig(config: ViteConfigExport = {}): UserConfigExport {
  return defineConfig(async (env) => {
    const userOptions = typeof config === 'function' ? await config(env) : config
    const viteConfigExt = userOptions.viteConfig || {}
    const root = typeof viteConfigExt.root === 'string' ? viteConfigExt.root : process.cwd()
    const normalizedOptions = {
      ...userOptions,
      viteConfig: {
        ...viteConfigExt,
        root,
      },
    }
    const baseConfig = await getBaseConfig(normalizedOptions)
    const { dependencies, optionalDependencies, peerDependencies } = detectDependencies(root)
    const libEntry = resolveLibEntry(root, userOptions.entry ?? 'src/index.ts')

    // 最佳实践：库开发过程中必须将业务依赖项 external 剔除出去，否则会打进包内造成膨胀
    const external = createDependencyExternal([
      ...Object.keys(dependencies),
      ...Object.keys(optionalDependencies),
      ...Object.keys(peerDependencies),
    ])

    const libConfig: UserConfig = {
      build: {
        lib: {
          entry: libEntry,
          formats: ['es', 'cjs'],
          fileName: 'index',
        },
        rollupOptions: {
          external,
        },
      },
    }

    return mergeConfigWithUserPlugins(mergeConfig(baseConfig, libConfig), viteConfigExt)
  })
}
