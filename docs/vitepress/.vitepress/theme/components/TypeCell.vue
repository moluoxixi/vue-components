<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatDocsMessage } from '../../docs-i18n'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  type: string
  detail?: string
}>()

const { messages } = useDocsLocale()

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
      :aria-label="formatDocsMessage(messages.api.typeDetails, { type })"
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
