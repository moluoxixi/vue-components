<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'

defineOptions({ name: 'WorkbenchCommandHint' })

const COMMAND_HINT_SHOWN_EVENT = 'workbench-command-hint-shown'

const props = defineProps<{
  anchorClass?: string
  detached?: boolean
  disabledReason?: string
  label: string
  shortcut?: string
}>()

const content = computed(() => [props.label, props.shortcut, props.disabledReason]
  .filter(Boolean)
  .join(' · '))
const suppressionRelease = ref<'blur' | 'mouseleave'>()
const suppressed = computed(() => suppressionRelease.value !== undefined)
const tooltip = ref<{
  onOpen: (event?: Event, delay?: number) => void
  onClose: (event?: Event, delay?: number) => void
  popperRef?: { triggerRef?: Element }
}>()
const instanceToken = {}
let triggerElement: Element | undefined

function hideTooltip(event?: Event): void {
  tooltip.value?.onClose(event, 0)
}

function openDetachedTooltip(event: FocusEvent): void {
  if (props.detached)
    tooltip.value?.onOpen(event)
}

function closeDetachedTooltip(event: FocusEvent): void {
  if (props.detached)
    tooltip.value?.onClose(event)
}

function suppressAfterCommand(event: Event): void {
  suppressionRelease.value = event instanceof MouseEvent && event.detail > 0
    ? 'mouseleave'
    : 'blur'
  void nextTick(() => hideTooltip(event))
}

function hideOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape')
    hideTooltip(event)
}

function releaseSuppression(source: 'blur' | 'mouseleave'): void {
  if (suppressionRelease.value === source)
    suppressionRelease.value = undefined
}

function releaseAfterBlur(): void {
  releaseSuppression('blur')
}

function releaseAfterMouseleave(): void {
  releaseSuppression('mouseleave')
}

function announceShow(): void {
  document.dispatchEvent(new CustomEvent(COMMAND_HINT_SHOWN_EVENT, { detail: instanceToken }))
}

function hideForPeer(event: Event): void {
  if ((event as CustomEvent).detail !== instanceToken)
    hideTooltip(event)
}

function unbindTrigger(): void {
  triggerElement?.removeEventListener('blur', releaseAfterBlur, true)
  triggerElement?.removeEventListener('click', suppressAfterCommand, true)
  triggerElement?.removeEventListener('mouseleave', releaseAfterMouseleave)
  triggerElement = undefined
}

function bindTrigger(): void {
  const nextTrigger = tooltip.value?.popperRef?.triggerRef
  if (nextTrigger === triggerElement)
    return
  unbindTrigger()
  triggerElement = nextTrigger
  triggerElement?.addEventListener('blur', releaseAfterBlur, true)
  triggerElement?.addEventListener('click', suppressAfterCommand, true)
  triggerElement?.addEventListener('mouseleave', releaseAfterMouseleave)
}

onMounted(() => {
  document.addEventListener(COMMAND_HINT_SHOWN_EVENT, hideForPeer)
  document.addEventListener('keydown', hideOnEscape)
  void nextTick(bindTrigger)
})
onUpdated(bindTrigger)
onBeforeUnmount(() => {
  document.removeEventListener(COMMAND_HINT_SHOWN_EVENT, hideForPeer)
  document.removeEventListener('keydown', hideOnEscape)
  unbindTrigger()
})
</script>

<template>
  <ElTooltip
    ref="tooltip"
    :content="content"
    :disabled="suppressed"
    effect="light"
    :trigger="['hover', 'focus']"
    placement="bottom"
    :fallback-placements="['top', 'right', 'left']"
    :show-after="350"
    :hide-after="0"
    :enterable="false"
    :persistent="false"
    append-to="#workbench-overlays"
    popper-class="workbench-passive-tooltip workbench-command-tooltip"
    @before-show="announceShow"
  >
    <span
      v-if="detached"
      class="workbench-command-hint-anchor"
      :class="anchorClass"
      @focusin="openDetachedTooltip"
      @focusout="closeDetachedTooltip"
    ><slot /></span>
    <slot v-else />
  </ElTooltip>
</template>
