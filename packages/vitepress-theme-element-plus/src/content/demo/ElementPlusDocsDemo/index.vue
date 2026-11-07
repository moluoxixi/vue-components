<script setup lang="ts">
import type { Component } from 'vue'
import type { ElementPlusDocsExternalProjectSource } from '../../playground/external/vue-project'
import type {
  ElementPlusDocsPlaygroundAction,
  ElementPlusDocsPlaygroundActionContext,
  ElementPlusDocsPlaygroundKind,
} from '../../playground/types'
import type { ElementPlusDocsDemoProps, ElementPlusDocsDemoSourceLanguage } from '../types'
import { Box, Check, ChevronUp, Code2, Copy, ExternalLink, GitBranch, SquareTerminal, Zap } from '@lucide/vue'
import { ElSegmented } from 'element-plus'
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
import ElementPlusDocsConsumerBoundary from '../../../runtime/ElementPlusDocsConsumerBoundary.vue'
import { provideDocsUi } from '../../../runtime/provide-docs-ui'
import { indexElementPlusDocsPlaygroundActions } from '../../playground/registry'
import ElementPlusDocsDemoSource from './components/ElementPlusDocsDemoSource.vue'

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
const externalProjectSource = computed(() => (
  selectedSourceLanguage.value === 'JS'
    ? decodeExternalProjectSource(props.externalProjectJsCode)
    : decodeExternalProjectSource(props.externalProjectCode)
))
const highlightedHtml = computed(() => (
  selectedSourceLanguage.value === 'JS' && props.jsHighlighted
    ? decode(props.jsHighlighted)
    : decode(props.highlighted)
))
const playgroundActions = computed<readonly ElementPlusDocsPlaygroundAction[]>(() => {
  if (props.playgroundActions !== undefined)
    return props.playgroundActions

  const actions: ElementPlusDocsPlaygroundAction[] = []
  if (props.openCodeSandbox) {
    actions.push({
      kind: 'codesandbox',
      open: ({ demoId, projectSource, source }) => projectSource
        ? props.openCodeSandbox!(source, demoId, projectSource)
        : props.openCodeSandbox!(source, demoId),
    })
  }
  if (props.openStackBlitz) {
    actions.push({
      kind: 'stackblitz',
      open: ({ demoId, projectSource, source }) => projectSource
        ? props.openStackBlitz!(source, demoId, projectSource)
        : props.openStackBlitz!(source, demoId),
    })
  }
  if (props.openElementPlusPlayground) {
    actions.push({
      kind: 'element-plus',
      open: ({ demoId, source }) => props.openElementPlusPlayground!(source, demoId),
    })
  }
  if (props.openPlayground) {
    actions.push({
      kind: 'lightweight',
      open: ({ demoId, source }) => props.openPlayground!(source, demoId),
    })
  }
  return actions
})
const playgroundActionByKind = computed(() => indexElementPlusDocsPlaygroundActions(playgroundActions.value))

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

async function handleOpenPlayground(kind: ElementPlusDocsPlaygroundKind): Promise<void> {
  const action = playgroundActionByKind.value.get(kind)
  if (!action)
    return
  try {
    actionError.value = null
    const context: ElementPlusDocsPlaygroundActionContext = {
      demoId: props.demoId,
      source: displayedSourceCode.value,
    }
    const projectSource = externalProjectSource.value
    if (projectSource)
      context.projectSource = projectSource
    await action.open(context)
  }
  catch (sessionError) {
    actionError.value = formatError(sessionError)
  }
}

