<script setup lang="ts">
import { Check, Copy, Play, RotateCcw } from '@lucide/vue'
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
  consumePlaygroundSession,
  playgroundSessionQuery,
} from '../playground-session'
import { compileLocalSfc } from '../sfc-compiler'
import { useDocsLocale } from '../use-docs-locale'

const starterSource = `<script setup lang="ts">
import { ref } from 'vue'
import { CopyText } from '@moluoxixi/components'

const text = ref('Hello, MX Components!')
<\/script>

<template>
  <div class="playground-example">
    <input v-model="text" aria-label="Text to copy">
    <CopyText :text="text" />
  </div>
</template>

<style scoped>
.playground-example {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

input {
  width: 240px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
</style>
`

const { messages } = useDocsLocale()
const editorId = `playground-editor-${useId()}`
const source = ref(starterSource)
const initialSource = ref(starterSource)
const demoId = ref('starter')
const previewComponent = shallowRef<Component | null>(null)
const compileError = ref('')
const isRunning = ref(false)
let activeDispose: (() => void) | null = null
let runId = 0

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function run(): Promise<void> {
  const seq = ++runId
  activeDispose?.()
  activeDispose = null
  previewComponent.value = null
  compileError.value = ''
  isRunning.value = true

  await nextTick()
  try {
    const result = await compileLocalSfc(source.value, {
      id: `${demoId.value}-playground`,
      onError: (error) => {
        if (seq === runId)
          compileError.value = formatError(error)
      },
    })
    if (seq !== runId) {
      result.dispose()
      return
    }
    activeDispose = result.dispose
    previewComponent.value = result.component
  }
  catch (error) {
    if (seq === runId)
      compileError.value = formatError(error)
  }
  finally {
    if (seq === runId)
      isRunning.value = false
  }
}

function reset(): void {
  source.value = initialSource.value
  void run()
}

onErrorCaptured((error) => {
  compileError.value = formatError(error)
  return false
})

onMounted(() => {
  const token = new URL(window.location.href).searchParams.get(playgroundSessionQuery)
  let session: ReturnType<typeof consumePlaygroundSession> = null
  try {
    session = consumePlaygroundSession(token)
  }
  catch {
    // Storage may be unavailable in privacy-restricted contexts; the starter remains usable.
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
})
</script>

<template>
  <main class="component-playground">
    <header class="playground-header">
      <h1>{{ messages.playground.title }}</h1>
      <div class="playground-actions">
        <button data-testid="playground-run" type="button" :disabled="isRunning" @click="run">
          <Play :size="16" aria-hidden="true" />
          {{ isRunning ? messages.playground.running : messages.playground.run }}
        </button>
        <button data-testid="playground-reset" type="button" @click="reset">
          <RotateCcw :size="16" aria-hidden="true" />
          {{ messages.playground.reset }}
        </button>
        <HeadlessCopyText :text="source">
          <template #default="{ copied, copying, copy }">
            <button
              data-testid="playground-copy"
              type="button"
              :disabled="copying"
              @click="copy().catch(() => undefined)"
            >
              <Check v-if="copied" :size="16" aria-hidden="true" />
              <Copy v-else :size="16" aria-hidden="true" />
              {{ copied ? messages.playground.copied : messages.playground.copy }}
            </button>
          </template>
        </HeadlessCopyText>
      </div>
    </header>

    <div class="playground-workspace">
      <section class="playground-pane playground-editor-pane">
        <div class="playground-pane-title">
          <label :for="editorId">{{ messages.playground.editor }}</label>
          <span>Vue SFC</span>
        </div>
        <textarea
          :id="editorId"
          v-model="source"
          data-testid="playground-editor"
          class="playground-editor"
          :aria-label="messages.playground.editorAria"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          wrap="off"
        />
      </section>

      <section class="playground-pane playground-preview-pane">
        <div class="playground-pane-title">
          <span>{{ messages.playground.preview }}</span>
          <span>Browser</span>
        </div>
        <div class="playground-preview" aria-live="polite" data-testid="playground-preview">
          <div v-if="isRunning" class="playground-status" role="status">
            {{ messages.playground.running }}…
          </div>
          <div v-else-if="compileError" class="playground-diagnostics" role="alert" data-testid="playground-diagnostics">
            <strong>{{ messages.playground.diagnostics }}</strong>
            <pre>{{ compileError }}</pre>
          </div>
          <component :is="previewComponent" v-else-if="previewComponent" />
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.component-playground {
  display: flex;
  width: 100%;
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  flex-direction: column;
  background: var(--vp-c-bg);
}

.playground-header {
  display: flex;
  min-height: 64px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--mx-border);
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
  border: 1px solid var(--mx-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.playground-actions button:first-child {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
}

.playground-actions button:hover:not(:disabled),
.playground-actions button:focus-visible {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  outline: none;
}

.playground-actions button:first-child:hover:not(:disabled),
.playground-actions button:first-child:focus-visible {
  background: var(--vp-c-brand-2);
  color: #fff;
}

.playground-actions button:disabled {
  cursor: wait;
  opacity: 0.65;
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
  border-right: 1px solid var(--mx-border);
}

.playground-pane-title {
  display: flex;
  min-height: 42px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--mx-border);
  background: var(--mx-fill-light);
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.playground-pane-title > :last-child {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
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
  background: var(--vp-code-block-bg);
  color: var(--vp-code-block-color);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
}

.playground-editor:focus {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 55%, transparent);
}

.playground-preview {
  min-height: 0;
  flex: 1;
  padding: 28px 24px;
  overflow: auto;
}

.playground-status {
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.playground-diagnostics {
  padding: 14px 16px;
  border-left: 3px solid var(--mx-danger);
  background: color-mix(in srgb, var(--mx-danger) 8%, transparent);
  color: var(--mx-danger);
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

  .playground-actions button {
    min-width: 0;
    flex: 1;
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
    border-bottom: 1px solid var(--mx-border);
  }

  .playground-preview-pane {
    min-height: 360px;
  }
}
</style>
