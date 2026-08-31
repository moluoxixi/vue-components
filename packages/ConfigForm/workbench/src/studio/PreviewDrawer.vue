<script setup lang="ts">
import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchAdapterId } from '../adapters'
import type { WorkspacePreviewProjection } from '../session'
import {
  Maximize2,
  Minimize2,
  Monitor,
  Send,
  Smartphone,
  Tablet,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, useTemplateRef, watch } from 'vue'
import PreviewRuntimeHostFrame from '../runtime-host/PreviewRuntimeHostFrame.vue'

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

const props = defineProps<{
  adapter?: WorkbenchAdapterId
  compilation?: PageCompilation
  configError?: string
  expanded?: boolean
  locale?: DesignerLocaleOptions
  modelValue: Record<string, unknown>
  namespace?: string
  open: boolean
  projection?: WorkspacePreviewProjection
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  state: { label: string, tone: 'error' | 'live' }
  viewport: PreviewViewport
}>()

const emit = defineEmits<{
  close: []
  error: [error: unknown]
  fieldChange: [payload: { field: string, values: Record<string, unknown> }]
  runtimeEvent: [payload: { event: string, nodeId: string }]
  runtimeMounted: [revision: string]
  ready: [revision: string]
  submit: [values: Record<string, unknown>]
  'update:expanded': [expanded: boolean]
  'update:modelValue': [value: Record<string, unknown>]
  'update:viewport': [viewport: PreviewViewport]
}>()

const runtimeHost = useTemplateRef<{ submit: () => void }>('runtimeHost')
const runtimeReady = ref(false)
const locale = computed(() => createDesignerLocale(props.locale))
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

function submitForm(): void {
  runtimeHost.value?.submit()
}

function handleRuntimeReady(revision: string): void {
  if (revision !== props.projection?.current.revisionKey)
    return
  runtimeReady.value = true
  emit('ready', revision)
}

function handleRuntimeError(error: Error): void {
  runtimeReady.value = false
  emit('error', error)
}

watch(
  () => [props.adapter, props.compilation, props.projection?.current.revisionKey],
  () => runtimeReady.value = false,
)
</script>

<template>
  <aside v-if="open" class="preview-pane" :aria-label="locale.t('preview.page', 'Page preview')">
    <header class="pane-header">
      <div class="preview-heading">
        <strong>{{ locale.t('preview.title', 'Preview') }}</strong>
        <span class="preview-live-state" :data-tone="state.tone" role="status" aria-live="polite">
          <span aria-hidden="true" />
          {{ state.label }}
        </span>
      </div>
      <div class="preview-toolbar">
        <div class="preview-viewport-switch" role="group" :aria-label="locale.t('preview.viewport', 'Preview viewport')">
          <button
            v-for="item in viewports"
            :key="item.id"
            type="button"
            :aria-label="item.label"
            :aria-pressed="viewport === item.id"
            :title="item.label"
            @click="emit('update:viewport', item.id)"
          >
            <component :is="item.icon" :size="15" aria-hidden="true" />
          </button>
        </div>
        <button type="button" :disabled="!compilation || !runtimeReady" :title="locale.t('preview.submit', 'Submit preview form')" :aria-label="locale.t('preview.submit', 'Submit preview form')" @click="submitForm">
          <Send :size="15" aria-hidden="true" />
        </button>
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
        <button type="button" :title="locale.t('preview.close', 'Close preview')" :aria-label="locale.t('preview.close', 'Close preview')" @click="emit('close')">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
    </header>
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
          :model-value="modelValue"
          :namespace="namespace"
          :reaction-projection="reactionProjection"
          :revision="projection?.current.revisionKey ?? ''"
          :runtime-session-key="projection.current.runtimeSessionKey"
          :title="locale.t('preview.runtimeFrame', 'Page preview runtime')"
          @error="handleRuntimeError"
          @field-change="emit('fieldChange', $event)"
          @model-value="emit('update:modelValue', $event)"
          @mounted="emit('runtimeMounted', $event)"
          @ready="handleRuntimeReady"
          @runtime-event="emit('runtimeEvent', $event)"
          @submit="emit('submit', $event)"
        />
        <div v-else class="preview-errors">
          <strong>{{ locale.t('preview.unavailable', 'Preview unavailable') }}</strong>
          <p v-for="diagnostic in projection?.compileResult.diagnostics ?? []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
            {{ diagnostic.message }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
