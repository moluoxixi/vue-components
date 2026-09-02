<script setup lang="ts">
import type { WorkbenchCommandTarget, WorkbenchCommandTooltipProps } from '../types'
import { onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<WorkbenchCommandTooltipProps>()

const activeTrigger = ref<HTMLElement>()
const content = ref('')
const visible = ref(false)
const tooltipContentId = useId()
let showTimer: ReturnType<typeof setTimeout> | undefined
let suppressTimer: ReturnType<typeof setTimeout> | undefined
let suppressedFocusTrigger: HTMLElement | undefined
let describedTrigger: HTMLElement | undefined

const virtualTrigger = {
  getBoundingClientRect: () => activeTrigger.value?.getBoundingClientRect()
    ?? document.documentElement.getBoundingClientRect(),
  get contextElement() {
    return activeTrigger.value
  },
}

function belongsToWorkbench(element: HTMLElement): boolean {
  return Boolean(props.root?.contains(element) || props.overlayRoot?.contains(element))
}

function commandTarget(target: EventTarget | null): WorkbenchCommandTarget | undefined {
  if (!(target instanceof Element))
    return undefined
  const direct = target.closest<HTMLElement>('[data-command-hint]')
  if (direct && belongsToWorkbench(direct))
    return { anchor: direct, metadata: direct }

  const focusable = target.closest<HTMLElement>('[role="tab"]')
  const metadata = focusable?.querySelector<HTMLElement>('[data-command-hint]')
  return focusable && metadata && belongsToWorkbench(focusable)
    ? { anchor: focusable, metadata }
    : undefined
}

function commandContent(target: WorkbenchCommandTarget): string {
  const label = target.metadata.getAttribute('aria-label') ?? target.metadata.dataset.commandLabel ?? ''
  const shortcut = target.metadata.dataset.commandShortcut
  const disabled = target.anchor.matches(':disabled, [aria-disabled="true"]')
    || target.metadata.matches(':disabled, [aria-disabled="true"]')
  const reason = disabled ? target.metadata.dataset.commandDisabledReason : undefined
  return [label, shortcut, reason].filter(Boolean).join(' · ')
}

function clearShowTimer(): void {
  if (showTimer !== undefined)
    clearTimeout(showTimer)
  showTimer = undefined
}

function clearTriggerDescription(): void {
  if (!describedTrigger)
    return
  const ids = (describedTrigger.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(id => id && id !== tooltipContentId)
  if (ids.length > 0)
    describedTrigger.setAttribute('aria-describedby', ids.join(' '))
  else
    describedTrigger.removeAttribute('aria-describedby')
  describedTrigger = undefined
}

function describeTrigger(trigger: HTMLElement): void {
  clearTriggerDescription()
  const ids = new Set((trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean))
  ids.add(tooltipContentId)
  trigger.setAttribute('aria-describedby', [...ids].join(' '))
  describedTrigger = trigger
}

function clearFocusHintSuppression(): void {
  if (suppressTimer !== undefined)
    clearTimeout(suppressTimer)
  suppressTimer = undefined
  suppressedFocusTrigger = undefined
}

function suppressFocusHint(trigger = activeTrigger.value): void {
  clearFocusHintSuppression()
  if (!trigger)
    return
  suppressedFocusTrigger = trigger
  suppressTimer = setTimeout(() => {
    suppressTimer = undefined
    suppressedFocusTrigger = undefined
  }, 500)
}

function hide(trigger?: HTMLElement): void {
  if (trigger && trigger !== activeTrigger.value)
    return
  clearShowTimer()
  visible.value = false
}

function show(target: WorkbenchCommandTarget, immediate: boolean): void {
  clearShowTimer()
  activeTrigger.value = target.anchor
  content.value = commandContent(target)
  if (immediate) {
    visible.value = true
    return
  }
  showTimer = setTimeout(() => {
    showTimer = undefined
    if (activeTrigger.value === target.anchor)
      visible.value = true
  }, 350)
}

function handlePointerOver(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || matchMedia('(pointer: coarse)').matches)
    return
  const target = commandTarget(event.target)
  if (!target || target.anchor === suppressedFocusTrigger
    || (event.relatedTarget instanceof Node && target.anchor.contains(event.relatedTarget)))
    return
  clearFocusHintSuppression()
  show(target, false)
}

function handlePointerOut(event: PointerEvent): void {
  const target = commandTarget(event.target)
  if (!target || (event.relatedTarget instanceof Node && target.anchor.contains(event.relatedTarget)))
    return
  clearFocusHintSuppression()
  if (!(document.activeElement instanceof Node && target.anchor.contains(document.activeElement)))
    hide(target.anchor)
}

function handleFocusIn(event: FocusEvent): void {
  const target = commandTarget(event.target)
  if (!target || target.anchor === suppressedFocusTrigger)
    return
  clearFocusHintSuppression()
  show(target, true)
}

function handleFocusOut(event: FocusEvent): void {
  const target = commandTarget(event.target)
  if (!target || (event.relatedTarget instanceof Node && target.anchor.contains(event.relatedTarget)))
    return
  hide(target.anchor)
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || commandTarget(event.target))
    return
  hide()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Tab') {
    clearFocusHintSuppression()
    return
  }
  if (event.key === 'Escape') {
    suppressFocusHint()
    hide()
  }
}

