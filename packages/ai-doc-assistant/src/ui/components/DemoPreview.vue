<script setup lang="ts">
/**
 * demo 预览块：真实组件实时预览 + TS/JS 双码查看与复制。
 *
 * 三个分区：
 *  - 预览：用 vue3-sfc-loader 在浏览器运行时编译当前选中语言的示例 SFC 并挂载真实组件。
 *  - 代码：按 TS/JS 切换查看源码，单独复制当前语言源码。
 * 编译错误显式展示，绝不静默吞（满足「错误必须显式暴露」红线）。
 *
 * Props 由父级 ChatView 在收到 SSE example 事件后传入；ts/js 为持久化的双码源，
 * 不做 js=ts 静默降级（降级在服务端已被禁止，前端只忠实呈现）。
 */
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import { compileSfc } from '../preview'

const props = withDefaults(defineProps<{
  ts: string
  /** JS 版本源码：缺省表示无独立 JS（隐藏 JS 切换，不伪造降级）。 */
  js?: string
  component: string
  packageName: string
  /** 能否编译预览：false 时仅展示源码 + 原因，不挂载真实组件（依赖白名单外）。 */
  renderable?: boolean
  /** 不可渲染原因（renderable=false 时展示给用户）。 */
  reason?: string
}>(), {
  renderable: true,
})

/** 是否提供了独立 JS 源码（无则隐藏 JS 切换）。 */
const hasJs = computed(() => typeof props.js === 'string' && props.js.length > 0)
/** 当前查看/预览的语言。 */
const lang = ref<'ts' | 'js'>('ts')
/** 当前语言对应的源码（无 JS 时恒为 ts）。 */
const currentCode = computed(() => (lang.value === 'js' && hasJs.value ? (props.js as string) : props.ts))
/** 源码区是否展开（对齐 Element Plus 官网：默认折叠，点击底部操作栏展开）。 */
const showCode = ref(false)

/** 编译挂载得到的真实组件（shallowRef 避免 Vue 递归代理组件内部）。 */
const previewComp = shallowRef<Component | null>(null)
/** 编译/运行期错误信息。 */
const compileError = ref('')
/** 编译进行中标志。 */
const compiling = ref(false)
/** 复制结果提示（'ts'/'js'=对应按钮刚复制成功；'error'=复制失败）。 */
const copied = ref('')
/** 复制失败信息（剪贴板权限被拒/非安全上下文等），显式呈现不静默吞。 */
const copyError = ref('')

/** 上一次编译注入样式的清理句柄；重编译/卸载时调用，避免 <style> 泄漏。 */
let lastDispose: (() => void) | null = null
/** 编译请求序号：仅最新一次请求允许写入状态，避免并发切换的陈旧结果覆盖。 */
let runId = 0
/** 复制提示的定时器，卸载时清理。 */
let copyTimer = 0

/** 编译当前语言源码为可挂载组件；不可渲染或错误时不挂载，错误显式呈现，不吞掉。 */
async function recompile(): Promise<void> {
  const seq = ++runId
  // 切换语言/源码会重新编译，先清理上一次注入的样式，避免 <head> 累积。
  lastDispose?.()
  lastDispose = null
  previewComp.value = null
  // 不可渲染块（依赖白名单外）：不编译，仅展示源码 + 原因。
  if (!props.renderable) {
    compiling.value = false
    compileError.value = ''
    return
  }
  compiling.value = true
  compileError.value = ''
  try {
    const { component, dispose } = await compileSfc(currentCode.value, (e) => {
      // 仅最新请求的运行期错误回调允许写入，避免被并发的旧编译污染。
      if (seq === runId)
        compileError.value = e instanceof Error ? e.message : String(e)
    })
    // 并发守卫：已有更新的编译请求发起时，丢弃本次陈旧结果并清理其样式。
    if (seq !== runId) {
      dispose()
      return
    }
    lastDispose = dispose
    previewComp.value = component
  }
  catch (err) {
    if (seq === runId)
      compileError.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    if (seq === runId)
      compiling.value = false
  }
}

/** 源码或语言变化时重新编译预览。 */
watch(
  () => currentCode.value,
  () => { void recompile() },
  { immediate: true },
)

/** 组件卸载时清理最后一次注入的样式与定时器，避免泄漏。 */
onUnmounted(() => {
  lastDispose?.()
  lastDispose = null
  if (copyTimer)
    window.clearTimeout(copyTimer)
})

/** 复制当前语言源码到剪贴板；失败显式提示，不静默吞 rejection。 */
async function copy(which: 'ts' | 'js'): Promise<void> {
  const text = which === 'js' && hasJs.value ? (props.js as string) : props.ts
  if (copyTimer)
    window.clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = which
    copyError.value = ''
  }
  catch (err) {
    copied.value = 'error'
    copyError.value = err instanceof Error ? err.message : String(err)
  }
  copyTimer = window.setTimeout(() => {
    copied.value = ''
    copyError.value = ''
  }, 1500)
}
</script>

