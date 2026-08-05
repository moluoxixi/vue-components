<script setup lang="ts">
import { Check, ChevronUp, Code2, Copy, ExternalLink } from '@lucide/vue'
import type { Component } from 'vue'
import { onErrorCaptured, onMounted, onUnmounted, ref, shallowRef, useId } from 'vue'
import { docsRoutePath } from '../../docs-site'
import { createPlaygroundSession, playgroundSessionQuery } from '../playground-session'
import { compileLocalSfc } from '../sfc-compiler'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  demoId: string
  code: string       // base64(utf-8) 编码的 SFC 源码
  highlighted: string // base64(utf-8) 编码的高亮 HTML
  title?: string
}>()

const { link, messages } = useDocsLocale()

const isExpanded = ref(false)
const isCopied = ref(false)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const DemoComp = shallowRef<Component | null>(null)
const isLoading = ref(true)
const sourceId = `demo-source-${useId()}`
let disposeStyles: (() => void) | null = null
let runId = 0
let copyTimer = 0

function decode(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)))
  }
  catch {
    return encoded
  }
}

const sourceCode = decode(props.code)
const highlightedHtml = decode(props.highlighted)

async function initDemo(): Promise<void> {
  const seq = ++runId
  if (typeof window === 'undefined') {
    isLoading.value = false
    return
  }
  disposeStyles?.()
  disposeStyles = null
  DemoComp.value = null
  error.value = null
  isLoading.value = true
  try {
    const result = await compileLocalSfc(sourceCode, {
      id: props.demoId,
      onError: (compileError) => {
        if (seq === runId)
          error.value = compileError instanceof Error ? compileError.message : String(compileError)
      },
    })
    if (seq !== runId) {
      result.dispose()
      return
    }
    disposeStyles = result.dispose
    DemoComp.value = result.component
  }
  catch (compileError) {
    if (seq === runId)
      error.value = compileError instanceof Error ? compileError.message : String(compileError)
  }
  finally {
    if (seq === runId)
      isLoading.value = false
  }
}

onErrorCaptured((runtimeError) => {
  error.value = runtimeError instanceof Error ? runtimeError.message : String(runtimeError)
  return false
})

onMounted(() => {
  void initDemo()
})

onUnmounted(() => {
  runId += 1
  disposeStyles?.()
  disposeStyles = null
  if (copyTimer)
    window.clearTimeout(copyTimer)
})

function openPlayground(): void {
  try {
    actionError.value = null
    const token = createPlaygroundSession(sourceCode, props.demoId)
    const query = new URLSearchParams({ [playgroundSessionQuery]: token })
    window.location.assign(`${link(docsRoutePath('playground'))}?${query.toString()}`)
  }
  catch (sessionError) {
    actionError.value = sessionError instanceof Error ? sessionError.message : String(sessionError)
  }
}

async function copyCode(): Promise<void> {
  try {
    await copyText(sourceCode)
  }
  catch (copyError) {
    actionError.value = copyError instanceof Error ? copyError.message : String(copyError)
    return
  }
  actionError.value = null
  isCopied.value = true
  if (copyTimer)
    window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => {
    isCopied.value = false
  }, 2000)
}
</script>

<template>
  <ClientOnly>
    <div class="demo-block">
      <!-- 预览区 -->
      <div class="demo-preview">
        <component :is="DemoComp" v-if="DemoComp && !error" />
        <div v-if="error" class="demo-error" role="alert">
          <strong>{{ messages.demo.compileError }}</strong><br>{{ error }}
        </div>
        <div v-if="isLoading && !error" class="demo-loading" role="status">
          <span>{{ messages.demo.loading }}</span>
        </div>
      </div>

      <!-- 描述 -->
      <div v-if="title" class="demo-description">
        {{ title }}
      </div>

      <!-- 操作栏 -->
      <div class="demo-footer">
        <div class="demo-actions" :aria-label="messages.demo.actions">
          <button
            class="demo-action-btn"
            :title="messages.demo.openPlayground"
            :aria-label="messages.demo.openPlayground"
            @click="openPlayground"
          >
            <ExternalLink :size="16" aria-hidden="true" />
          </button>
          <button
            class="demo-action-btn"
            :title="isCopied ? messages.demo.copied : messages.demo.copyCode"
            :aria-label="isCopied ? messages.demo.codeCopied : messages.demo.copyCode"
            @click="copyCode"
          >
            <Copy v-if="!isCopied" :size="16" aria-hidden="true" />
            <Check v-else :size="16" aria-hidden="true" />
          </button>
          <button
            class="demo-action-btn"
            :title="isExpanded ? messages.demo.collapseCode : messages.demo.expandCode"
            :aria-label="isExpanded ? messages.demo.collapseExampleCode : messages.demo.expandExampleCode"
            :aria-expanded="isExpanded"
            :aria-controls="sourceId"
            @click="isExpanded = !isExpanded"
          >
            <Code2 v-if="!isExpanded" :size="17" aria-hidden="true" />
            <ChevronUp v-else :size="17" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="actionError" class="demo-action-error" role="alert">
        {{ messages.demo.playgroundUnavailable }}: {{ actionError }}
      </div>

      <!-- 源码展示 -->
      <Transition name="demo-expand">
        <div
          v-show="isExpanded"
          :id="sourceId"
          class="demo-source"
          :aria-hidden="!isExpanded"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="highlightedHtml" />
        </div>
      </Transition>
    </div>
  </ClientOnly>
</template>

<style scoped>
.demo-expand-enter-active,
.demo-expand-leave-active {
  transition: opacity 0.2s, max-height 0.3s;
  max-height: 800px;
  overflow: hidden;
}

.demo-expand-enter-from,
.demo-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
