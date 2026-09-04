import type { LibraryOptions, Rollup, UserConfig, UserConfigExport } from 'vite'
import type { LibViteConfigExport } from '../../../types'
import path from 'node:path'
import process from 'node:process'
import { detectDependencies } from '@moluoxixi/utils/node'
import { defineConfig, mergeConfig } from 'vite'
import { getBaseConfig } from '../../base'
import { mergeConfigWithUserPlugins } from '../../services'

type ExternalOption = NonNullable<Rollup.RollupOptions['external']>
type ExternalPredicate = Extract<ExternalOption, (...args: any[]) => any>

/**
 * 构造库模式 external 判断器；依赖包本身和其子路径导入都必须排除出产物。
 */
function createDependencyExternal(dependencies: string[]): ExternalPredicate {
  const uniqueDeps = Array.from(new Set(dependencies))

  return id => uniqueDeps.some(dep => id === dep || id.startsWith(`${dep}/`))
}

function matchesExternalPattern(pattern: string | RegExp, id: string): boolean {
  if (typeof pattern === 'string') {
    return pattern === id
  }

  const lastIndex = pattern.lastIndex
  const matches = pattern.test(id)
  pattern.lastIndex = lastIndex
  return matches
}

function matchesExternalOption(
  external: ExternalOption,
  id: string,
  importer: string | undefined,
  isResolved: boolean,
): boolean {
  if (typeof external === 'function') {
    return Boolean(external(id, importer, isResolved))
  }

  const patterns = Array.isArray(external) ? external : [external]
  return patterns.some(pattern => matchesExternalPattern(pattern, id))
}

function combineExternalOptions(
  dependencyExternal: ExternalPredicate,
  userExternal: ExternalOption | undefined,
): ExternalPredicate {
  if (!userExternal) {
    return dependencyExternal
  }

  return (id, importer, isResolved) => (
    dependencyExternal(id, importer, isResolved)
    || matchesExternalOption(userExternal, id, importer, isResolved)
  )
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
export function createLibConfig(config: LibViteConfigExport = {}): UserConfigExport {
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
      },
    }

    const mergedConfig = await mergeConfigWithUserPlugins(mergeConfig(baseConfig, libConfig), viteConfigExt)
    mergedConfig.build = {
      ...mergedConfig.build,
      rollupOptions: {
        ...mergedConfig.build?.rollupOptions,
        external: combineExternalOptions(external, viteConfigExt.build?.rollupOptions?.external),
      },
    }

    return mergedConfig
  })
}
