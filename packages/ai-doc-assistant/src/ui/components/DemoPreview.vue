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
import { computed, nextTick, onUnmounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
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
type CopyLang = 'ts' | 'js'

/** 复制结果提示（'ts'/'js'=对应按钮刚复制成功；'error'=复制失败）。 */
const copied = ref<CopyLang | 'selected' | 'error' | ''>('')
/** 失败发生在哪个语言按钮上；用于源码区折叠时也给出明确反馈。 */
const failedCopy = ref<CopyLang | ''>('')
/** 源码节点引用：浏览器拒绝写入剪贴板时，展开并选中源码供用户 Ctrl+C。 */
const codeRef = useTemplateRef<HTMLElement>('codeRef')
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

/** 查看指定语言源码：切到该语言并展开源码区（同语言再次点击则收起）。 */
function viewCode(which: 'ts' | 'js'): void {
  if (showCode.value && lang.value === which) {
    showCode.value = false
    return
  }
  lang.value = which
  showCode.value = true
}

/** clipboard API 不可用或被权限拒绝时，退回到用户手势内的 textarea copy。 */
function copyWithTextarea(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.append(textarea)
  window.focus()
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  try {
    if (!document.execCommand('copy'))
      throw new Error('document.execCommand("copy") returned false')
  }
  finally {
    textarea.remove()
  }
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text)
    if (!navigator.clipboard)
      copyWithTextarea(text)
  }
  catch (err) {
    try {
      copyWithTextarea(text)
    }
    catch (fallbackErr) {
      const primary = err instanceof Error ? err.message : String(err)
      const fallback = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
      throw new Error(`${primary}; fallback failed: ${fallback}`)
    }
  }
}

/** 程序化复制被浏览器拒绝时，展开对应源码并选中，让用户仍能用 Ctrl+C 拿到代码。 */
async function selectCodeForManualCopy(which: CopyLang): Promise<void> {
  lang.value = which
  showCode.value = true
  await nextTick()
  const codeEl = codeRef.value
  if (!codeEl)
    throw new Error('源码节点未挂载，无法选中代码')
  const range = document.createRange()
  range.selectNodeContents(codeEl)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** 复制当前语言源码到剪贴板；失败显式提示，不静默吞 rejection。 */
async function copy(which: CopyLang): Promise<void> {
  const text = which === 'js' && hasJs.value ? (props.js as string) : props.ts
  if (copyTimer)
    window.clearTimeout(copyTimer)
  try {
    await writeClipboard(text)
    copied.value = which
    failedCopy.value = ''
    copyError.value = ''
  }
  catch (err) {
    try {
      await selectCodeForManualCopy(which)
      copied.value = 'selected'
      const message = err instanceof Error ? err.message : String(err)
      copyError.value = `${message}；浏览器拒绝写入剪贴板，已展开并选中源码，请按 Ctrl+C。`
    }
    catch (selectErr) {
      copied.value = 'error'
      const copyMessage = err instanceof Error ? err.message : String(err)
      const selectMessage = selectErr instanceof Error ? selectErr.message : String(selectErr)
      copyError.value = `${copyMessage}；手动选中也失败：${selectMessage}`
    }
    failedCopy.value = which
  }
  copyTimer = window.setTimeout(() => {
    copied.value = ''
    failedCopy.value = ''
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

    <!-- 操作栏：右下角直接放 查看/复制 TS/JS（JS 仅在有独立 JS 源时显示），无需先展开再复制 -->
    <div class="dp-actions" data-testid="demo-actions">
      <button
        class="dp-action"
        data-testid="view-ts"
        :class="{ active: showCode && lang === 'ts' }"
        :aria-expanded="showCode && lang === 'ts'"
        title="查看 TS 源码"
        @click="viewCode('ts')"
      >
        {{ showCode && lang === 'ts' ? '收起 TS' : '查看 TS' }}
      </button>
      <button
        class="dp-action"
        data-testid="copy-ts"
        :class="{ error: copied === 'error' }"
        title="复制 TS 源码"
        @click="copy('ts')"
      >
        {{ copied === 'ts' ? '已复制' : copied === 'selected' && failedCopy === 'ts' ? '已选中' : copied === 'error' && failedCopy === 'ts' ? '复制失败' : '复制 TS' }}
      </button>
      <button
        v-if="hasJs"
        class="dp-action"
        data-testid="view-js"
        :class="{ active: showCode && lang === 'js' }"
        :aria-expanded="showCode && lang === 'js'"
        title="查看 JS 源码"
        @click="viewCode('js')"
      >
        {{ showCode && lang === 'js' ? '收起 JS' : '查看 JS' }}
      </button>
      <button
        v-if="hasJs"
        class="dp-action"
        data-testid="copy-js"
        :class="{ error: copied === 'error' }"
        title="复制 JS 源码"
        @click="copy('js')"
      >
        {{ copied === 'js' ? '已复制' : copied === 'selected' && failedCopy === 'js' ? '已选中' : copied === 'error' && failedCopy === 'js' ? '复制失败' : '复制 JS' }}
      </button>
    </div>
    <p v-if="copyError" class="dp-copy-error" data-testid="copy-error">
      复制失败：{{ copyError }}
    </p>

    <!-- 源码区：默认折叠，由操作栏「查看 TS/JS」展开并指定语言 -->
    <div v-show="showCode" class="dp-code" data-testid="demo-code">
      <div class="dp-code-head">
        <span class="dp-code-lang" data-testid="code-lang">{{ lang === 'js' ? 'JavaScript' : 'TypeScript' }}</span>
        <button
          class="dp-copy"
          :class="{ error: copied === 'error' }"
          data-testid="copy-current"
          @click="copy(lang)"
        >
          <template v-if="copied === lang">已复制</template>
          <template v-else-if="copied === 'selected' && failedCopy === lang">已选中</template>
          <template v-else-if="copied === 'error'">复制失败</template>
          <template v-else>复制源码</template>
        </button>
      </div>
      <pre data-testid="code-block"><code ref="codeRef">{{ currentCode }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.demo-preview { margin-bottom: 16px; border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden; }
.dp-live { padding: 22px 16px; background: #fff; min-height: 48px; }
.dp-hint { color: #57606a; font-size: 13px; }
.dp-hint.error { color: #cf222e; white-space: pre-wrap; }
.dp-hint.warn { color: #9a6700; white-space: pre-wrap; }
/* 操作栏：右下角直接放 查看/复制 TS/JS 按钮（对齐用户诉求：无需展开后再复制） */
.dp-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 4px;
  padding: 6px 10px; background: #f6f8fa; border-top: 1px dashed #d0d7de;
}
.dp-action {
  display: inline-flex; align-items: center;
  padding: 4px 12px; border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: #57606a; cursor: pointer; font-size: 13px;
}
.dp-action:hover { color: #238636; background: #eaeef2; }
.dp-action.active { color: #238636; background: #eaeef2; border-color: #d0d7de; }
.dp-action.error { color: #cf222e; }
.dp-code-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 14px; background: #161b22;
}
.dp-code-lang { color: #8b949e; font-size: 12px; font-family: monospace; }
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
