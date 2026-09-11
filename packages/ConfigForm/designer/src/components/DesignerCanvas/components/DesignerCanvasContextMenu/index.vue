<script setup lang="ts">
import type { DesignerNodeAction } from '../../../DesignSurface/types'
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  Scissors,
  Trash2,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { useDesignerLocale } from '../../../../locale'

const props = defineProps<{
  nodeId: string
  pasteAvailable: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  action: [action: DesignerNodeAction, nodeId: string]
  close: []
}>()

const locale = useDesignerLocale()
const menuRef = useTemplateRef<HTMLElement>('menu')

interface ContextMenuItem {
  action: DesignerNodeAction
  danger?: boolean
  disabled?: boolean
  divider?: boolean
  icon: unknown
  label: string
}

const items = computed<ContextMenuItem[]>(() => [
  { action: 'copyToClipboard', icon: ClipboardCopy, label: locale.t('node.clipboardCopy', 'Copy') },
  { action: 'cut', icon: Scissors, label: locale.t('node.cut', 'Cut') },
  { action: 'paste', disabled: !props.pasteAvailable, icon: ClipboardPaste, label: locale.t('node.paste', 'Paste') },
  { action: 'copy', divider: true, icon: Copy, label: locale.t('node.duplicate', 'Duplicate') },
  { action: 'moveBefore', divider: true, icon: ChevronUp, label: locale.t('node.moveUp', 'Move up') },
  { action: 'moveAfter', icon: ChevronDown, label: locale.t('node.moveDown', 'Move down') },
  { action: 'indent', icon: CornerDownRight, label: locale.t('node.indent', 'Indent') },
  { action: 'outdent', icon: CornerDownLeft, label: locale.t('node.outdent', 'Outdent') },
  { action: 'remove', danger: true, divider: true, icon: Trash2, label: locale.t('node.delete', 'Delete') },
])

// Clamp against the viewport so the menu never opens half off-screen.
const menuStyle = computed(() => ({
  left: `${Math.min(props.x, Math.max(8, window.innerWidth - 200))}px`,
  top: `${Math.min(props.y, Math.max(8, window.innerHeight - items.value.length * 34 - 16))}px`,
}))

function runItem(item: ContextMenuItem): void {
  if (item.disabled)
    return
  emit('action', item.action, props.nodeId)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
    return
  const buttons = [...(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  if (buttons.length === 0)
    return
  event.preventDefault()
  const current = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement))
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? buttons.length - 1
      : event.key === 'ArrowDown'
        ? (current + 1) % buttons.length
        : (current - 1 + buttons.length) % buttons.length
  buttons[next]?.focus({ preventScroll: true })
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (event.target instanceof Node && menuRef.value?.contains(event.target))
    return
  emit('close')
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  void nextTick(() => menuRef.value?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown, true))
</script>

<template>
  <div
    ref="menu"
    class="mx-config-form-designer__context-menu"
    data-designer-context-menu
    role="menu"
    :aria-label="locale.t('node.actions', 'Node actions')"
    :style="menuStyle"
    @keydown="handleKeydown"
    @contextmenu.prevent
  >
    <template v-for="item in items" :key="item.action">
      <hr v-if="item.divider" class="mx-config-form-designer__context-menu-divider" aria-hidden="true">
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        :class="{ 'is-danger': item.danger }"
        :disabled="item.disabled"
        @click.stop="runItem(item)"
      >
        <component :is="item.icon" :size="15" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>
