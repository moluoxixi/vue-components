<script setup lang="ts">
import type { ProjectTheme, ProjectThemeRadiusKey, ProjectThemeShadowKey, ProjectThemeSpacingKey } from '@moluoxixi/config-form-model'
import type { ProjectThemeEditorEmits, ProjectThemeEditorProps } from './types'
import { Check, RotateCcw } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import { DEFAULT_PROJECT_THEME, expandProjectTheme } from '../../../features/theme'
import { cloneWorkbenchJson } from '../../../utils'
import WorkbenchCommandHint from '../WorkbenchCommandHint/index.vue'
import './style/index.css'

type ThemeColorKey = keyof NonNullable<ProjectTheme['colors']>

const props = defineProps<ProjectThemeEditorProps>()
const emit = defineEmits<ProjectThemeEditorEmits>()
const locale = computed(() => createDesignerLocale(props.locale))

const colorGroups: Array<{ key: string, label: string, colors: Array<{ key: ThemeColorKey, label: string }> }> = [
  { key: 'status', label: 'Brand and status', colors: [
    { key: 'primary', label: 'Primary' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'danger', label: 'Danger' },
  ] },
  { key: 'text', label: 'Text', colors: [
    { key: 'text', label: 'Text' },
    { key: 'textMuted', label: 'Muted text' },
  ] },
  { key: 'surfaces', label: 'Surfaces and borders', colors: [
    { key: 'canvas', label: 'Canvas' },
    { key: 'surface', label: 'Surface' },
    { key: 'surfaceRaised', label: 'Raised surface' },
    { key: 'border', label: 'Border' },
  ] },
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
const readonlyReason = computed(() => props.readonly
  ? locale.value.t('theme.readonlyUnavailable', 'The designer is read-only; enable editing to change the theme')
  : undefined)
const readonlyHint = computed(() => ({
  disabled: !props.readonly,
  content: readonlyReason.value,
  effect: 'light' as const,
  placement: 'bottom' as const,
  appendTo: '#workbench-overlays',
  popperClass: 'workbench-passive-tooltip workbench-command-tooltip',
  showAfter: 350,
  enterable: false,
}))
const applyUnavailableReason = computed(() => readonlyReason.value || (!dirty.value
  ? locale.value.t('theme.applyUnavailable', 'No theme changes yet; edit a setting to apply it')
  : undefined))

watch(() => props.modelValue, (theme) => {
  draft.value = expandProjectTheme(theme)
  baseline.value = JSON.stringify(draft.value)
}, { deep: true })

function apply(): void {
  if (!props.readonly && dirty.value)
    emit('apply', cloneWorkbenchJson(draft.value))
}

function reset(): void {
  if (!props.readonly)
    emit('apply', { version: DEFAULT_PROJECT_THEME.version })
}

function shadowPreview(key: ProjectThemeShadowKey): string {
  const shadow = draft.value.shadows![key]!
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`
}
</script>

<template>
  <section class="project-theme-editor" :aria-label="locale.t('theme.title', 'Project theme')">
    <p class="project-theme-description">
      {{ locale.t('theme.description', 'Set the appearance of all pages in this project. Apply when ready.') }}
    </p>
    <ElTabs v-model="activeSection" class="project-theme-tabs" stretch>
      <ElTabPane :label="locale.t('theme.colors', 'Colors')" name="colors">
        <ElTooltip v-bind="readonlyHint">
          <div class="project-theme-groups">
            <section v-for="group in colorGroups" :key="group.key" class="project-theme-group">
              <h3>{{ locale.t(`theme.colorGroup.${group.key}`, group.label) }}</h3>
              <div class="project-theme-color-grid">
                <div v-for="entry in group.colors" :key="entry.key" class="project-theme-color">
                  <span class="project-theme-color-copy">
                    <span>{{ locale.t(`theme.color.${entry.key}`, entry.label) }}</span>
                    <code>{{ draft.colors![entry.key] }}</code>
                  </span>
                  <ElColorPicker
                    v-model="draft.colors![entry.key]"
                    :aria-label="locale.t(`theme.color.${entry.key}`, entry.label)"
                    :disabled="readonly"
                    show-alpha
                    color-format="hex"
                  />
                </div>
              </div>
            </section>
          </div>
        </ElTooltip>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.typography', 'Type')" name="type">
        <ElTooltip v-bind="readonlyHint">
          <div class="designer-theme-field-grid designer-theme-type-grid">
            <label class="designer-theme-field project-theme-wide-field">
              <span>{{ locale.t('theme.fontFamily', 'Font family') }}</span>
              <ElSelect v-model="draft.typography!.family" :disabled="readonly" append-to="#workbench-overlays">
                <ElOption v-for="option in fontFamilies" :key="option.value" :label="locale.t(`theme.font.${option.value}`, option.label)" :value="option.value" />
              </ElSelect>
            </label>
            <label class="designer-theme-field">
              <span>{{ locale.t('theme.baseSize', 'Base size') }} <small>px</small></span>
              <ElInputNumber v-model="draft.typography!.baseSize" :disabled="readonly" :controls="false" :min="10" :max="32" :step="1" />
            </label>
            <label class="designer-theme-field">
              <span>{{ locale.t('theme.lineHeight', 'Line height') }}</span>
              <ElInputNumber v-model="draft.typography!.lineHeight" :disabled="readonly" :controls="false" :min="1" :max="3" :step="0.1" :precision="1" />
            </label>
            <label class="designer-theme-field">
              <span>{{ locale.t('theme.bodyWeight', 'Body weight') }}</span>
              <ElSelect v-model="draft.typography!.bodyWeight" :disabled="readonly" append-to="#workbench-overlays">
                <ElOption v-for="option in weights" :key="option.value" :label="option.label" :value="option.value" />
              </ElSelect>
            </label>
            <label class="designer-theme-field">
              <span>{{ locale.t('theme.headingWeight', 'Heading weight') }}</span>
              <ElSelect v-model="draft.typography!.headingWeight" :disabled="readonly" append-to="#workbench-overlays">
                <ElOption v-for="option in weights" :key="option.value" :label="option.label" :value="option.value" />
              </ElSelect>
            </label>
          </div>
        </ElTooltip>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.shape', 'Shape')" name="shape">
        <ElTooltip v-bind="readonlyHint">
          <div class="project-theme-groups">
            <section class="project-theme-group">
              <h3>{{ locale.t('theme.spacingGroup', 'Spacing') }} <small>px</small></h3>
              <div class="designer-theme-field-grid designer-theme-shape-grid">
                <label v-for="key in spacingKeys" :key="key" class="designer-theme-field">
                  <span>{{ key }}</span>
                  <ElInputNumber v-model="draft.spacing![key]" :aria-label="locale.t('theme.spacing', 'Space {key}', { key })" :disabled="readonly" :controls="false" :min="0" :max="128" />
                </label>
              </div>
            </section>
            <section class="project-theme-group">
              <h3>{{ locale.t('theme.radiusGroup', 'Corners') }} <small>px</small></h3>
              <div class="designer-theme-field-grid designer-theme-shape-grid">
                <label v-for="key in radiusKeys" :key="key" class="designer-theme-field">
                  <span>{{ key }}</span>
                  <ElInputNumber v-model="draft.radius![key]" :aria-label="locale.t('theme.radius', 'Radius {key}', { key })" :disabled="readonly" :controls="false" :min="0" :max="64" />
                </label>
              </div>
            </section>
            <section class="project-theme-group">
              <h3>{{ locale.t('theme.borderGroup', 'Borders') }}</h3>
              <div class="designer-theme-field-grid designer-theme-shape-grid">
                <label class="designer-theme-field">
                  <span>{{ locale.t('theme.borderWidth', 'Border width') }} <small>px</small></span>
                  <ElInputNumber v-model="draft.border!.width" :disabled="readonly" :controls="false" :min="0" :max="12" />
                </label>
                <label class="designer-theme-field">
                  <span>{{ locale.t('theme.borderStyle', 'Border style') }}</span>
                  <ElSelect v-model="draft.border!.style" :disabled="readonly" append-to="#workbench-overlays">
                    <ElOption v-for="option in borderStyles" :key="option.value" :label="locale.t(`theme.borderStyle.${option.value}`, option.label)" :value="option.value" />
                  </ElSelect>
                </label>
              </div>
            </section>
          </div>
        </ElTooltip>
      </ElTabPane>

      <ElTabPane :label="locale.t('theme.shadows', 'Shadows')" name="shadows">
        <ElTooltip v-bind="readonlyHint">
          <div class="project-theme-groups project-theme-shadow-list">
            <fieldset v-for="key in shadowKeys" :key="key" class="project-theme-shadow">
              <legend>{{ key }}</legend>
              <div class="project-theme-shadow-preview" aria-hidden="true">
                <span :style="{ boxShadow: shadowPreview(key) }">Aa</span>
              </div>
              <div class="designer-theme-field-grid project-theme-shadow-grid">
                <label v-for="property in (['x', 'y', 'blur', 'spread'] as const)" :key="property" class="designer-theme-field">
                  <span>{{ locale.t(`theme.shadow.${property}`, property) }} <small>px</small></span>
                  <ElInputNumber v-model="draft.shadows![key]![property]" :disabled="readonly" :controls="false" :min="0" :max="128" />
                </label>
              </div>
              <div class="project-theme-color project-theme-shadow-color">
                <span class="project-theme-color-copy">
                  <span>{{ locale.t('theme.shadow.color', 'Color') }}</span>
                  <code>{{ draft.shadows![key]!.color }}</code>
                </span>
                <ElColorPicker v-model="draft.shadows![key]!.color" :aria-label="locale.t('theme.shadow.color', 'Color')" :disabled="readonly" show-alpha color-format="hex" />
              </div>
            </fieldset>
          </div>
        </ElTooltip>
      </ElTabPane>
    </ElTabs>

    <footer class="project-theme-actions">
      <WorkbenchCommandHint detached :label="locale.t('theme.resetHint', 'Restore the default colors, typography and styles for this project')" :disabled-reason="readonlyReason">
        <ElButton native-type="button" :disabled="readonly" @click="reset">
          <RotateCcw :size="14" aria-hidden="true" />
          <span>{{ locale.t('theme.reset', 'Restore defaults') }}</span>
        </ElButton>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint detached :label="locale.t('theme.applyHint', 'Apply theme changes to all pages in this project')" :disabled-reason="applyUnavailableReason">
        <ElButton type="primary" native-type="button" :disabled="readonly || !dirty" @click="apply">
          <Check :size="14" aria-hidden="true" />
          <span>{{ locale.t('action.apply', 'Apply') }}</span>
        </ElButton>
      </WorkbenchCommandHint>
    </footer>
  </section>
</template>
