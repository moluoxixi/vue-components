<script setup lang="ts">
import type { HeadlessCopyTextExpose } from '../../HeadlessCopyText'
import type { CopyTextEmits, CopyTextExpose, CopyTextProps, CopyTextSlots } from './types'
import { Check, Clipboard, LoaderCircle } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import HeadlessCopyText from '../../HeadlessCopyText/src/index.vue'

defineOptions({ name: 'CopyText' })

const props = withDefaults(defineProps<CopyTextProps>(), {
  copiedLabel: '已复制',
  copyLabel: '复制',
  disabled: false,
  resetDelay: 2000,
})

const emit = defineEmits<CopyTextEmits>()
defineSlots<CopyTextSlots>()

const headlessRef = useTemplateRef<HeadlessCopyTextExpose>('headlessRef')

async function copy(text?: string): Promise<void> {
  await headlessRef.value?.copy(text)
}

function reset(): void {
  headlessRef.value?.reset()
}

defineExpose<CopyTextExpose>({ copy, reset })
</script>

<template>
  <HeadlessCopyText
    ref="headlessRef"
    :text="props.text"
    :disabled="props.disabled"
    :reset-delay="props.resetDelay"
    @copy="emit('copy', $event)"
    @error="emit('error', $event)"
  >
    <template #default="scope">
      <span class="mx-copy-text" :class="{ 'is-disabled': scope.disabled }">
        <span class="mx-copy-text__content">
          <slot :text="scope.text">
            {{ scope.text }}
          </slot>
        </span>
        <button
          class="mx-copy-text__button"
          type="button"
          :aria-label="scope.copied ? props.copiedLabel : props.copyLabel"
          :disabled="scope.disabled || scope.copying"
          :title="scope.copied ? props.copiedLabel : props.copyLabel"
          @click="scope.copy().catch(() => undefined)"
        >
          <slot name="icon" v-bind="scope">
            <LoaderCircle v-if="scope.copying" class="mx-copy-text__spinner" :size="16" aria-hidden="true" />
            <Check v-else-if="scope.copied" :size="16" aria-hidden="true" />
            <Clipboard v-else :size="16" aria-hidden="true" />
          </slot>
        </button>
        <span class="mx-copy-text__status" role="status" aria-live="polite">
          {{ scope.copied ? props.copiedLabel : scope.error?.message ?? '' }}
        </span>
      </span>
    </template>
  </HeadlessCopyText>
</template>

<style scoped>
.mx-copy-text {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--mx-copy-text-color, currentColor);
}

.mx-copy-text__content {
  min-width: 0;
  overflow-wrap: anywhere;
}

.mx-copy-text__button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--mx-copy-text-action-color, #475569);
  cursor: pointer;
}

.mx-copy-text__button:hover:not(:disabled) {
  background: var(--mx-copy-text-hover-bg, #f1f5f9);
  color: var(--mx-copy-text-action-hover-color, #0f766e);
}

.mx-copy-text__button:focus-visible {
  outline: 2px solid var(--mx-copy-text-focus-color, #0f766e);
  outline-offset: 2px;
}

.mx-copy-text__button:disabled,
.mx-copy-text.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.mx-copy-text__spinner {
  animation: mx-copy-text-spin 0.8s linear infinite;
}

.mx-copy-text__status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes mx-copy-text-spin {
  to { transform: rotate(360deg); }
}
</style>
