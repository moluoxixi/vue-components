<script setup lang="ts">
/**
 * 实时预览面板：把 AI 返回的示例 SFC 骨架在浏览器运行时编译并以真实组件渲染。
 *
 * 架构（ADR-0003 修订）：示例骨架由 generator 确定性产出（非 AI 自由生成的不可信代码），
 * 威胁低；目标是渲染本仓真实组件 @moluoxixi/components（workspace 本地包、无 CDN ESM 产物，
 * 无法在 opaque-origin iframe 内 import）。故用 vue3-sfc-loader 在父应用运行时编译 SFC，
 * 经 moduleCache 注入真实的 vue 与组件库模块。
 *
 * 关键修复：编译产物用 `<component :is>` 在**主应用渲染树内**渲染，
 * 不再 `createApp().mount(host)` 到主应用的 ref 节点 —— 后者会让第二个 Vue app
 * 接管主 app 拥有的 DOM 节点，unmount 时破坏主 app 的虚拟 DOM，导致整页白屏。
 */
import type { Component } from 'vue'
import { onErrorCaptured, onUnmounted, shallowRef, watch } from 'vue'
import * as Vue from 'vue'
// 真实组件库与样式：作为 moduleCache 注入，使示例骨架的 import 解析为真实实现
import * as Components from '@moluoxixi/components'
import { loadModule } from 'vue3-sfc-loader'
import '@moluoxixi/components/styles'

const props = defineProps<{ code: string, lang: string }>()

/** 编译挂载得到的真实组件（shallowRef 避免 Vue 递归代理组件内部）。 */
const previewComp = shallowRef<Component | null>(null)
const errorMsg = shallowRef('')
const compiling = shallowRef(false)

/** 上一次编译注入样式的清理句柄；重编译/卸载时调用，避免 <style> 泄漏。 */
let lastStyles: HTMLStyleElement[] = []
/** 编译请求序号：仅最新一次允许写入状态，避免并发切换的陈旧结果覆盖。 */
let runId = 0

/** 清理上一次编译注入的 <style>。 */
function disposeStyles(): void {
  for (const el of lastStyles.splice(0))
    el.remove()
}

/** 用 vue3-sfc-loader 编译示例 SFC，得到可用 `<component :is>` 渲染的组件。 */
async function renderPreview(code: string): Promise<void> {
  const seq = ++runId
  disposeStyles()
  previewComp.value = null
  errorMsg.value = ''
  if (!code)
    return
  compiling.value = true

  const styleEls: HTMLStyleElement[] = []
  const options = {
    moduleCache: {
      // 注入 vue 运行时，保证与宿主同实例（避免双 Vue 实例导致挂载失败）。
      'vue': Vue,
      // 示例里 `import { X } from '@moluoxixi/components'` 命中此处运行时。
      '@moluoxixi/components': Components,
      // 样式副作用模块占位（宿主已全局注入，吞掉避免 loader 再解析）。
      '@moluoxixi/components/styles': {},
    },
    getFile: async () => code,
    addStyle: (textContent: string) => {
      const style = document.createElement('style')
      style.textContent = textContent
      style.dataset.aiDocPreview = 'true'
      document.head.appendChild(style)
      styleEls.push(style)
    },
    handleModule: async () => undefined as unknown,
    log: (type: string, ...args: unknown[]) => {
      // 编译告警仅记录，不静默吞错；真实失败由 catch 暴露给用户
      if (type === 'error' && seq === runId)
        errorMsg.value = args.join(' ')
    },
  }

  try {
    const component = await (loadModule('/preview.vue', options as never) as Promise<Component>)
    // 并发守卫：已有更新的编译请求时，丢弃本次陈旧结果并清理其样式。
    if (seq !== runId) {
      for (const el of styleEls)
        el.remove()
      return
    }
    lastStyles = styleEls
    previewComp.value = component
  }
  catch (err) {
    for (const el of styleEls)
      el.remove()
    if (seq === runId)
      errorMsg.value = `预览编译失败：${err instanceof Error ? err.message : String(err)}`
  }
  finally {
    if (seq === runId)
      compiling.value = false
  }
}

watch(
  () => props.code,
  (code) => { void renderPreview(code) },
  { immediate: true },
)

/**
 * 错误边界：预览子树（真实组件渲染）抛出的运行时错误在此拦截，转为可见错误提示，
 * 并返回 false 阻止错误继续向根 app 冒泡 —— 否则未捕获的渲染错误会触发整个宿主 app
 * 卸载，导致整页白屏（用户实测：提问后真实组件渲染异常即整页消失的根因）。
 */
onErrorCaptured((err) => {
  errorMsg.value = `预览渲染失败：${err instanceof Error ? err.message : String(err)}`
  previewComp.value = null
  return false
})

/** 组件卸载时清理最后一次注入的样式，避免泄漏。 */
onUnmounted(() => { disposeStyles() })
</script>

<template>
  <div class="preview">
    <div class="preview-bar">
      <span class="dot" />实时预览（真实组件）
    </div>
    <div v-if="compiling" class="preview-empty" data-testid="preview-compiling">
      编译中…
    </div>
    <div v-else-if="errorMsg" class="preview-error" data-testid="preview-error">
      {{ errorMsg }}
    </div>
    <div v-else-if="previewComp" class="preview-host" data-testid="preview-mounted">
      <component :is="previewComp" />
    </div>
    <div v-else class="preview-empty" data-testid="preview-empty">
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
