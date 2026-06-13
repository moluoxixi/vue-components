// 方案 A：vue3-sfc-loader —— 一站式成熟库，内部封装 SFC 编译 + TS 转译 + 模块解析 + 样式注入。
// 我们只需提供 loadModule 的 options：怎么取文件内容、怎么解析依赖、怎么加样式。

import { loadModule, type Options } from 'vue3-sfc-loader'
import * as vueRuntime from 'vue'

export async function compileSfcLoader(source: string, filename = 'AnonLoader.vue'): Promise<Record<string, unknown>> {
  const styleEls: HTMLStyleElement[] = []

  const options: Options = {
    moduleCache: {
      vue: vueRuntime,
    },
    // 把 SFC 源码字符串喂给 loader（它按 path 取内容）
    async getFile(path: string) {
      if (path === filename || path === `/${filename}`)
        return { getContentData: () => source, type: '.vue' }
      throw new Error(`[spike-A] 未知文件: ${path}`)
    },
    // 样式注入到 document（spike 里收集起来便于清理）
    addStyle(textContent: string) {
      const style = document.createElement('style')
      style.textContent = textContent
      document.head.appendChild(style)
      styleEls.push(style)
    },
    log(type: string, ...args: unknown[]) {
      // eslint-disable-next-line no-console
      console.log(`[sfc-loader:${type}]`, ...args)
    },
  }

  const component = await loadModule(filename, options)
  return component as Record<string, unknown>
}
