import type { UnoCssAddonOptions } from '../../../addons'
import type { AddonContext } from './runtime'
import fs from 'node:fs'
import { defineFeature } from './runtime'
import { callDefaultFactory, mergeAddonOptions } from './shared'

const UNO_CONFIG_FILES = [
  'uno.config.ts',
  'uno.config.mts',
  'uno.config.cts',
  'uno.config.js',
  'uno.config.mjs',
  'uno.config.cjs',
  'unocss.config.ts',
  'unocss.config.mts',
  'unocss.config.cts',
  'unocss.config.js',
  'unocss.config.mjs',
  'unocss.config.cjs',
]

/**
 * 解析目标项目的 UnoCSS 配置文件；缺失时显式关闭配置加载，避免测试与 CI 输出误报错误日志。
 */
function resolveUnoConfigFile(ctx: AddonContext): string | false {
  const configFile = UNO_CONFIG_FILES
    .map(file => ctx.resolvePath(file))
    .find(file => fs.existsSync(file))

  return configFile || false
}

type UnoCssModule = typeof import('unocss/vite')

export const unocssFeature = defineFeature<UnoCssAddonOptions>({
  name: 'unocss',
  requires: ['unocss'],
  triggers: ['unocss'],
  async setup(ctx, options) {
    const defaultOptions = {
      configFile: resolveUnoConfigFile(ctx),
    } satisfies Exclude<UnoCssAddonOptions, string>

    return {
      plugins: [
        await callDefaultFactory<UnoCssAddonOptions, ReturnType<UnoCssModule['default']>>(
          ctx,
          'unocss',
          'unocss/vite',
          typeof options === 'string' ? options : mergeAddonOptions(options, defaultOptions),
        ),
      ],
    }
  },
})
