<script setup lang="ts">
import type { ConfigFormFlowTraceEvent } from '@moluoxixi/config-form-core'
import type {
  PreviewRuntimeFlowDiagnosticEvent,
  PreviewRuntimeFlowProjectionEvent,
  PreviewRuntimeFlowResultEvent,
  PreviewRuntimeFlowTraceEvent,
  PreviewRuntimeHostFrameExpose,
} from '../../../runtime-host'
import type { PreviewRuntimeIdentity } from '../../../session'
import type {
  PreviewDrawerEmits,
  PreviewDrawerProps,
} from '../../../studio'
import {
  Check,
  Clipboard,
  Maximize2,
  Minimize2,
  Monitor,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import WorkbenchCommandHint from '../WorkbenchCommandHint/index.vue'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'

const props = defineProps<PreviewDrawerProps>()
const emit = defineEmits<PreviewDrawerEmits>()

const runtimeHost = useTemplateRef<PreviewRuntimeHostFrameExpose>('runtimeHost')
const runtimeReady = ref(false)
const resultsView = ref<'submission' | 'trace'>('submission')
const resultTabs = useTemplateRef<HTMLElement>('resultTabs')
const traceEntries = computed(() => (props.flowTrace ?? []).slice(-200).reverse())
const traceDiagnostics = computed(() => (props.flowDiagnostics ?? []).slice(-200))
let returnFocus: HTMLElement | undefined
const locale = computed(() => createDesignerLocale(props.locale))
const dialogWidth = computed(() => 'min(calc(100vw - 24px), clamp(720px, 78vw, 1200px))')
const submitUnavailableReason = computed(() => !props.compilation || !runtimeReady.value
  ? locale.value.t('preview.submitUnavailable', 'Preview is not ready to submit')
  : undefined)
const submissionJson = computed(() => {
  if (!props.lastSubmission)
    return ''
  try {
    return JSON.stringify(props.lastSubmission.values, null, 2)
  }
  catch {
    return locale.value.t('preview.resultUnavailable', 'Submission values cannot be formatted.')
  }
})
const submissionValidation = computed(() => Object.entries(props.lastSubmission?.validation ?? {}))
const submissionStatusLabel = computed(() => props.lastSubmission?.status === 'success'
  ? locale.value.t('preview.submitSuccess', 'Submitted successfully')
  : props.lastSubmission?.status === 'blocked'
    ? locale.value.t('preview.submitBlocked', 'Submission blocked')
    : props.lastSubmission?.status === 'failure'
      ? locale.value.t('preview.submitFailure', 'Submission failed')
      : locale.value.t('preview.submitInvalid', 'Validation failed'))
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

function traceTitle(event: ConfigFormFlowTraceEvent): string {
  const flow = props.flows?.find(item => item.id === event.flowId)
  const node = flow?.nodes.find(item => item.id === event.nodeId)
  const descriptor = node?.ref ? props.flowActions?.describe?.(node.ref) : undefined
  const action = descriptor ? locale.value.t(`flow.action.${descriptor.ref}`, descriptor.title) : undefined
  const step = action && event.nodeId ? `${action} (${event.nodeId})` : event.nodeId
  return boundedText([flow?.name || event.flowId, step].filter(Boolean).join(' / '))
}

function traceKey(event: ConfigFormFlowTraceEvent): string {
  return JSON.stringify([event.flowId, event.runId, event.revision, event.nodeId, event.type, event.timestamp, event.status])
}

function boundedText(text: string): string {
  return text.length > 4096 ? `${text.slice(0, 4096)}\n...` : text
}

function traceValue(value: unknown): string {
  try {
    return boundedText(JSON.stringify(value, null, 2) ?? '')
  }
  catch {
    return locale.value.t('preview.trace.unavailable', 'Snapshot unavailable')
  }
}

function handleResultTabKeydown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return
  event.preventDefault()
  resultsView.value = event.key === 'Home' ? 'submission' : event.key === 'End' ? 'trace' : resultsView.value === 'submission' ? 'trace' : 'submission'
  void nextTick(() => resultTabs.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus())
}

function submitForm(): void {
  runtimeHost.value?.submit()
}

async function copySubmission(): Promise<void> {
  if (!props.lastSubmission)
    return
  if (!navigator.clipboard) {
    emit('error', new Error(locale.value.t('preview.copyUnavailable', 'Clipboard access is unavailable.')))
    return
  }
  try {
    await navigator.clipboard.writeText(submissionJson.value)
    emit('message', locale.value.t('preview.copySuccess', 'Submission JSON copied.'))
  }
  catch (error) {
    emit('error', error)
  }
}

