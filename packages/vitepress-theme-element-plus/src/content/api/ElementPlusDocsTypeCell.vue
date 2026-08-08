<script setup lang="ts">
import { ElTooltip } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  detail?: string
  type: string
  typeDetailsLabel: string
}>()

interface TooltipHandle {
  hide: (event?: Event) => void
  onOpen: (event?: Event, delay?: number) => void
}

const tooltipRef = ref<TooltipHandle>()
const touchVisible = ref(false)
const isMounted = ref(false)
const tooltip = computed(() => props.detail ?? (props.type.length > 42 ? props.type : ''))
const displayType = computed(() => {
  const normalized = props.type.replace(/\s+/g, ' ')
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized
})

onMounted(() => {
  isMounted.value = true
})

function hideTooltip(event?: Event): void {
  touchVisible.value = false
  tooltipRef.value?.hide(event)
}

function handlePointerDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' || !tooltip.value)
    return
  if (touchVisible.value)
    hideTooltip(event)
  else {
    tooltipRef.value?.onOpen(event)
    touchVisible.value = true
  }
}
</script>

<template>
  <ElTooltip
    v-if="tooltip"
    ref="tooltipRef"
    :content="tooltip"
    :trigger="['hover', 'focus']"
    :enterable="true"
    :hide-after="160"
    placement="top-start"
    effect="dark"
    popper-class="mx-type-tooltip"
    :teleported="isMounted"
    @hide="touchVisible = false"
  >
    <template #content>
      <span class="mx-type-tooltip-content">{{ tooltip }}</span>
    </template>
    <button
      type="button"
      class="type-cell type-cell-trigger"
      :aria-label="typeDetailsLabel"
      @pointerdown="handlePointerDown"
      @keydown.esc.stop.prevent="hideTooltip($event)"
    >
      <span class="type-cell-text">{{ displayType }}</span>
    </button>
  </ElTooltip>
  <span v-else class="type-cell">
    <span class="type-cell-text type-cell-text-static">{{ displayType }}</span>
  </span>
</template>

<style scoped>
.type-cell {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  color: var(--mx-type, var(--el-color-primary));
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.55;
  text-align: left;
}

.type-cell-trigger {
  padding: 0;
  border: 0;
  border-bottom: 1px dashed currentcolor;
  border-radius: 0;
  background: transparent;
  cursor: help;
}

.type-cell-trigger:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--brand-color);
  outline-offset: 3px;
}

.type-cell-text-static {
  border-bottom: 0;
}
</style>

<style>
.el-popper.mx-type-tooltip {
  max-width: min(560px, calc(100vw - 32px));
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  user-select: text;
}

.mx-type-tooltip-content {
  display: block;
  max-height: min(440px, calc(100vh - 42px));
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: anywhere;
  overscroll-behavior: contain;
  scrollbar-color: var(--border-color) transparent;
  scrollbar-width: thin;
  white-space: pre-wrap;
}
</style>
