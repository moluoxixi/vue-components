<script setup lang="ts">
import type { VisualStyleField } from '../../../../inspector'
import { RotateCcw } from '@lucide/vue'
import { ElColorPicker, ElInput, ElOption, ElSelect, ElTooltip } from 'element-plus'
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
const disabledReason = computed(() => props.disabled
  ? locale.t('visual.readonly', 'This property is read-only. Switch to an editable selection to change it.')
  : !props.canReset ? locale.t('visual.alreadyDefault', 'Already using the default. Set a custom value before resetting it.') : undefined)

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
  <ElTooltip
    :content="locale.t('visual.readonly', 'This property is read-only. Switch to an editable selection to change it.')"
    :disabled="!props.disabled"
    :trigger="['hover', 'focus']"
  >
    <div class="mx-config-form-designer__visual-field" :class="{ 'is-color': props.field.control === 'color' }" :data-visual-field="props.field.key">
      <div class="mx-config-form-designer__visual-label">
        <label :for="controlId">{{ props.label }}</label>
        <ElTooltip
          :content="disabledReason || locale.t('visual.resetField', 'Reset {field}', { field: props.label })"
          :trigger="['hover', 'focus']"
        >
          <span :tabindex="disabledReason ? 0 : undefined" :aria-label="disabledReason" style="display: inline-flex">
            <button
              type="button"
              :aria-label="locale.t('visual.resetField', 'Reset {field}', { field: props.label })"
              :title="locale.t('visual.resetField', 'Reset {field}', { field: props.label })"
              :disabled="props.disabled || !props.canReset"
              :style="props.disabled || !props.canReset ? { pointerEvents: 'none' } : undefined"
              @click="commit(undefined)"
            >
              <RotateCcw :size="11" aria-hidden="true" />
            </button>
          </span>
        </ElTooltip>
      </div>
      <ElInput
        v-if="props.field.control === 'length'"
        :id="controlId"
        :model-value="value ?? ''"
        :aria-label="props.label"
        :aria-invalid="props.error ? 'true' : undefined"
        :aria-describedby="props.error ? `${controlId}-error` : undefined"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        size="small"
        clearable
        @update:model-value="!props.disabled && emit('update:modelValue', $event)"
        @change="commit"
        @keydown.enter="commitOnEnter"
      />
      <div v-else-if="props.field.control === 'color'" class="mx-config-form-designer__visual-color">
        <ElColorPicker
          :model-value="color"
          :aria-label="locale.t('visual.customColor', 'Custom {field}', { field: props.label })"
          :disabled="props.disabled"
          color-format="hex"
          show-alpha
          size="small"
          @change="commit"
        />
        <ElSelect
          :id="controlId"
          :model-value="value"
          :aria-label="props.label"
          :placeholder="props.placeholder"
          :disabled="props.disabled"
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
        :aria-label="props.label"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        size="small"
        clearable
        @change="commit"
      >
        <ElOption
          v-for="option in props.field.options"
          :key="option.value"
          :value="option.value"
          :label="locale.t(`visual.option.${option.label}`, option.label)"
        />
      </ElSelect>
      <span v-if="props.error" :id="`${controlId}-error`" class="mx-config-form-designer__visual-error" role="status">{{ props.error }}</span>
    </div>
  </ElTooltip>
</template>