function handleRuntimeReady(event: PreviewRuntimeIdentity): void {
  if (event.revision !== props.projection?.current.revisionKey)
    return
  runtimeReady.value = true
  emit('ready', event)
}

function handleRuntimeError(error: Error): void {
  runtimeReady.value = false
  emit('error', error)
}

function guardDialogClose(done: () => void): void {
  if (props.expanded) {
    emit('update:expanded', false)
    return
  }
  done()
}

function handleDialogClose(): void {
  if (props.open)
    emit('close')
}

function handleFlowError(event: PreviewRuntimeFlowDiagnosticEvent): void {
  emit('flowError', event)
}

function handleFlowProjection(event: PreviewRuntimeFlowProjectionEvent): void {
  emit('flowProjection', event)
}

function handleFlowResult(event: PreviewRuntimeFlowResultEvent): void {
  emit('flowResult', event)
}

function handleFlowTrace(event: PreviewRuntimeFlowTraceEvent): void {
  emit('flowTrace', event)
}

watch(
  () => [props.adapter, props.compilation, props.flowActions, props.projection?.current.revisionKey],
  () => runtimeReady.value = false,
)

watch(() => props.open, (open, wasOpen) => {
  if (open) {
    returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    return
  }
  const target = returnFocus
  returnFocus = undefined
  if (wasOpen && target?.isConnected)
    void nextTick(() => target.focus())
})
</script>


