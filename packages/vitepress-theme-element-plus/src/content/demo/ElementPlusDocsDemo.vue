<script setup lang="ts">
import { Box, Check, ChevronUp, Code2, Copy, ExternalLink, GitBranch, SquareTerminal, Zap } from '@lucide/vue'
import { ElSegmented } from 'element-plus'
import type { Component } from 'vue'
import {
  computed,
  nextTick,
  onErrorCaptured,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useId,
} from 'vue'
import type { ElementPlusDocsDemoProps, ElementPlusDocsDemoSourceLanguage } from './types'
import ElementPlusDocsDemoSource from './ElementPlusDocsDemoSource.vue'

const props = defineProps<ElementPlusDocsDemoProps>()

const isExpanded = ref(false)
const isCopied = ref(false)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const demoComponent = shallowRef<Component | null>(null)
const isLoading = ref(true)
const sourceToggle = ref<HTMLButtonElement | null>(null)
const sourceId = `demo-source-${useId()}`
const sourceLanguages: ElementPlusDocsDemoSourceLanguage[] = ['TS', 'JS']
const sourceLanguage = ref<ElementPlusDocsDemoSourceLanguage>('TS')
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

const sourceCode = computed(() => decode(props.code))
const javaScriptSourceCode = computed(() => props.jsCode ? decode(props.jsCode) : sourceCode.value)
const hasJavaScriptSource = computed(() => Boolean(props.jsCode && props.jsHighlighted))
const selectedSourceLanguage = computed(() => (
  sourceLanguage.value === 'JS' && hasJavaScriptSource.value ? 'JS' : 'TS'
))
const displayedSourceCode = computed(() => (
  selectedSourceLanguage.value === 'JS' ? javaScriptSourceCode.value : sourceCode.value
))
const highlightedHtml = computed(() => (
  selectedSourceLanguage.value === 'JS' && props.jsHighlighted
    ? decode(props.jsHighlighted)
    : decode(props.highlighted)
))