<template>
  <section class="demo-preview" data-testid="demo-preview">
    <!-- 预览区：可渲染时实时挂载真实组件；不可渲染时展示原因（依赖白名单外） -->
    <div class="dp-live" data-testid="demo-live">
      <div v-if="!renderable" class="dp-hint warn" data-testid="demo-unrenderable">
        ⚠ 该示例无法实时预览：{{ reason }}
      </div>
      <div v-else-if="compiling" class="dp-hint" data-testid="demo-compiling">
        编译中…
      </div>
      <div v-else-if="compileError" class="dp-hint error" data-testid="demo-error">
        预览编译失败：{{ compileError }}
      </div>
      <div v-else-if="previewComp" data-testid="demo-mounted">
        <component :is="previewComp" />
      </div>
    </div>

    <!-- 操作栏：对齐 Element Plus 官网，居中悬浮按钮控制源码折叠/复制 -->
    <div class="dp-actions" data-testid="demo-actions">
      <button
        class="dp-action"
        data-testid="toggle-code"
        :aria-expanded="showCode"
        :title="showCode ? '收起源码' : '查看源码'"
        @click="showCode = !showCode"
      >
        <span class="dp-action-icon" :class="{ open: showCode }">&lt;/&gt;</span>
        {{ showCode ? '收起源码' : '查看源码' }}
      </button>
    </div>

    <!-- 源码区：默认折叠，展开后顶部可切 TS/JS 并复制 -->
    <div v-show="showCode" class="dp-code" data-testid="demo-code">
      <div class="dp-code-head">
        <div class="dp-tabs" role="tablist">
          <button
            class="dp-tab"
            :class="{ active: lang === 'ts' }"
            data-testid="tab-ts"
            role="tab"
            :aria-selected="lang === 'ts'"
            @click="lang = 'ts'"
          >
            TS
          </button>
          <button
            v-if="hasJs"
            class="dp-tab"
            :class="{ active: lang === 'js' }"
            data-testid="tab-js"
            role="tab"
            :aria-selected="lang === 'js'"
            @click="lang = 'js'"
          >
            JS
          </button>
        </div>
        <button
          class="dp-copy"
          :class="{ error: copied === 'error' }"
          data-testid="copy-current"
          @click="copy(lang)"
        >
          <template v-if="copied === lang">已复制</template>
          <template v-else-if="copied === 'error'">复制失败</template>
          <template v-else>复制源码</template>
        </button>
      </div>
      <p v-if="copyError" class="dp-copy-error" data-testid="copy-error">
        复制失败：{{ copyError }}
      </p>
      <pre data-testid="code-block"><code>{{ currentCode }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.demo-preview { margin-bottom: 16px; border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden; }
.dp-tabs { display: flex; gap: 4px; }
.dp-tab {
  padding: 4px 12px; border: 1px solid #30363d; border-radius: 6px;
  background: #21262d; cursor: pointer; font-size: 12px; color: #8b949e;
}
.dp-tab.active { background: #238636; color: #fff; border-color: #238636; }
.dp-live { padding: 22px 16px; background: #fff; min-height: 48px; }
.dp-hint { color: #57606a; font-size: 13px; }
.dp-hint.error { color: #cf222e; white-space: pre-wrap; }
.dp-hint.warn { color: #9a6700; white-space: pre-wrap; }
/* 操作栏：居中分隔条，对齐 Element Plus 官网 demo-block */
.dp-actions {
  display: flex; align-items: center; justify-content: center;
  padding: 6px; background: #f6f8fa; border-top: 1px dashed #d0d7de;
}
.dp-action {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 14px; border: none; border-radius: 6px;
  background: transparent; color: #57606a; cursor: pointer; font-size: 13px;
}
.dp-action:hover { color: #238636; background: #eaeef2; }
.dp-action-icon { font-family: monospace; font-size: 12px; transition: transform .2s; }
.dp-action-icon.open { transform: rotate(0); color: #238636; }
.dp-code-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 14px; background: #161b22;
}
.dp-copy {
  padding: 2px 10px; border: 1px solid #30363d; border-radius: 5px;
  background: #21262d; color: #c9d1d9; cursor: pointer; font-size: 12px;
}
.dp-copy.error { border-color: #cf222e; color: #ff7b72; }
.dp-copy-error {
  margin: 0; padding: 6px 14px; background: #2d1416;
  color: #ff7b72; font-size: 12px; white-space: pre-wrap;
}
.dp-code pre {
  background: #0d1117; color: #c9d1d9; padding: 14px;
  border-radius: 0; overflow-x: auto; margin: 0;
}
</style>
