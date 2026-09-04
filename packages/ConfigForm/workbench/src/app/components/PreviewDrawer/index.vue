<script setup lang="ts">
import type { PreviewRuntimeIdentity } from '../../../session'
import type {
  PreviewDrawerEmits,
  PreviewDrawerProps,
  PreviewViewport,
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
import { WorkbenchCommandHint } from '../../../components/index'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'

const props = defineProps<PreviewDrawerProps>()

const emit = defineEmits<PreviewDrawerEmits>()

const runtimeHost = useTemplateRef<{ submit: () => void }>('runtimeHost')
const runtimeReady = ref(false)
let returnFocus: HTMLElement | undefined
const locale = computed(() => createDesignerLocale(props.locale))
const drawerSize = computed(() => props.expanded ? '100%' : 'clamp(420px, 42vw, 680px)')
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
  : locale.value.t('preview.submitInvalid', 'Validation failed'))
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

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

function handleDrawerClose(): void {
  if (!props.open)
    return
  if (props.expanded)
    emit('update:expanded', false)
  else
    emit('close')
}

watch(
  () => [props.adapter, props.compilation, props.projection?.current.revisionKey],
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
  <ElDrawer
    v-if="open"
    class="preview-drawer-shell"
    :class="{ 'is-expanded': expanded }"
    modal-class="preview-drawer-overlay"
    :model-value="open"
    direction="rtl"
    :size="drawerSize"
    :modal="!!expanded"
    modal-penetrable
    append-to="#workbench-overlays"
    destroy-on-close
    :lock-scroll="!!expanded"
    :trap-focus="!!expanded"
    :close-on-click-modal="!!expanded"
    :close-on-press-escape="!!expanded"
    :show-close="false"
    :with-header="false"
    :aria-label="locale.t('preview.page', 'Page preview')"
    :aria-labelledby="expanded ? 'preview-dialog-title' : undefined"
    :aria-modal="expanded ? 'true' : undefined"
    @close="handleDrawerClose"
  >
    <aside
      v-if="open"
      class="preview-pane"
      :class="{ 'is-expanded': expanded }"
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
      <section class="preview-results" data-preview-results :aria-label="locale.t('preview.results', 'Submission results')" aria-live="polite">
        <header class="preview-results-header">
          <div>
            <strong>{{ locale.t('preview.results', 'Submission results') }}</strong>
            <span v-if="lastSubmission" class="preview-result-status" :data-status="lastSubmission.status">
              <Check v-if="lastSubmission.status === 'success'" :size="13" aria-hidden="true" />
              <span v-else aria-hidden="true">!</span>
              {{ submissionStatusLabel }}
            </span>
          </div>
          <div v-if="lastSubmission" class="preview-results-actions">
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
          {{ locale.t('preview.resultsEmpty', 'Submit the preview form to inspect its JSON result and validation state.') }}
        </p>
      </section>
      </div>
    </aside>
  </ElDrawer>
</template>