function formatError(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

async function initDemo(): Promise<void> {
  const sequence = ++runId
  if (typeof window === 'undefined') {
    isLoading.value = false
    return
  }

  disposeStyles?.()
  disposeStyles = null
  demoComponent.value = null
  error.value = null
  isLoading.value = true

  try {
    const result = await props.compile(sourceCode.value, {
      id: props.demoId,
      onError: (compileError) => {
        if (sequence === runId)
          error.value = formatError(compileError)
      },
    })
    if (sequence !== runId) {
      result.dispose()
      return
    }
    disposeStyles = result.dispose
    demoComponent.value = result.component
  }
  catch (compileError) {
    if (sequence === runId)
      error.value = formatError(compileError)
  }
  finally {
    if (sequence === runId)
      isLoading.value = false
  }
}

onErrorCaptured((runtimeError) => {
  error.value = formatError(runtimeError)
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

async function handleOpenPlayground(
  open: ElementPlusDocsDemoProps['openPlayground'],
): Promise<void> {
  if (!open)
    return
  try {
    actionError.value = null
    await open(displayedSourceCode.value, props.demoId)
  }
  catch (sessionError) {
    actionError.value = formatError(sessionError)
  }
}

async function copyCode(): Promise<void> {
  try {
    if (props.copy)
      await props.copy(displayedSourceCode.value)
    else
      await navigator.clipboard.writeText(displayedSourceCode.value)
  }
  catch (copyError) {
    actionError.value = formatError(copyError)
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

async function collapseSource(): Promise<void> {
  isExpanded.value = false
  await nextTick()
  sourceToggle.value?.focus()
}
</script>

<template>
  <ClientOnly>
    <div class="demo-block">
      <div class="demo-preview">
        <component :is="demoComponent" v-if="demoComponent && !error" />
        <div v-if="error" class="demo-error" role="alert">
          <strong>{{ messages.compileError }}</strong><br>{{ error }}
        </div>
        <div v-if="isLoading && !error" class="demo-loading" role="status">
          <span>{{ messages.loading }}</span>
        </div>
      </div>

      <div v-if="title" class="demo-description">
        {{ title }}
      </div>

      <div class="demo-footer">
        <ElSegmented
          v-if="hasJavaScriptSource"
          v-model="sourceLanguage"
          class="demo-source-languages"
          data-testid="demo-source-language"
          :aria-label="messages.sourceLanguage"
          :options="sourceLanguages"
          size="small"
        />
        <div class="demo-actions" role="group" :aria-label="messages.actions">
          <button
            v-if="openCodeSandbox"
            class="demo-action-btn"
            type="button"
            :title="messages.openCodeSandbox"
            :aria-label="messages.openCodeSandbox"
            data-testid="demo-codesandbox"
            @click="handleOpenPlayground(openCodeSandbox)"
          >
            <Box :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="openStackBlitz"
            class="demo-action-btn"
            type="button"
            :title="messages.openStackBlitz"
            :aria-label="messages.openStackBlitz"
            data-testid="demo-stackblitz"
            @click="handleOpenPlayground(openStackBlitz)"
          >
            <Zap :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="openElementPlusPlayground"
            class="demo-action-btn"
            type="button"
            :title="messages.openElementPlusPlayground"
            :aria-label="messages.openElementPlusPlayground"
            data-testid="demo-element-plus-playground"
            @click="handleOpenPlayground(openElementPlusPlayground)"
          >
            <ExternalLink :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="openPlayground"
            class="demo-action-btn"
            type="button"
            :title="messages.openPlayground"
            :aria-label="messages.openPlayground"
            data-testid="demo-lightweight-playground"
            @click="handleOpenPlayground(openPlayground)"
          >
            <SquareTerminal :size="16" aria-hidden="true" />
          </button>
          <a
            v-if="sourceHref"
            class="demo-action-btn"
            data-testid="demo-source-link"
            :href="sourceHref"
            target="_blank"
            rel="noreferrer noopener"
            :title="messages.viewSource"
            :aria-label="messages.viewSource"
          >
            <GitBranch :size="16" aria-hidden="true" />
          </a>
          <button
            class="demo-action-btn"
            type="button"
            :title="isCopied ? messages.copied : messages.copyCode"
            :aria-label="isCopied ? messages.codeCopied : messages.copyCode"
            @click="copyCode"
          >
            <Copy v-if="!isCopied" :size="16" aria-hidden="true" />
            <Check v-else :size="16" aria-hidden="true" />
          </button>
          <button
            ref="sourceToggle"
            class="demo-action-btn"
            type="button"
            :title="isExpanded ? messages.collapseCode : messages.expandCode"
            :aria-label="isExpanded ? messages.collapseExampleCode : messages.expandExampleCode"
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
        {{ messages.playgroundUnavailable }}: {{ actionError }}
      </div>

      <Transition name="demo-expand">
        <div
          v-show="isExpanded"
          :id="sourceId"
          class="demo-source"
          :aria-hidden="!isExpanded"
        >
          <ElementPlusDocsDemoSource
            :source="highlightedHtml"
            :fold-code-region="messages.foldCodeRegion"
            :folded-line="messages.foldedLine"
            :folded-lines="messages.foldedLines"
            :unfold-code-region="messages.unfoldCodeRegion"
          />
          <button
            class="demo-collapse-control"
            data-testid="demo-source-collapse"
            type="button"
            @click="collapseSource"
          >
            <ChevronUp :size="16" aria-hidden="true" />
            <span>{{ messages.collapseCode }}</span>
          </button>
        </div>
      </Transition>
    </div>
  </ClientOnly>
</template>

<style scoped>
.demo-block {
  overflow: hidden;
  border: 1px solid var(--mx-border, var(--border-color));
  border-radius: 6px;
  background: var(--bg-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.demo-block:hover {
  border-color: color-mix(in srgb, var(--brand-color) 45%, var(--mx-border, var(--border-color)));
  box-shadow: 0 2px 8px rgba(31, 35, 41, 0.05);
}

.demo-preview {
  min-height: 72px;
  padding: 28px 24px;
  overflow-x: auto;
  background: var(--bg-color);
}

.demo-description {
  padding: 12px 16px;
  border-top: 1px dashed var(--mx-border, var(--border-color));
  background: var(--mx-fill-light, var(--bg-color-soft));
  color: var(--text-color-light);
  font-size: 13px;
  line-height: 1.65;
}

.demo-footer {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  border-top: 1px solid var(--mx-border-light, var(--border-color-lighter));
  background: var(--mx-fill-light, var(--bg-color-soft));
}

.demo-source-languages {
  flex: none;
}

.demo-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.demo-action-btn {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color-light);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.demo-action-btn:hover,
.demo-action-btn:focus-visible {
  background: var(--mx-hover, var(--el-color-primary-light-9));
  color: var(--brand-color);
  outline: none;
}

.demo-source {
  border-top: 1px solid var(--mx-border-light, var(--border-color-lighter));
  background: var(--mx-fill, var(--bg-color-soft));
}

.demo-collapse-control {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border: 0;
  border-top: 1px solid var(--mx-border-light, var(--border-color-lighter));
  background: var(--bg-color);
  color: var(--text-color-light);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition: color 0.15s, background-color 0.15s;
}

.demo-collapse-control:hover,
.demo-collapse-control:focus-visible {
  background: var(--mx-hover, var(--el-color-primary-light-9));
  color: var(--brand-color);
  outline: none;
}

.demo-error {
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--mx-danger, #f56c6c) 45%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--mx-danger, #f56c6c) 8%, transparent);
  color: var(--mx-danger, #f56c6c);
  font-family: var(--font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.demo-loading {
  padding: 20px 0;
  color: var(--text-color-lighter);
  font-size: 13px;
  text-align: center;
}

.demo-action-error {
  padding: 8px 12px;
  border-top: 1px solid color-mix(in srgb, var(--mx-danger, #f56c6c) 35%, transparent);
  background: color-mix(in srgb, var(--mx-danger, #f56c6c) 7%, transparent);
  color: var(--mx-danger, #f56c6c);
  font-size: 12px;
}

.demo-expand-enter-active,
.demo-expand-leave-active {
  overflow: hidden;
  transition: opacity 0.2s;
}

.demo-expand-enter-from,
.demo-expand-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .demo-preview {
    padding: 20px 16px;
  }

  .demo-footer {
    flex-wrap: wrap;
    gap: 6px;
    padding-inline: 8px;
  }

  .demo-actions {
    max-width: 100%;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
</style>
