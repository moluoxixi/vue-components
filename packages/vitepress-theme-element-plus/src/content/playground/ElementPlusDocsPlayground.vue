<script setup lang="ts">
import { provideDocsUi } from '../../runtime/provide-docs-ui'
import { Check, Copy, Play, RotateCcw } from '@lucide/vue'
import { ElTooltip } from 'element-plus'
import type { Component } from 'vue'
import {
  nextTick,
  onErrorCaptured,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useId,
} from 'vue'
import {
  consumeElementPlusDocsPlaygroundSession,
  elementPlusDocsPlaygroundSessionQuery,
} from './session'
import type { ElementPlusDocsPlaygroundProps } from './types'
import ElementPlusDocsConsumerBoundary from '../../runtime/ElementPlusDocsConsumerBoundary.vue'

const props = withDefaults(defineProps<ElementPlusDocsPlaygroundProps>(), {
  sessionQuery: elementPlusDocsPlaygroundSessionQuery,
})

const editorId = `playground-editor-${useId()}`
const source = ref(props.starterSource)
const initialSource = ref(props.starterSource)
const demoId = ref('starter')
const previewComponent = shallowRef<Component | null>(null)
const compileError = ref('')
const isRunning = ref(false)
const isCopied = ref(false)
let activeDispose: (() => void) | null = null
let runId = 0
let copyTimer = 0

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function run(): Promise<void> {
  const sequence = ++runId
  activeDispose?.()
  activeDispose = null
  previewComponent.value = null
  compileError.value = ''
  isRunning.value = true

  await nextTick()
  try {
    const result = await props.compile(source.value, {
      id: `${demoId.value}-playground`,
      onError: (error) => {
        if (sequence === runId)
          compileError.value = formatError(error)
      },
    })
    if (sequence !== runId) {
      result.dispose()
      return
    }
    activeDispose = result.dispose
    previewComponent.value = result.component
  }
  catch (error) {
    if (sequence === runId)
      compileError.value = formatError(error)
  }
  finally {
    if (sequence === runId)
      isRunning.value = false
  }
}

function reset(): void {
  source.value = initialSource.value
  void run()
}

async function copySource(): Promise<void> {
  try {
    if (props.copy)
      await props.copy(source.value)
    else
      await navigator.clipboard.writeText(source.value)
  }
  catch (error) {
    compileError.value = formatError(error)
    return
  }

  isCopied.value = true
  if (copyTimer)
    window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

onErrorCaptured((error) => {
  compileError.value = formatError(error)
  return false
})

onMounted(() => {
  const token = new URL(window.location.href).searchParams.get(props.sessionQuery)
  let session: ReturnType<typeof consumeElementPlusDocsPlaygroundSession> = null
  try {
    session = consumeElementPlusDocsPlaygroundSession(token)
  }
  catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  if (session) {
    source.value = session.source
    initialSource.value = session.source
    demoId.value = session.demoId
  }
  void run()
})

onUnmounted(() => {
  runId += 1
  activeDispose?.()
  activeDispose = null
  if (copyTimer)
    window.clearTimeout(copyTimer)
})
provideDocsUi()
</script>

<template>
  <main class="component-playground">
    <header class="playground-header" data-docs-ui>
      <h1>{{ messages.title }}</h1>
      <div class="playground-actions">
        <!-- Keep the tooltip inline so its SSR nodes hydrate with the page. -->
        <ElTooltip
          :disabled="!isRunning"
          :teleported="false"
          :content="messages.runningHint ?? 'The example is compiling. Run is available when compilation finishes.'"
        >
          <span class="playground-run-trigger" :tabindex="isRunning ? 0 : undefined">
            <button data-testid="playground-run" type="button" :disabled="isRunning" @click="run">
              <Play :size="16" aria-hidden="true" />
              {{ isRunning ? messages.running : messages.run }}
            </button>
          </span>
        </ElTooltip>
        <button data-testid="playground-reset" type="button" @click="reset">
          <RotateCcw :size="16" aria-hidden="true" />
          {{ messages.reset }}
        </button>
        <button data-testid="playground-copy" type="button" @click="copySource">
          <Check v-if="isCopied" :size="16" aria-hidden="true" />
          <Copy v-else :size="16" aria-hidden="true" />
          {{ isCopied ? messages.copied : messages.copy }}
        </button>
      </div>
    </header>

    <div class="playground-workspace">
      <section class="playground-pane playground-editor-pane">
        <div class="playground-pane-title" data-docs-ui>
          <label :for="editorId">{{ messages.editor }}</label>
          <span>Vue SFC</span>
        </div>
        <textarea
          :id="editorId"
          v-model="source"
          data-testid="playground-editor"
          class="playground-editor" data-docs-ui
          :aria-label="messages.editorAria"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          wrap="off"
        />
      </section>

      <section class="playground-pane playground-preview-pane">
        <div class="playground-pane-title" data-docs-ui>
          <span>{{ messages.preview }}</span>
          <span>Browser</span>
        </div>
        <div class="playground-preview" aria-live="polite" data-testid="playground-preview">
          <div v-if="isRunning" data-docs-ui class="playground-status" role="status">
            {{ messages.running }}...
          </div>
          <div v-else-if="compileError" data-docs-ui class="playground-diagnostics" role="alert" data-testid="playground-diagnostics">
            <strong>{{ messages.diagnostics }}</strong>
            <pre>{{ compileError }}</pre>
          </div>
          <div v-else-if="previewComponent" class="vp-raw">
            <ElementPlusDocsConsumerBoundary>
              <component :is="previewComponent" />
            </ElementPlusDocsConsumerBoundary>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.component-playground {
  display: flex;
  width: 100%;
  min-height: calc(100vh - var(--ep-docs-vp-nav-height, 64px));
  flex-direction: column;
  background: var(--ep-docs-vp-c-bg);
}

.playground-header {
  display: flex;
  min-height: 64px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--ep-docs-mx-border);
}

