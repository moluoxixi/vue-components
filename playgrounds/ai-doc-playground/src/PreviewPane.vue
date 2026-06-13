<script setup lang="ts">
/**
 * 实时预览面板：把 AI 返回的示例 SFC 骨架在父应用内运行时编译并挂载真实组件。
 *
 * 架构（ADR-0003 修订）：示例骨架由 generator 确定性产出（非 AI 自由生成的不可信代码），
 * 威胁低；且目标是渲染本仓真实组件 @moluoxixi/components，该包是 workspace 本地包、
 * 无 CDN ESM 产物，无法在 opaque-origin iframe 内 import。故改用 vue3-sfc-loader
 * 在父应用运行时编译 SFC，经 moduleCache 注入真实的 vue 与组件库模块，渲染真实组件。
 */
import { type App, createApp, ref, shallowRef, watch } from 'vue'
import * as Vue from 'vue'
// 真实组件库与样式：作为 moduleCache 注入，使示例骨架的 import 可解析为真实实现
import * as Components from '@moluoxixi/components'
import '@moluoxixi/components/styles'
import { loadModule } from 'vue3-sfc-loader'

const props = defineProps<{ code: string, lang: string }>()

const hostRef = ref<HTMLDivElement | null>(null)
const errorMsg = shallowRef('')
let mountedApp: App | null = null

/** 卸载上一次挂载的预览实例，避免多次提问叠加。 */
function teardown(): void {
  if (mountedApp) {
    mountedApp.unmount()
    mountedApp = null
  }
}

/**
 * 用 vue3-sfc-loader 编译示例 SFC 并挂载到 host。
 * vue3-sfc-loader 内置 babel 处理 `lang="ts"`，TS 类型注解会被自动转译。
 */
async function renderPreview(code: string): Promise<void> {
  errorMsg.value = ''
  teardown()
  const host = hostRef.value
  if (!host || !code)
    return

  const options = {
    moduleCache: {
      // 注入真实模块：示例骨架内的 import 直接命中，无需网络/CDN
      'vue': Vue,
      '@moluoxixi/components': Components,
    },
    // 单文件场景：任何被请求的文件名都返回当前示例源码
    getFile: async () => code,
    // 把组件 <style> 注入文档（预览样式隔离要求低，演示用途）
    addStyle: (textContent: string) => {
      const style = document.createElement('style')
      style.textContent = textContent
      style.dataset.aiDocPreview = 'true'
      document.head.appendChild(style)
    },
    handleModule: undefined,
    log: (type: string, ...args: unknown[]) => {
      // 编译告警仅记录，不静默吞错；真实失败由 catch 暴露给用户
      if (type === 'error')
        console.error('[ai-doc preview]', ...args)
    },
  }

  // loadModule 第一参为虚拟文件名，扩展名须为 .vue 以走 SFC 编译路径
  const component = await loadModule('preview.vue', options as never)
  mountedApp = createApp(component)
  // 预览内组件渲染异常显式上抛，不静默
  mountedApp.config.errorHandler = (err: unknown) => {
    errorMsg.value = `组件渲染失败：${err instanceof Error ? err.message : String(err)}`
  }
  mountedApp.mount(host)
}

watch(
  () => props.code,
  (code) => {
    renderPreview(code).catch((e: unknown) => {
      // 编译/挂载失败显式展示，绝不伪装成功
      errorMsg.value = `预览编译失败：${e instanceof Error ? e.message : String(e)}`
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="preview">
    <div class="preview-bar">
      <span class="dot" />实时预览（真实组件）
    </div>
    <div v-show="code && !errorMsg" ref="hostRef" class="preview-host" />
    <div v-if="errorMsg" class="preview-error">{{ errorMsg }}</div>
    <div v-show="!code && !errorMsg" class="preview-empty">
      提问后，AI 返回的示例将在此运行时编译并渲染真实组件
    </div>
  </div>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; height: 100%; }
.preview-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; font-size: 13px; font-weight: 600;
  color: #57606a; border-bottom: 1px solid #d0d7de; background: #f6f8fa;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #1a7f37; }
.preview-host { flex: 1; padding: 16px; overflow: auto; background: #fff; }
.preview-error {
  flex: 1; margin: 16px; padding: 12px 14px; border-radius: 8px;
  background: #ffebe9; border: 1px solid #ff818266; color: #cf222e;
  font-size: 13px; white-space: pre-wrap; font-family: ui-monospace, monospace;
}
.preview-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px; color: #8c959f; font-size: 13px; text-align: center;
}
</style>
