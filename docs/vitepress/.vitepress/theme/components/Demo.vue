<script setup lang="ts">
import { Check, ChevronUp, Code2, Copy } from '@lucide/vue'
import * as Components from '@docs-components'
import * as ElementPlusRuntime from 'element-plus'
import type { Component } from 'vue'
import * as VueRuntime from 'vue'
import { onMounted, onUnmounted, ref, shallowRef, useId } from 'vue'
import { docsSite } from '../../docs-site'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  code: string       // base64(utf-8) 编码的 SFC 源码
  highlighted: string // base64(utf-8) 编码的高亮 HTML
  title?: string
}>()

const { messages } = useDocsLocale()

const isExpanded = ref(false)
const isCopied = ref(false)
const error = ref<string | null>(null)
const DemoComp = shallowRef<Component | null>(null)
const isLoading = ref(true)
const disposeStyles = ref<(() => void) | null>(null)
const sourceId = `demo-source-${useId()}`

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
  if (typeof window === 'undefined') {
    isLoading.value = false
    return
  }
  try {
    const { loadModule } = await import('vue3-sfc-loader/dist/vue3-sfc-loader.esm.js')

    const styleEls: HTMLStyleElement[] = []

    const component = await loadModule('/demo.vue', {
      moduleCache: {
        vue: VueRuntime,
        'element-plus': ElementPlusRuntime,
        'element-plus/dist/index.css': {},
        [docsSite.packageName]: Components,
        [docsSite.packageStylesImport]: {},
      },
      getFile: async () => ({
        getContentData: () => sourceCode,
        type: '.vue' as const,
      }),
      addStyle: (css: string) => {
        const el = document.createElement('style')
        el.textContent = css
        document.head.appendChild(el)
        styleEls.push(el)
      },
      log: (type: string, ...args: unknown[]) => {
        if (type === 'error')
          error.value = args.join(' ')
      },
    }) as Component

    DemoComp.value = component
    disposeStyles.value = () => {
      styleEls.splice(0).forEach(el => el.remove())
    }
  }
  catch (e) {
    error.value = String(e)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(initDemo)

onUnmounted(() => {
  disposeStyles.value?.()
})

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(sourceCode)
  }
  catch {
    const textarea = document.createElement('textarea')
    textarea.value = sourceCode
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  isCopied.value = true
  setTimeout(() => {
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