.playground-header h1 {
  margin: 0;
  border: 0;
  font-size: 20px;
  line-height: 1.4;
  letter-spacing: 0;
}

.playground-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playground-actions button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--ep-docs-mx-border);
  border-radius: 4px;
  background: var(--ep-docs-vp-c-bg);
  color: var(--ep-docs-vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.playground-run-trigger button {
  border-color: var(--ep-docs-vp-c-brand-1);
  background: var(--ep-docs-vp-c-brand-1);
  color: #fff;
}

.playground-actions button:hover:not(:disabled),
.playground-actions button:focus-visible {
  border-color: var(--ep-docs-vp-c-brand-1);
  color: var(--ep-docs-vp-c-brand-1);
  outline: none;
}

.playground-run-trigger button:hover:not(:disabled),
.playground-run-trigger button:focus-visible {
  background: var(--ep-docs-vp-c-brand-2);
  color: #fff;
}

.playground-actions button:disabled {
  cursor: wait;
  opacity: 0.65;
  pointer-events: none;
}

.playground-run-trigger {
  display: inline-flex;
}

.playground-workspace {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(360px, 1fr) minmax(320px, 1fr);
}

.playground-pane {
  display: flex;
  min-width: 0;
  min-height: 520px;
  flex-direction: column;
}

.playground-editor-pane {
  border-right: 1px solid var(--ep-docs-mx-border);
}

.playground-pane-title {
  display: flex;
  min-height: 42px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--ep-docs-mx-border);
  background: var(--ep-docs-mx-fill-light);
  color: var(--ep-docs-vp-c-text-2);
  font-size: 13px;
}

.playground-pane-title > :last-child {
  color: var(--ep-docs-vp-c-text-3);
  font-family: var(--ep-docs-vp-font-family-mono);
  font-size: 11px;
}

.playground-editor {
  width: 100%;
  min-height: 0;
  flex: 1;
  resize: none;
  padding: 18px 20px;
  border: 0;
  border-radius: 0;
  outline: none;
  background: var(--ep-docs-vp-code-block-bg);
  color: var(--ep-docs-vp-code-block-color);
  font-family: var(--ep-docs-vp-font-family-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
}

.playground-editor:focus {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ep-docs-vp-c-brand-1) 55%, transparent);
}

.playground-preview {
  min-height: 0;
  flex: 1;
  padding: 28px 24px;
  overflow: auto;
  background: Canvas;
}

.playground-status {
  color: var(--ep-docs-vp-c-text-3);
  font-size: 13px;
}

.playground-diagnostics {
  padding: 14px 16px;
  border-left: 3px solid var(--ep-docs-mx-danger);
  background: color-mix(in srgb, var(--ep-docs-mx-danger) 8%, transparent);
  color: var(--ep-docs-mx-danger);
  font-size: 13px;
}

.playground-diagnostics pre {
  margin: 8px 0 0;
  overflow: auto;
  background: transparent;
  color: inherit;
  font-size: 12px;
  white-space: pre-wrap;
}

@media (max-width: 760px) {
  .playground-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px;
  }

  .playground-actions {
    width: 100%;
  }

  .playground-actions > button,
  .playground-run-trigger {
    min-width: 0;
    flex: 1;
  }

  .playground-actions button {
    width: 100%;
    padding-inline: 8px;
  }

  .playground-workspace {
    display: flex;
    flex-direction: column;
  }

  .playground-pane {
    min-height: 420px;
  }

  .playground-editor-pane {
    border-right: 0;
    border-bottom: 1px solid var(--ep-docs-mx-border);
  }

  .playground-preview-pane {
    min-height: 360px;
  }
}
</style>
