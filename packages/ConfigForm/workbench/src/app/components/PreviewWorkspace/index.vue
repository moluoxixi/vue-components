<script setup lang="ts">
import type { ExperienceRuntimeHostIdentityEvent } from '../../../runtime-host'
import type { PreviewWorkspaceEmits, PreviewWorkspaceProps } from '../../../studio'
import { Monitor, PanelRight, RotateCcw, Smartphone, Tablet, X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import WorkbenchCommandHint from '../../../components/WorkbenchCommandHint/index.vue'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'
import StudioExperienceInspector from './components/StudioExperienceInspector.vue'

const props = defineProps<PreviewWorkspaceProps>()
const emit = defineEmits<PreviewWorkspaceEmits>()
const inspect = ref(false)
const workspace = useTemplateRef<HTMLElement>('workspace')
let returnFocus: HTMLElement | undefined
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  workspace.value?.focus()
})
onBeforeUnmount(() => {
  if (workspace.value?.contains(document.activeElement) && returnFocus?.isConnected)
    returnFocus.focus()
})

const locale = computed(() => createDesignerLocale(props.locale))
const runtimeAvailable = computed(() =>
  Boolean(props.adapter
    && props.compilation
    && props.revision
    && props.session
    && props.sessionId),
)
const viewports = computed(() => [
  { icon: Monitor, id: 'desktop' as const, width: 900, label: locale.value.t('preview.desktop', 'Desktop preview') },
  { icon: Tablet, id: 'tablet' as const, width: 720, label: locale.value.t('preview.tablet', 'Tablet preview') },
  { icon: Smartphone, id: 'mobile' as const, width: 390, label: locale.value.t('preview.mobile', 'Mobile preview') },
])

function handleRuntimeReady(event: ExperienceRuntimeHostIdentityEvent): void {
  if (event.revision === props.revision && event.sessionId === props.sessionId)
    emit('ready', event)
}
</script>

<template>
  <aside
    v-if="props.open"
    ref="workspace"
    class="preview-workspace"
    :aria-label="locale.t('preview.page', 'Page preview')"
    aria-labelledby="preview-workspace-title"
    tabindex="-1"
    @keydown.esc.prevent="emit('close')"
  >
    <aside
      class="preview-pane"
      role="complementary"
      :aria-label="locale.t('preview.page', 'Page preview')"
    >
      <header class="pane-header">
        <div class="preview-heading">
          <strong id="preview-workspace-title">{{ locale.t('preview.title', 'Preview') }}</strong>
          <span class="preview-live-state" :data-tone="props.state.tone" role="status" aria-live="polite">
            <span aria-hidden="true" />
            {{ props.state.label }}
          </span>
        </div>
        <div class="preview-toolbar">
          <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '重置体验：回到首页并恢复所有初始值' : 'Reset experience: return home and restore all initial values'">
            <button
              type="button"
              :aria-label="locale.locale === 'zh-CN' ? '重置体验' : 'Reset experience'"
              @click="emit('reset')"
            >
              <RotateCcw :size="15" aria-hidden="true" />
            </button>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '查看当前表单值、触达字段和校验错误' : 'Inspect current values, touched fields and validation errors'">
            <button
              type="button"
              :aria-pressed="inspect"
              :aria-label="locale.locale === 'zh-CN' ? '体验状态' : 'Experience state'"
              @click="inspect = !inspect"
            >
              <PanelRight :size="15" aria-hidden="true" />
            </button>
          </WorkbenchCommandHint>
          <div
            class="preview-viewport-switch"
            role="group"
            :aria-label="locale.t('preview.viewport', 'Preview viewport')"
          >
            <WorkbenchCommandHint v-for="item in viewports" :key="item.id" :label="`${item.label} · ${item.width}px${locale.locale === 'zh-CN' ? '，空间不足时适应可用宽度' : ', fits the available width'}`">
              <button
                type="button"
                :aria-label="item.label"
                :aria-pressed="props.viewport === item.id"
                @click="emit('update:viewport', item.id)"
              >
                <component :is="item.icon" :size="15" aria-hidden="true" />
              </button>
            </WorkbenchCommandHint>
          </div>
          <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '关闭体验，返回设计画布' : 'Close experience and return to the design canvas'" shortcut="Esc">
            <button
              type="button"
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
          <div class="preview-stage" :data-viewport="props.viewport">
            <PreviewRuntimeHostFrame
              v-if="runtimeAvailable && props.adapter && props.compilation && props.session"
              :key="`${props.adapter}:${props.sessionId}:${props.revision}`"
              :adapter="props.adapter"
              :breakpoint="props.viewport"
              :compilation="props.compilation"
              :locale="locale.locale"
              :namespace="props.namespace"
              :revision="props.revision"
              :session="props.session"
              :session-id="props.sessionId"
              :title="locale.t('preview.runtimeFrame', 'Page preview runtime')"
              @error="emit('error', $event)"
              @instance-state="emit('instanceState', $event)"
              @mounted="emit('mounted', $event)"
              @ready="handleRuntimeReady"
              @session="emit('session', $event)"
            />
            <div v-else class="preview-errors" role="status">
              <strong>{{ locale.t('preview.unavailable', 'Preview unavailable') }}</strong>
              <p>{{ props.state.label }}</p>
            </div>
          </div>
        </div>
        <StudioExperienceInspector v-if="inspect" :states="props.instanceStates ?? {}" :locale="locale.locale" />
      </div>
    </aside>
  </aside>
</template>
