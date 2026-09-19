<script setup lang="ts">
import type {
  ExperienceRuntimeHostIdentityEvent,
} from '../../../runtime-host'
import type {
  PreviewDrawerEmits,
  PreviewDrawerProps,
} from '../../../studio'
import {
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Tablet,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, watch } from 'vue'
import WorkbenchCommandHint from '../WorkbenchCommandHint/index.vue'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'

const props = defineProps<PreviewDrawerProps>()
const emit = defineEmits<PreviewDrawerEmits>()

let returnFocus: HTMLElement | undefined
const locale = computed(() => createDesignerLocale(props.locale))
const dialogWidth = computed(() => 'min(calc(100vw - 24px), clamp(720px, 78vw, 1200px))')
const runtimeAvailable = computed(() => Boolean(
  props.adapter
  && props.compilation
  && props.revision
  && props.session
  && props.sessionId,
))
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

function handleRuntimeReady(event: ExperienceRuntimeHostIdentityEvent): void {
  if (event.revision === props.revision && event.sessionId === props.sessionId)
    emit('ready', event)
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
    :aria-label="locale.t('preview.page', 'Surface preview')"
    aria-labelledby="preview-dialog-title"
    @close="handleDialogClose"
  >
    <aside
      class="preview-pane"
      :class="{ 'is-expanded': expanded }"
      role="complementary"
      :aria-label="locale.t('preview.page', 'Surface preview')"
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
            <PreviewRuntimeHostFrame
              v-if="runtimeAvailable && adapter && compilation && session"
              :key="`${adapter}:${sessionId}:${revision}`"
              :adapter="adapter"
              :compilation="compilation"
              :locale="locale.locale"
              :namespace="namespace"
              :revision="revision"
              :session="session"
              :session-id="sessionId"
              :title="locale.t('preview.runtimeFrame', 'Surface preview runtime')"
              @error="emit('error', $event)"
              @instance-state="emit('instanceState', $event)"
              @mounted="emit('mounted', $event)"
              @ready="handleRuntimeReady"
              @session="emit('session', $event)"
            />
            <div v-else class="preview-errors" role="status">
              <strong>{{ locale.t('preview.unavailable', 'Preview unavailable') }}</strong>
              <p>{{ state.label }}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </ElDialog>
</template>
