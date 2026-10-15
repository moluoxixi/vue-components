<script setup lang="ts">
import type { SurfaceNode } from '@moluoxixi/config-form-model'
import type { VisualStyleField } from '../../../../inspector'
import { ChevronDown, RotateCcw } from '@lucide/vue'
import { ElColorPicker, ElInput, ElOption, ElSelect } from 'element-plus'
import { computed, nextTick, ref, useId, watch } from 'vue'
import {
  isVisualStyleEditable,
  parseVisualStyleValue,
  VISUAL_STYLE_COLOR_OPTIONS,
  VISUAL_STYLE_GROUPS,
  visualStyleValues,
} from '../../../../inspector'
import { useDesignerLocale } from '../../../../locale'

const props = defineProps<{ nodes: readonly SurfaceNode[], readonly?: boolean, query?: string }>()
const emit = defineEmits<{ update: [key: string, value: string | undefined] }>()
const locale = useDesignerLocale()
const editorId = useId()
const errors = ref(new Set<string>())
const lengthDrafts = ref<Record<string, string>>({})
const unsupported = computed(() => props.nodes.some(node => !isVisualStyleEditable(node)))
const disabled = computed(() => props.readonly || unsupported.value || props.nodes.length === 0)
const groups = computed(() => {
  const query = props.query?.trim().toLocaleLowerCase()
  return VISUAL_STYLE_GROUPS.map(group => ({
    ...group,
    label: locale.t(`visual.group.${group.key}`, group.label),
    fields: group.fields.filter(field => !query || [
      locale.t(`visual.${field.key}`, field.label),
      locale.t(`visual.group.${group.key}`, group.label),
      locale.t('visual.title', 'Design'),
    ].some(label => label.toLocaleLowerCase().includes(query))),
  })).filter(group => group.fields.length > 0)
})

watch(() => props.nodes, () => {
  errors.value = new Set()
  syncLengthDrafts()
}, { deep: true, immediate: true })

function label(field: VisualStyleField): string {
  return locale.t(`visual.${field.key}`, field.label)
}

function value(field: VisualStyleField): string | undefined {
  const current = visualStyleValues(props.nodes, field.key)
  if (current.mixed || current.value === undefined)
    return undefined
  return typeof current.value === 'number' || typeof current.value === 'string' ? String(current.value) : undefined
}

function placeholder(field: VisualStyleField): string {
  return visualStyleValues(props.nodes, field.key).mixed
    ? locale.t('visual.mixed', 'Mixed')
    : field.control === 'length'
      ? field.allowPercentage === false ? 'px / rem / em' : field.allowAuto ? 'auto / px / %' : 'px / % / rem'
      : locale.t('visual.default', 'Default')
}

function hasValue(field: VisualStyleField): boolean {
  return props.nodes.some(node => isVisualStyleEditable(node)
    && (node.props.style as Record<string, unknown> | undefined)?.[field.key] !== undefined)
}

function syncLengthDrafts(): void {
  lengthDrafts.value = Object.fromEntries(VISUAL_STYLE_GROUPS.flatMap(group => group.fields
    .filter(field => field.control === 'length')
    .map(field => [field.key, value(field) ?? ''])))
}

function updateLengthDraft(field: VisualStyleField, next: string): void {
  if (disabled.value)
    return
  lengthDrafts.value[field.key] = next
}

function commit(field: VisualStyleField, next: unknown): void {
  if (disabled.value)
    return
  const parsed = parseVisualStyleValue(field, next)
  const updatedErrors = new Set(errors.value)
  if (!parsed.valid) {
    updatedErrors.add(field.key)
    errors.value = updatedErrors
    void nextTick(syncLengthDrafts)
    return
  }
  updatedErrors.delete(field.key)
  errors.value = updatedErrors
  emit('update', field.key, parsed.value)
  // The parent can reject a command without changing its projected nodes.
  // Always reconcile local input drafts with the authoritative document.
  void nextTick(syncLengthDrafts)
}

function colorValue(field: VisualStyleField): string | undefined {
  const current = value(field)
  return current?.startsWith('#') ? current : undefined
}

function customColor(field: VisualStyleField): string | undefined {
  const current = value(field)
  return current && !VISUAL_STYLE_COLOR_OPTIONS.some(option => option.value === current) ? current : undefined
}
</script>

