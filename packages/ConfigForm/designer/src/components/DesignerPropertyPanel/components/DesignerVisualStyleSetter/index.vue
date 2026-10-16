<script setup lang="ts">
import type { VisualStyleField } from '../../../../inspector'
import { RotateCcw } from '@lucide/vue'
import { ElColorPicker, ElInput, ElOption, ElSelect } from 'element-plus'
import { computed, useId } from 'vue'
import { VISUAL_STYLE_COLOR_OPTIONS } from '../../../../inspector'
import { useDesignerLocale } from '../../../../locale'

const props = defineProps<{
  modelValue?: string | number
  field: VisualStyleField
  label: string
  placeholder: string
  canReset: boolean
  disabled?: boolean
  error?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
  'commit': [value: unknown]
}>()
const locale = useDesignerLocale()
const controlId = useId()
const value = computed(() => props.modelValue === undefined ? undefined : String(props.modelValue))
const color = computed(() => value.value?.startsWith('#') ? value.value : undefined)
const customColor = computed(() => value.value && !VISUAL_STYLE_COLOR_OPTIONS.some(option => option.value === value.value)
  ? value.value
  : undefined)

function commit(next: string | null | undefined): void {
  if (props.disabled)
    return
  emit('update:modelValue', next ?? undefined)
  emit('commit', next)
}

function commitOnEnter(event: Event): void {
  event.preventDefault()
  ;(event.target as HTMLElement).blur()
}
</script>

<template>
  <div class="mx-config-form-designer__visual-field" :class="{ 'is-color': field.control === 'color' }" :data-visual-field="field.key">
    <div class="mx-config-form-designer__visual-label">
      <label :for="controlId">{{ label }}</label>
      <button
        type="button"
        :aria-label="locale.t('visual.resetField', 'Reset {field}', { field: label })"
        :title="locale.t('visual.resetField', 'Reset {field}', { field: label })"
        :disabled="disabled || !canReset"
        @click="commit(undefined)"
      ><RotateCcw :size="11" aria-hidden="true" /></button>
    </div>
    <ElInput
      v-if="field.control === 'length'"
      :id="controlId"
      :model-value="value ?? ''"
      :aria-label="label"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${controlId}-error` : undefined"
      :placeholder="placeholder"
      :disabled="disabled"
      size="small"
      clearable
      @update:model-value="!disabled && emit('update:modelValue', $event)"
      @change="commit"
      @keydown.enter="commitOnEnter"
    />
    <div v-else-if="field.control === 'color'" class="mx-config-form-designer__visual-color">
      <ElColorPicker
        :model-value="color"
        :aria-label="locale.t('visual.customColor', 'Custom {field}', { field: label })"
        :disabled="disabled"
        color-format="hex"
        show-alpha
        size="small"
        @change="commit"
      />
      <ElSelect
        :id="controlId"
        :model-value="value"
        :aria-label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        size="small"
        clearable
        @change="commit"
      >
        <ElOption v-if="customColor" :value="customColor" :label="customColor" />
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
      :id="controlId"
      :model-value="value"
      :aria-label="label"
      :placeholder="placeholder"
      :disabled="disabled"
      size="small"
      clearable
      @change="commit"
    >
      <ElOption v-for="option in field.options" :key="option.value" :value="option.value" :label="locale.t(`visual.option.${option.label}`, option.label)" />
    </ElSelect>
    <span v-if="error" :id="`${controlId}-error`" class="mx-config-form-designer__visual-error" role="status">{{ error }}</span>
  </div>
</template>
