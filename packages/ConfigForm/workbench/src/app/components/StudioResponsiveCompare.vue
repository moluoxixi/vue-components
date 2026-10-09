<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { DesignRuntimeHostFrameProps } from '../../runtime-host'
import { resolveConfigFormLayout } from '@moluoxixi/config-form-core'
import { createDesignerLocale, createOperationCommand } from '@moluoxixi/config-form-designer'
import { computed, ref } from 'vue'
import { useWorkbenchController, useWorkbenchDesignSession, useWorkbenchUiStore } from '../composables/context'
import DesignRuntimeHostFrame from './DesignRuntimeHostFrame/index.vue'

const props = defineProps<{ modelValue: boolean, locale?: DesignerLocaleOptions }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const controller = useWorkbenchController()
const design = useWorkbenchDesignSession()
const ui = useWorkbenchUiStore()
const locale = computed(() => createDesignerLocale(props.locale))
const source = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const target = ref<'desktop' | 'tablet' | 'mobile'>('mobile')
function copyLayout(): void {
  const surface = controller.currentSurface.value
  if (!surface || source.value === target.value || controller.busy.value)
    return
  const current = surface.graph.form
  const layout = resolveConfigFormLayout(
    current.columns,
    current.fieldSpan,
    current.responsive,
    source.value,
    current.labelWidth,
  )
  const form
    = target.value === 'desktop'
      ? { ...current, ...layout }
      : { ...current, responsive: { ...current.responsive, [target.value]: { ...layout } } }
  const result = design.commandControl.execute(
    createOperationCommand('Copy responsive layout', [{ type: 'surface.form', surfaceId: surface.id, form }]),
  )
  ui.notify(
    result.diagnostics[0]?.message
    ?? (locale.value.locale === 'zh-CN'
      ? result.changed
        ? '断点布局已复制，可撤销。'
        : '目标布局已一致。'
      : result.changed
        ? 'Layout copied. You can undo this change.'
        : 'The target layout already matches.'),
  )
}
const viewports: { id: DesignRuntimeHostFrameProps['breakpoint'], width: number }[] = [
  { id: 'desktop', width: 1024 },
  { id: 'tablet', width: 768 },
  { id: 'mobile', width: 390 },
]
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    :title="locale.locale === 'zh-CN' ? '响应式对照' : 'Compare responsive layouts'"
    width="min(1400px, 96vw)"
    class="studio-responsive-compare"
    append-to="#workbench-overlays"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p>
      {{
        locale.locale === 'zh-CN'
          ? '同时检查三个断点的实际渲染。修改断点配置后，这里会使用相同编译结果更新。'
          : 'Inspect actual rendering at three breakpoints. Each view uses the same compilation and updates after layout changes.'
      }}
    </p>
    <div class="studio-responsive-copy">
      <span>{{
        locale.locale === 'zh-CN' ? '复制列数、默认跨度与标签宽度' : 'Copy columns, default span and label width'
      }}</span>
      <ElSelect
        v-model="source"
        :aria-label="locale.locale === 'zh-CN' ? '复制源断点' : 'Source breakpoint'"
        append-to="#workbench-overlays"
      >
        <ElOption
          v-for="view in viewports"
          :key="view.id"
          :value="view.id"
          :label="locale.t(`canvas.${view.id}`, view.id!)"
        />
      </ElSelect>
      <span aria-hidden="true">→</span>
      <ElSelect
        v-model="target"
        :aria-label="locale.locale === 'zh-CN' ? '复制目标断点' : 'Target breakpoint'"
        append-to="#workbench-overlays"
      >
        <ElOption
          v-for="view in viewports"
          :key="view.id"
          :value="view.id"
          :label="locale.t(`canvas.${view.id}`, view.id!)"
        />
      </ElSelect>
      <ElButton :disabled="source === target || controller.busy.value" @click="copyLayout">
        {{ locale.locale === 'zh-CN' ? '复制布局' : 'Copy layout' }}
      </ElButton>
    </div>
    <div class="studio-responsive-views">
      <section v-for="view in viewports" :key="view.id">
        <header>
          <strong>{{ locale.t(`canvas.${view.id}`, view.id) }}</strong><code>{{ view.width }}px</code>
        </header>
        <div class="studio-responsive-scroll">
          <div :style="{ width: `${view.width}px` }">
            <DesignRuntimeHostFrame
              :adapter="controller.getCurrentAdapterId()"
              :breakpoint="view.id"
              :camera-scale="1"
              :locale="locale.locale"
              :model-value="{}"
              :namespace="controller.registry.value.rendererNamespace"
              :resolve-compilation="design.getCompilation"
              :title="`${view.id} comparison`"
              variant="canvas"
            />
          </div>
        </div>
      </section>
    </div>
  </ElDialog>
</template>

<style scoped>
.studio-responsive-views {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}
.studio-responsive-views > section {
  min-width: 0;
  border: 1px solid var(--wb-separator);
  border-radius: 5px;
}
.studio-responsive-views header {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--wb-separator);
  font-size: 12px;
}
.studio-responsive-views header code {
  color: var(--wb-muted);
  font-size: 11px;
}
.studio-responsive-scroll {
  overflow: auto;
  height: 460px;
  background: white;
  padding: 12px;
}
.studio-responsive-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
}
.studio-responsive-copy .el-select {
  width: 130px;
}
@media (max-width: 900px) {
  .studio-responsive-views {
    grid-template-columns: 1fr;
  }
}
</style>