<template>
  <section v-if="groups.length" class="mx-config-form-designer__visual-style" data-visual-style>
    <header class="mx-config-form-designer__visual-heading">
      <strong>{{ locale.t('visual.title', 'Design') }}</strong>
      <span>{{ locale.t('visual.allViewports', 'All viewports') }}</span>
    </header>
    <p v-if="unsupported" class="mx-config-form-designer__visual-notice" role="status" data-visual-style-restricted>
      {{ locale.t('visual.unsupported', 'This selection contains styles controlled outside this panel. Visual editing is unavailable to preserve them.') }}
    </p>
    <template v-else>
      <p class="mx-config-form-designer__visual-scope">
        {{ locale.t('visual.scope', 'Styles apply to the component root at every viewport size. Clear a value to restore its default.') }}
      </p>
      <details v-for="group in groups" :key="group.key" :open="['size', 'spacing'].includes(group.key) || !!query" :data-visual-group="group.key">
        <summary><ChevronDown :size="13" aria-hidden="true" />{{ group.label }}</summary>
        <div class="mx-config-form-designer__visual-grid">
          <div v-for="field in group.fields" :key="field.key" class="mx-config-form-designer__visual-field" :class="{ 'is-color': field.control === 'color' }" :data-visual-field="field.key">
            <div class="mx-config-form-designer__visual-label">
              <label :for="`${editorId}-${field.key}`">{{ label(field) }}</label>
              <button
                type="button"
                :aria-label="locale.t('visual.resetField', 'Reset {field}', { field: label(field) })"
                :title="locale.t('visual.resetField', 'Reset {field}', { field: label(field) })"
                :disabled="disabled || !hasValue(field)"
                @click="commit(field, undefined)"
              ><RotateCcw :size="11" aria-hidden="true" /></button>
            </div>
            <ElInput
              v-if="field.control === 'length'"
              :id="`${editorId}-${field.key}`"
              :model-value="lengthDrafts[field.key]"
              :aria-label="label(field)"
              :aria-invalid="errors.has(field.key) ? 'true' : undefined"
              :aria-describedby="errors.has(field.key) ? `${editorId}-${field.key}-error` : undefined"
              :placeholder="placeholder(field)"
              :disabled="disabled"
              size="small"
              clearable
              @update:model-value="updateLengthDraft(field, $event)"
              @change="commit(field, $event)"
            />
            <div v-else-if="field.control === 'color'" class="mx-config-form-designer__visual-color">
              <ElColorPicker
                :model-value="colorValue(field)"
                :aria-label="locale.t('visual.customColor', 'Custom {field}', { field: label(field) })"
                :disabled="disabled"
                color-format="hex"
                show-alpha
                size="small"
                @change="commit(field, $event)"
              />
              <ElSelect
                :id="`${editorId}-${field.key}`"
                :model-value="value(field)"
                :aria-label="label(field)"
                :placeholder="placeholder(field)"
                :disabled="disabled"
                size="small"
                clearable
                @change="commit(field, $event)"
              >
                <ElOption v-if="customColor(field)" :value="customColor(field)!" :label="customColor(field)!" />
                <ElOption
                  v-for="option in VISUAL_STYLE_COLOR_OPTIONS"
                  :key="option.key"
                  :value="option.value"
                  :label="locale.t(`visual.color.${option.key}`, option.label)"
                />
              </ElSelect>
            </div>
            <ElSelect
              v-else
              :id="`${editorId}-${field.key}`"
              :model-value="value(field)"
              :aria-label="label(field)"
              :placeholder="placeholder(field)"
              :disabled="disabled"
              size="small"
              clearable
              @change="commit(field, $event)"
            >
              <ElOption v-for="option in field.options" :key="option.value" :value="option.value" :label="locale.t(`visual.option.${option.label}`, option.label)" />
            </ElSelect>
            <span v-if="errors.has(field.key)" :id="`${editorId}-${field.key}-error`" class="mx-config-form-designer__visual-error" role="status">
              {{ locale.t('visual.invalidLength', 'Use a number with px, %, rem, em, vw or vh.') }}
            </span>
          </div>
        </div>
      </details>
    </template>
  </section>
</template>