<template>
  <ElDialog
    v-if="open"
    class="preview-dialog-shell"
    :class="{ 'is-expanded': expanded }"
    modal-class="preview-drawer-overlay"
    :model-value="open"
    :width="dialogWidth"
    :fullscreen="!!expanded"
    align-center
    append-to="#workbench-overlays"
    destroy-on-close
    trap-focus
    :close-on-click-modal="false"
    close-on-press-escape
    :show-close="false"
    :before-close="guardDialogClose"
    :aria-label="locale.t('preview.page', 'Page preview')"
    aria-labelledby="preview-dialog-title"
    @close="handleDialogClose"
  >
    <aside
      v-if="open"
      class="preview-pane"
      :class="{ 'is-expanded': expanded, 'is-result-empty': !lastSubmission && resultsView === 'submission' }"
      role="complementary"
      :aria-label="locale.t('preview.page', 'Page preview')"
    >
      <header class="pane-header">
      <div class="preview-heading">
        <strong id="preview-dialog-title">{{ locale.t('preview.title', 'Preview') }}</strong>
        <span class="preview-live-state" :data-tone="state.tone" role="status" aria-live="polite">
          <span aria-hidden="true" />
          {{ state.label }}
        </span>
      </div>
      <div class="preview-toolbar">
        <div class="preview-viewport-switch" role="group" :aria-label="locale.t('preview.viewport', 'Preview viewport')">
          <WorkbenchCommandHint
            v-for="item in viewports"
            :key="item.id"
            :label="item.label"
          >
            <button
              type="button"
              :aria-label="item.label"
              :aria-pressed="viewport === item.id"
              :title="item.label"
              @click="emit('update:viewport', item.id)"
            >
              <component :is="item.icon" :size="15" aria-hidden="true" />
            </button>
          </WorkbenchCommandHint>
        </div>
        <WorkbenchCommandHint :label="locale.t('preview.submit', 'Submit preview form')" :disabled-reason="submitUnavailableReason">
          <button type="button" :aria-disabled="submitUnavailableReason ? 'true' : undefined" :title="locale.t('preview.submit', 'Submit preview form')" :aria-label="locale.t('preview.submit', 'Submit preview form')" @click="!submitUnavailableReason && submitForm()">
            <Send :size="15" aria-hidden="true" />
          </button>
        </WorkbenchCommandHint>
        <button v-if="expanded" type="button" class="preview-exit-command" @click="emit('update:expanded', false)">
          {{ locale.t('preview.exit', 'Exit preview') }}
        </button>
        <WorkbenchCommandHint :label="expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')">
          <button
            class="preview-expand-button"
            type="button"
            :title="expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')"
            :aria-label="expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')"
            @click="emit('update:expanded', !expanded)"
          >
            <Minimize2 v-if="expanded" :size="16" aria-hidden="true" />
            <Maximize2 v-else :size="16" aria-hidden="true" />
          </button>
        </WorkbenchCommandHint>
        <WorkbenchCommandHint :label="locale.t('preview.close', 'Close preview')">
          <button type="button" :title="locale.t('preview.close', 'Close preview')" :aria-label="locale.t('preview.close', 'Close preview')" @click="emit('close')">
            <X :size="16" aria-hidden="true" />
          </button>
        </WorkbenchCommandHint>
      </div>
      </header>
      <div class="preview-body">
      <div class="preview-canvas">
        <div class="preview-stage" :data-viewport="viewport">
          <div v-if="compilation && (configError || projection?.compileResult.success === false)" class="preview-diagnostics" role="status">
            <strong>{{ locale.t('preview.showingLastValid', 'Showing last valid preview') }}</strong>
            <p v-if="configError">{{ configError }}</p>
            <p
              v-for="diagnostic in projection?.compileResult.success === false ? projection.compileResult.diagnostics : []"
              :key="`${diagnostic.code}-${diagnostic.path.join('.')}`"
            >
              {{ diagnostic.message }}
            </p>
          </div>
          <PreviewRuntimeHostFrame
            v-if="adapter && compilation && projection"
            :key="adapter"
            ref="runtimeHost"
            :adapter="adapter"
            :compilation="compilation"
            :data-source-host="dataSourceHost"
            :flow-actions="flowActions"
            :locale="locale.locale"
            :runtime-state="runtimeState"
            :namespace="namespace"
            :reaction-projection="reactionProjection"
            :revision="projection?.current.revisionKey ?? ''"
            :runtime-session-key="projection.current.runtimeSessionKey"
            :title="locale.t('preview.runtimeFrame', 'Page preview runtime')"
            @error="handleRuntimeError"
            @field-change="emit('fieldChange', $event)"
            @mounted="emit('runtimeMounted', $event)"
            @ready="handleRuntimeReady"
            @runtime-event="emit('runtimeEvent', $event)"
            @runtime-state="emit('runtimeState', $event)"
            @submit="emit('submit', $event)"
            @flow-error="handleFlowError"
            @flow-projection="handleFlowProjection"
            @flow-result="handleFlowResult"
            @flow-trace="handleFlowTrace"
            @submit-result="emit('submitResult', $event)"
          />
          <div v-else class="preview-errors">
            <strong>{{ locale.t('preview.unavailable', 'Preview unavailable') }}</strong>
            <p v-for="diagnostic in projection?.compileResult.diagnostics ?? []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
              {{ diagnostic.message }}
            </p>
          </div>
        </div>
      </div>
      <section class="preview-results" data-preview-results :aria-label="locale.t('preview.inspection', 'Preview results')">
        <header class="preview-results-header">
          <div>
            <div ref="resultTabs" class="preview-result-tabs" role="tablist" :aria-label="locale.t('preview.inspection', 'Preview results')" @keydown="handleResultTabKeydown">
              <button id="preview-submission-tab" type="button" role="tab" aria-controls="preview-submission-panel" :aria-selected="resultsView === 'submission'" :tabindex="resultsView === 'submission' ? 0 : -1" @click="resultsView = 'submission'">{{ locale.t('preview.results', 'Submission results') }}</button>
              <button id="preview-trace-tab" type="button" role="tab" aria-controls="preview-trace-panel" :aria-selected="resultsView === 'trace'" :tabindex="resultsView === 'trace' ? 0 : -1" @click="resultsView = 'trace'">{{ locale.t('preview.trace.title', 'Run history') }}<span class="preview-trace-count">{{ traceEntries.length }}</span></button>
            </div>
            <span v-if="lastSubmission && resultsView === 'submission'" class="preview-result-status" :data-status="lastSubmission.status" role="status" aria-live="polite">
              <Check v-if="lastSubmission.status === 'success'" :size="13" aria-hidden="true" />
              <span v-else aria-hidden="true">!</span>
              {{ submissionStatusLabel }}
            </span>
          </div>
          <div v-if="lastSubmission && resultsView === 'submission'" class="preview-results-actions">
            <button type="button" :title="locale.t('preview.copy', 'Copy submission JSON')" :aria-label="locale.t('preview.copy', 'Copy submission JSON')" @click="copySubmission">
              <Clipboard :size="14" aria-hidden="true" />
              <span>{{ locale.t('preview.copy', 'Copy') }}</span>
            </button>
            <button type="button" :title="locale.t('preview.clearResult', 'Clear submission result')" :aria-label="locale.t('preview.clearResult', 'Clear submission result')" @click="emit('clearSubmission')">
              <Trash2 :size="14" aria-hidden="true" />
              <span>{{ locale.t('preview.clearResult', 'Clear') }}</span>
            </button>
          </div>
        </header>
        <div id="preview-submission-panel" role="tabpanel" aria-labelledby="preview-submission-tab" :hidden="resultsView !== 'submission'">
        <template v-if="lastSubmission">
          <div class="preview-result-toolbar">
            <span>{{ locale.t('preview.submittedAt', 'Submitted {time}', { time: new Date(lastSubmission.submittedAt).toLocaleTimeString(locale.locale) }) }}</span>
            <button type="button" class="preview-submit-again" :disabled="!compilation || !runtimeReady" @click="submitForm">
              <Send :size="13" aria-hidden="true" />
              {{ locale.t('preview.submitAgain', 'Submit again') }}
            </button>
          </div>
          <pre class="preview-result-json" data-preview-submission-json>{{ submissionJson }}</pre>
          <div v-if="lastSubmission.touched.length > 0" class="preview-result-section">
            <strong>{{ locale.t('preview.touched', 'Touched fields') }}</strong>
            <span v-for="field in lastSubmission.touched" :key="field" class="preview-result-chip">{{ field }}</span>
          </div>
          <div v-if="submissionValidation.length > 0" class="preview-result-section preview-result-validation">
            <strong>{{ locale.t('preview.validation', 'Validation') }}</strong>
            <ul>
              <li v-for="[field, errors] in submissionValidation" :key="field">
                <span>{{ field }}</span>
                <span>{{ errors.join(', ') }}</span>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="preview-results-empty">
          {{ locale.t('preview.noSubmission', 'No submission') }}
        </p>
        </div>
        <div id="preview-trace-panel" role="tabpanel" aria-labelledby="preview-trace-tab" :hidden="resultsView !== 'trace'" data-preview-trace>
          <ul v-if="traceDiagnostics.length" class="preview-trace-diagnostics" :aria-label="locale.t('preview.trace.diagnostics', 'Diagnostics')">
            <li v-for="(diagnostic, index) in traceDiagnostics" :key="`${diagnostic.code}-${diagnostic.path}-${index}`" :data-severity="diagnostic.severity ?? 'error'">
              <strong>{{ boundedText(diagnostic.code) }}</strong><span>{{ boundedText(diagnostic.message) }}</span>
              <code v-if="diagnostic.path">{{ boundedText(diagnostic.path) }}</code>
              <code v-if="diagnostic.nodeId">{{ locale.t('preview.trace.node', 'Step') }}: {{ boundedText(diagnostic.nodeId) }}</code>
              <code v-if="diagnostic.edgeId">{{ locale.t('preview.trace.edge', 'Branch') }}: {{ boundedText(diagnostic.edgeId) }}</code>
            </li>
          </ul>
          <ol class="preview-trace-list">
            <li v-for="event in traceEntries" :key="traceKey(event)">
              <details :data-status="event.status ?? event.type">
                <summary>
                  <time>{{ event.timestamp === undefined ? '' : new Date(event.timestamp).toLocaleTimeString(locale.locale) }}</time>
                  <span class="preview-trace-label">{{ traceTitle(event) }}</span>
                  <span>{{ locale.t(`preview.trace.${event.status ?? event.type}`, event.status ?? event.type) }}</span>
                  <span class="preview-trace-duration">{{ event.durationMs === undefined ? '' : `${event.durationMs.toFixed(1)} ms` }}</span>
                </summary>
                <dl class="preview-trace-payload">
                  <dt>{{ locale.t('preview.trace.run', 'Run') }}</dt><dd><code>{{ boundedText(event.runId) }}</code></dd>
                  <template v-if="event.input !== undefined"><dt>{{ locale.t('preview.trace.input', 'Input') }}</dt><dd><pre>{{ traceValue(event.input) }}</pre></dd></template>
                  <template v-if="event.output !== undefined"><dt>{{ locale.t('preview.trace.output', 'Output') }}</dt><dd><pre>{{ traceValue(event.output) }}</pre></dd></template>
                  <template v-if="event.valuePatch !== undefined"><dt>{{ locale.t('preview.trace.patch', 'Value changes') }}</dt><dd><pre>{{ traceValue(event.valuePatch) }}</pre></dd></template>
                  <template v-if="event.error"><dt>{{ locale.t('preview.trace.error', 'Error') }}</dt><dd>{{ boundedText(event.error) }}</dd></template>
                </dl>
                <p v-if="event.truncated" class="preview-trace-truncated">{{ locale.t('preview.trace.truncated', 'Snapshot truncated') }}</p>
              </details>
            </li>
          </ol>
          <p v-if="!traceEntries.length" class="preview-results-empty">{{ locale.t('preview.trace.empty', 'No runs') }}</p>
        </div>
      </section>
      </div>
    </aside>
  </ElDialog>
</template>
