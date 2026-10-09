<script setup lang="ts">
import type { ExperienceRuntimeHostIdentityEvent } from '../../../runtime-host'
import type { PreviewDrawerEmits, PreviewDrawerProps } from '../../../studio'
import { Maximize2, Minimize2, Monitor, PanelRight, RotateCcw, Smartphone, Tablet, X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, useTemplateRef } from 'vue'
import { useWorkbenchDialogFocus } from '../../../components/composables/dialog-focus'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'
import WorkbenchCommandHint from '../WorkbenchCommandHint/index.vue'
import StudioExperienceInspector from './components/StudioExperienceInspector.vue'

const props = defineProps<PreviewDrawerProps>()
const emit = defineEmits<PreviewDrawerEmits>()
const inspect = ref(true)
const dialog = useTemplateRef<HTMLElement>('dialog')
const focus = useWorkbenchDialogFocus(
  () => props.open,
  dialog,
  () => emit('close'),
)

const locale = computed(() => createDesignerLocale(props.locale))
const runtimeAvailable = computed(() =>
  Boolean(props.adapter
    && props.compilation
    && props.revision
    && props.session
    && props.sessionId),
)
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

function handleRuntimeReady(event: ExperienceRuntimeHostIdentityEvent): void {
  if (event.revision === props.revision && event.sessionId === props.sessionId)
    emit('ready', event)
}
</script>

<template>
  <aside
    v-if="open"
    ref="dialog"
    class="preview-dialog-shell"
    :class="{ 'is-expanded': expanded }"
    :aria-label="locale.t('preview.page', 'Page preview')"
    aria-labelledby="preview-dialog-title"
    data-dialog-initial-focus
    tabindex="-1"
    @keydown="focus.handleKeydown"
  >
    <aside
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
          <button
            type="button"
            :title="
              locale.locale === 'zh-CN' ? '重置体验：恢复首页与初始值' : 'Reset experience to home and initial values'
            "
            :aria-label="locale.locale === 'zh-CN' ? '重置体验' : 'Reset experience'"
            @click="emit('reset')"
          >
            <RotateCcw :size="15" aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-pressed="inspect"
            :title="locale.locale === 'zh-CN' ? '体验状态' : 'Experience state'"
            :aria-label="locale.locale === 'zh-CN' ? '体验状态' : 'Experience state'"
            @click="inspect = !inspect"
          >
            <PanelRight :size="15" aria-hidden="true" />
          </button>
          <div
            class="preview-viewport-switch"
            role="group"
            :aria-label="locale.t('preview.viewport', 'Preview viewport')"
          >
            <WorkbenchCommandHint v-for="item in viewports" :key="item.id" :label="item.label">
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
          <WorkbenchCommandHint
            :label="
              expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')
            "
          >
            <button
              class="preview-expand-button"
              type="button"
              :title="
                expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')
              "
              :aria-label="
                expanded ? locale.t('preview.restore', 'Restore preview') : locale.t('preview.expand', 'Expand preview')
              "
              @click="emit('update:expanded', !expanded)"
            >
              <Minimize2 v-if="expanded" :size="16" aria-hidden="true" />
              <Maximize2 v-else :size="16" aria-hidden="true" />
            </button>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint :label="locale.t('preview.close', 'Close preview')">
            <button
              type="button"
              :title="locale.t('preview.close', 'Close preview')"
              :aria-label="locale.t('preview.close', 'Close preview')"
              @click="emit('close')"
            >
              <X :size="16" aria-hidden="true" />
            </button>
          </WorkbenchCommandHint>
        </div>
      </header>

      <div class="preview-body" :class="{ 'has-inspector': inspect }">
        <div class="preview-canvas">
          <div class="preview-stage" :data-viewport="viewport">
            <PreviewRuntimeHostFrame
              v-if="runtimeAvailable && adapter && compilation && session"
              :key="`${adapter}:${sessionId}:${revision}`"
              :adapter="adapter"
              :breakpoint="viewportPinned ? viewport : undefined"
              :compilation="compilation"
              :locale="locale.locale"
              :namespace="namespace"
              :revision="revision"
              :session="session"
              :session-id="sessionId"
              :title="locale.t('preview.runtimeFrame', 'Page preview runtime')"
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
        <StudioExperienceInspector v-if="inspect" :states="instanceStates ?? {}" :locale="locale.locale" />
      </div>
    </aside>
  </aside>
</template>
