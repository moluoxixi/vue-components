<script setup lang="ts">
import type { ProjectTheme, ProjectThemeRadiusKey, ProjectThemeShadowKey, ProjectThemeSpacingKey } from '@moluoxixi/config-form-model'
import type { ProjectThemeEditorEmits, ProjectThemeEditorProps } from './types'
import { Check, RotateCcw } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import { DEFAULT_PROJECT_THEME, expandProjectTheme } from '../../../features/theme'
import { cloneWorkbenchJson } from '../../../utils'

type ThemeColorKey = keyof NonNullable<ProjectTheme['colors']>

const props = defineProps<ProjectThemeEditorProps>()
const emit = defineEmits<ProjectThemeEditorEmits>()
const locale = computed(() => createDesignerLocale(props.locale))

const colorLabels: Array<{ key: ThemeColorKey, label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'canvas', label: 'Canvas' },
  { key: 'surface', label: 'Surface' },
  { key: 'surfaceRaised', label: 'Raised surface' },
  { key: 'border', label: 'Border' },
]
const spacingKeys: ProjectThemeSpacingKey[] = ['xs', 'sm', 'md', 'lg', 'xl']
const radiusKeys: ProjectThemeRadiusKey[] = ['sm', 'md', 'lg']
const shadowKeys: ProjectThemeShadowKey[] = ['sm', 'md', 'lg']
const fontFamilies = [
  { label: 'System', value: 'system' },
  { label: 'Sans serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
]
const weights = [400, 500, 600, 700].map(value => ({ label: String(value), value }))
const borderStyles = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
]

const draft = ref<ProjectTheme>(expandProjectTheme(props.modelValue))
const activeSection = ref('colors')
const baseline = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)

watch(() => props.modelValue, (theme) => {
  draft.value = expandProjectTheme(theme)
  baseline.value = JSON.stringify(draft.value)
}, { deep: true })

function apply(): void {
  emit('apply', cloneWorkbenchJson(draft.value))
}

function reset(): void {
  emit('apply', { version: DEFAULT_PROJECT_THEME.version })
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden" :aria-label="locale.t('theme.title', 'Project theme')">
    <ElTabs v-model="activeSection" class="min-h-0 flex-1 overflow-hidden [&_.el-tabs__content]:h-[calc(100%_-_40px)] [&_.el-tabs__content]:overflow-auto" stretch>
      <ElTabPane :label="locale.t('theme.colors', 'Colors')" name="colors">
        <div class="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2">
          <label v-for="entry in colorLabels" :key="entry.key" class="flex min-w-0 items-center justify-between gap-3 rounded border border-[var(--wb-control-border)] px-2 py-1.5 text-xs text-[var(--wb-text)]">
            <span class="min-w-0 truncate">{{ locale.t(`theme.color.${entry.key}`, entry.label) }}</span>
            <ElColorPicker v-model="draft.colors![entry.key]" :disabled="readonly" show-alpha color-format="hex" />
          </label>
        </div>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.typography', 'Type')" name="type">
        <div class="grid grid-cols-1 gap-3 px-3 pb-3">
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.fontFamily', 'Font family') }}</span>
            <ElSelect v-model="draft.typography!.family" :disabled="readonly" append-to="#workbench-overlays">
              <ElOption v-for="option in fontFamilies" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.baseSize', 'Base size') }}</span>
            <ElInputNumber v-model="draft.typography!.baseSize" :disabled="readonly" :min="10" :max="32" :step="1" controls-position="right" />
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.lineHeight', 'Line height') }}</span>
            <ElInputNumber v-model="draft.typography!.lineHeight" :disabled="readonly" :min="1" :max="3" :step="0.1" :precision="1" controls-position="right" />
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.bodyWeight', 'Body weight') }}</span>
            <ElSelect v-model="draft.typography!.bodyWeight" :disabled="readonly" append-to="#workbench-overlays">
              <ElOption v-for="option in weights" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.headingWeight', 'Heading weight') }}</span>
            <ElSelect v-model="draft.typography!.headingWeight" :disabled="readonly" append-to="#workbench-overlays">
              <ElOption v-for="option in weights" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </label>
        </div>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.shape', 'Shape')" name="shape">
        <div class="grid grid-cols-2 gap-3 px-3 pb-3">
          <label v-for="key in spacingKeys" :key="`spacing-${key}`" class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.spacing', 'Space {key}', { key }) }}</span>
            <ElInputNumber v-model="draft.spacing![key]" :disabled="readonly" :min="0" :max="128" controls-position="right" />
          </label>
          <label v-for="key in radiusKeys" :key="`radius-${key}`" class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.radius', 'Radius {key}', { key }) }}</span>
            <ElInputNumber v-model="draft.radius![key]" :disabled="readonly" :min="0" :max="64" controls-position="right" />
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.borderWidth', 'Border width') }}</span>
            <ElInputNumber v-model="draft.border!.width" :disabled="readonly" :min="0" :max="12" controls-position="right" />
          </label>
          <label class="grid gap-1 text-xs text-[var(--wb-muted)]">
            <span>{{ locale.t('theme.borderStyle', 'Border style') }}</span>
            <ElSelect v-model="draft.border!.style" :disabled="readonly" append-to="#workbench-overlays">
              <ElOption v-for="option in borderStyles" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </label>
        </div>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.shadows', 'Shadows')" name="shadows">
        <div class="grid gap-3 px-3 pb-3">
          <fieldset v-for="key in shadowKeys" :key="key" class="grid grid-cols-2 gap-2 border-0 border-t border-solid border-[var(--wb-separator)] p-0 pt-2">
            <legend class="px-1 text-xs font-semibold uppercase text-[var(--wb-muted)]">{{ key }}</legend>
            <label v-for="property in (['x', 'y', 'blur', 'spread'] as const)" :key="property" class="grid gap-1 text-xs text-[var(--wb-muted)]">
              <span>{{ locale.t(`theme.shadow.${property}`, property) }}</span>
              <ElInputNumber v-model="draft.shadows![key]![property]" :disabled="readonly" :min="0" :max="128" controls-position="right" />
            </label>
            <label class="col-span-2 flex items-center justify-between gap-3 text-xs text-[var(--wb-muted)]">
              <span>{{ locale.t('theme.shadow.color', 'Color') }}</span>
              <ElColorPicker v-model="draft.shadows![key]!.color" :disabled="readonly" show-alpha color-format="hex" />
            </label>
          </fieldset>
        </div>
      </ElTabPane>
    </ElTabs>

    <footer class="flex shrink-0 items-center justify-between gap-2 border-0 border-t border-solid border-[var(--wb-separator)] p-3">
      <ElButton native-type="button" :disabled="readonly" @click="reset">
        <RotateCcw :size="14" aria-hidden="true" />
        {{ locale.t('theme.reset', 'Reset') }}
      </ElButton>
      <ElButton type="primary" native-type="button" :disabled="readonly || !dirty" @click="apply">
        <Check :size="14" aria-hidden="true" />
        {{ locale.t('action.apply', 'Apply') }}
      </ElButton>
    </footer>
  </section>
</template>