function handleClick(event: MouseEvent): void {
  const target = commandTarget(event.target)
  if (target || event.currentTarget === props.overlayRoot)
    suppressFocusHint(target?.anchor ?? activeTrigger.value)
  hide()
}

function attach(root?: HTMLElement | null): void {
  root?.addEventListener('pointerover', handlePointerOver)
  root?.addEventListener('pointerout', handlePointerOut)
  root?.addEventListener('pointermove', handlePointerMove)
  root?.addEventListener('focusin', handleFocusIn)
  root?.addEventListener('focusout', handleFocusOut)
  root?.addEventListener('keydown', handleKeydown)
  root?.addEventListener('click', handleClick)
}

function detach(root?: HTMLElement | null): void {
  root?.removeEventListener('pointerover', handlePointerOver)
  root?.removeEventListener('pointerout', handlePointerOut)
  root?.removeEventListener('pointermove', handlePointerMove)
  root?.removeEventListener('focusin', handleFocusIn)
  root?.removeEventListener('focusout', handleFocusOut)
  root?.removeEventListener('keydown', handleKeydown)
  root?.removeEventListener('click', handleClick)
}

watch(() => [props.root, props.overlayRoot] as const, (roots, previousRoots) => {
  previousRoots?.forEach(detach)
  hide()
  clearFocusHintSuppression()
  activeTrigger.value = undefined
  roots.forEach(attach)
}, { immediate: true })

watch(() => [visible.value, activeTrigger.value] as const, ([isVisible, trigger]) => {
  if (isVisible && trigger)
    describeTrigger(trigger)
  else
    clearTriggerDescription()
}, { flush: 'post' })

onBeforeUnmount(() => {
  detach(props.root)
  detach(props.overlayRoot)
  clearShowTimer()
  clearFocusHintSuppression()
  clearTriggerDescription()
})
</script>

<template>
  <ElTooltip
    :visible="visible && Boolean(activeTrigger)"
    :virtual-ref="virtualTrigger"
    virtual-triggering
    placement="bottom"
    :fallback-placements="['top', 'right', 'left']"
    :show-after="0"
    :hide-after="0"
    :enterable="false"
    :persistent="false"
    append-to="#workbench-overlays"
    popper-class="workbench-passive-tooltip workbench-command-tooltip"
  >
    <template #content>
      <span :id="tooltipContentId">{{ content }}</span>
    </template>
  </ElTooltip>
</template>