function decodeExternalProjectSource(encoded: string | undefined): ElementPlusDocsExternalProjectSource | undefined {
  if (!encoded)
    return undefined
  return JSON.parse(decode(encoded)) as ElementPlusDocsExternalProjectSource
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
provideDocsUi()
</script>

<template>
  <ClientOnly>
    <div class="demo-block">
      <div class="demo-preview vp-raw">
        <ElementPlusDocsConsumerBoundary v-if="demoComponent && !error">
          <component :is="demoComponent" />
        </ElementPlusDocsConsumerBoundary>
      </div>
      <div v-if="error" data-docs-ui class="demo-error" role="alert">
        <strong>{{ props.messages.compileError }}</strong><br>{{ error }}
      </div>
      <div v-if="isLoading && !error" data-docs-ui class="demo-loading" role="status">
        <span>{{ props.messages.loading }}</span>
      </div>

      <div v-if="props.title" class="demo-description" data-docs-ui>
        {{ props.title }}
      </div>

      <div class="demo-footer" data-docs-ui>
        <ElSegmented
          v-if="hasJavaScriptSource"
          v-model="sourceLanguage"
          class="demo-source-languages"
          data-testid="demo-source-language"
          :aria-label="props.messages.sourceLanguage"
          :options="sourceLanguages"
          size="small"
        />
        <div class="demo-actions" role="group" :aria-label="props.messages.actions">
          <button
            v-if="playgroundActionByKind.has('codesandbox')"
            class="demo-action-btn"
            type="button"
            :title="props.messages.openCodeSandbox"
            :aria-label="props.messages.openCodeSandbox"
            data-testid="demo-codesandbox"
            @click="handleOpenPlayground('codesandbox')"
          >
            <Box :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="playgroundActionByKind.has('stackblitz')"
            class="demo-action-btn"
            type="button"
            :title="props.messages.openStackBlitz"
            :aria-label="props.messages.openStackBlitz"
            data-testid="demo-stackblitz"
            @click="handleOpenPlayground('stackblitz')"
          >
            <Zap :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="playgroundActionByKind.has('element-plus')"
            class="demo-action-btn"
            type="button"
            :title="props.messages.openElementPlusPlayground"
            :aria-label="props.messages.openElementPlusPlayground"
            data-testid="demo-element-plus-playground"
            @click="handleOpenPlayground('element-plus')"
          >
            <ExternalLink :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="playgroundActionByKind.has('lightweight')"
            class="demo-action-btn"
            type="button"
            :title="props.messages.openPlayground"
            :aria-label="props.messages.openPlayground"
            data-testid="demo-lightweight-playground"
            @click="handleOpenPlayground('lightweight')"
          >
            <SquareTerminal :size="16" aria-hidden="true" />
          </button>
          <a
            v-if="props.sourceHref"
            class="demo-action-btn"
            data-testid="demo-source-link"
            :href="props.sourceHref"
            target="_blank"
            rel="noreferrer noopener"
            :title="props.messages.viewSource"
            :aria-label="props.messages.viewSource"
          >
            <GitBranch :size="16" aria-hidden="true" />
          </a>
          <button
            class="demo-action-btn"
            type="button"
            :title="isCopied ? props.messages.copied : props.messages.copyCode"
            :aria-label="isCopied ? props.messages.codeCopied : props.messages.copyCode"
            @click="copyCode"
          >
            <Copy v-if="!isCopied" :size="16" aria-hidden="true" />
            <Check v-else :size="16" aria-hidden="true" />
          </button>
          <button
            ref="sourceToggle"
            class="demo-action-btn"
            type="button"
            :title="isExpanded ? props.messages.collapseCode : props.messages.expandCode"
            :aria-label="isExpanded ? props.messages.collapseExampleCode : props.messages.expandExampleCode"
            :aria-expanded="isExpanded"
            :aria-controls="sourceId"
            @click="isExpanded = !isExpanded"
          >
            <Code2 v-if="!isExpanded" :size="17" aria-hidden="true" />
            <ChevronUp v-else :size="17" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="actionError" class="demo-action-error" data-docs-ui role="alert">
        {{ props.messages.playgroundUnavailable }}: {{ actionError }}
      </div>

      <Transition name="demo-expand">
        <div
          v-show="isExpanded"
          :id="sourceId"
          class="demo-source" data-docs-ui
          :aria-hidden="!isExpanded"
        >
          <ElementPlusDocsDemoSource
            :source="highlightedHtml"
            :fold-code-region="props.messages.foldCodeRegion"
            :folded-line="props.messages.foldedLine"
            :folded-lines="props.messages.foldedLines"
            :unfold-code-region="props.messages.unfoldCodeRegion"
          />
          <button
            class="demo-collapse-control" data-docs-ui
            data-testid="demo-source-collapse"
            type="button"
            @click="collapseSource"
          >
            <ChevronUp :size="16" aria-hidden="true" />
            <span>{{ props.messages.collapseCode }}</span>
          </button>
        </div>
      </Transition>
    </div>
  </ClientOnly>
</template>

<style scoped>
.demo-block {
  margin: 20px 0 28px;
}

.demo-block {
  overflow: hidden;
  border: 1px solid var(--ep-docs-mx-border, var(--ep-docs-border-color));
  border-radius: 6px;
  background: var(--ep-docs-bg-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.demo-block:hover {
  border-color: color-mix(in srgb, var(--ep-docs-brand-color) 45%, var(--ep-docs-mx-border, var(--ep-docs-border-color)));
  box-shadow: 0 2px 8px rgba(31, 35, 41, 0.05);
}

.demo-preview {
  min-height: 72px;
  padding: 28px 24px;
  overflow-x: auto;
  /* Match the consumer document's native canvas, including its color scheme. */
  background: Canvas;
}

.demo-description {
  padding: 12px 16px;
  border-top: 1px dashed var(--ep-docs-mx-border, var(--ep-docs-border-color));
  background: var(--ep-docs-mx-fill-light, var(--ep-docs-bg-color-soft));
  color: var(--ep-docs-text-color-light);
  font-size: 13px;
  line-height: 1.65;
}

.demo-footer {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  border-top: 1px solid var(--ep-docs-mx-border-light, var(--ep-docs-border-color-lighter));
  background: var(--ep-docs-mx-fill-light, var(--ep-docs-bg-color-soft));
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
  color: var(--ep-docs-text-color-light);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.demo-action-btn:hover,
.demo-action-btn:focus-visible {
  background: var(--ep-docs-mx-hover, var(--epd-color-primary-light-9));
  color: var(--ep-docs-brand-color);
  outline: none;
}

.demo-source {
  border-top: 1px solid var(--ep-docs-mx-border-light, var(--ep-docs-border-color-lighter));
  background: var(--ep-docs-mx-fill, var(--ep-docs-bg-color-soft));
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
  border-top: 1px solid var(--ep-docs-mx-border-light, var(--ep-docs-border-color-lighter));
  background: var(--ep-docs-bg-color);
  color: var(--ep-docs-text-color-light);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition: color 0.15s, background-color 0.15s;
}

.demo-collapse-control:hover,
.demo-collapse-control:focus-visible {
  background: var(--ep-docs-mx-hover, var(--epd-color-primary-light-9));
  color: var(--ep-docs-brand-color);
  outline: none;
}

.demo-error {
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--ep-docs-mx-danger, #f56c6c) 45%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ep-docs-mx-danger, #f56c6c) 8%, transparent);
  color: var(--ep-docs-mx-danger, #f56c6c);
  font-family: var(--ep-docs-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.demo-loading {
  padding: 20px 0;
  color: var(--ep-docs-text-color-lighter);
  font-size: 13px;
  text-align: center;
}

.demo-action-error {
  padding: 8px 12px;
  border-top: 1px solid color-mix(in srgb, var(--ep-docs-mx-danger, #f56c6c) 35%, transparent);
  background: color-mix(in srgb, var(--ep-docs-mx-danger, #f56c6c) 7%, transparent);
  color: var(--ep-docs-mx-danger, #f56c6c);
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
