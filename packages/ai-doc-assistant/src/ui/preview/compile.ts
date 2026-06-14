import type { Component } from 'vue'
// 本地 workspace 组件库运行时（vite.ui.config alias 解析到 dist 实体）。
import * as Components from '@moluoxixi/components'
import * as ElementPlusRuntime from 'element-plus'
/**
 * demo 预览块运行时：把示例 SFC 源码字符串在浏览器内编译为 Vue 组件并挂载真实组件。
 *
 * 为何不用 iframe 沙箱：示例 `import { X } from '@moluoxixi/components'` 是本地 workspace
 * 组件库，CDN 不可解析，故必须在父应用内用 vue3-sfc-loader + moduleCache 注入本地组件库运行时。
 * 该路径已由 .spike/preview 真实浏览器验证通过。
 */
import * as VueRuntime from 'vue'
import { loadModule } from 'vue3-sfc-loader/dist/vue3-sfc-loader.esm.js'

/**
 * 把 SFC 源码编译为可挂载组件。
 * 编译/运行期错误通过 onError 显式上抛给宿主展示，绝不静默吞掉。
 *
 * 返回 dispose 句柄：编译过程向 document.head 注入的 <style> 由调用方在
 * 重编译前或组件卸载时调用 dispose 清理，避免长会话下 <style> 持续累积泄漏。
 * @param source SFC 源码字符串（含 `<script setup lang="ts">`）
 * @param onError 编译/运行期错误回调
 */
export async function compileSfc(
  source: string,
  onError: (e: unknown) => void,
): Promise<{ component: Component, dispose: () => void }> {
  const styleEls: HTMLStyleElement[] = []
  const dispose = (): void => {
    for (const el of styleEls.splice(0))
      el.remove()
  }
  const options = {
    moduleCache: {
      // 注入 vue 运行时，保证与宿主同实例（避免双 Vue 实例导致挂载失败）。
      'vue': VueRuntime,
      // 示例可直接 `import { ElButton } from 'element-plus'`；宿主入口也已全局注册 Element Plus。
      'element-plus': ElementPlusRuntime,
      // 样式副作用模块占位（宿主已全局注入，吞掉避免 loader 再解析）。
      'element-plus/dist/index.css': {},
      // 示例里 `import { X } from '@moluoxixi/components'` 命中此处运行时。
      '@moluoxixi/components': Components,
      // 样式副作用模块占位（宿主已全局注入，吞掉避免 loader 再解析）。
      '@moluoxixi/components/styles': {},
    },
    getFile: async (path: string) => {
      if (path === '/preview.vue' || path.endsWith('.vue'))
        return { getContentData: () => source, type: '.vue' as const }
      throw new Error(`预览块未预期的模块请求：${path}`)
    },
    addStyle: (css: string) => {
      const el = document.createElement('style')
      el.textContent = css
      document.head.appendChild(el)
      styleEls.push(el)
    },
    log: (type: string, ...args: unknown[]) => {
      if (type === 'error')
        onError(args.join(' '))
    },
    handleModule: async () => undefined as unknown,
  }
  try {
    const component = await (loadModule('/preview.vue', options as never) as Promise<Component>)
    return { component, dispose }
  }
  catch (err) {
    // 编译失败也要清理已注入的样式，避免半成品残留。
    dispose()
    throw err
  }
}
