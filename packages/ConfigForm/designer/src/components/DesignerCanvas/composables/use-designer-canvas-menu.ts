import type { Ref } from 'vue'
import type { DesignerCanvasEmits } from '../types'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

interface UseDesignerCanvasMenuOptions {
  onAction: (...args: DesignerCanvasEmits['action']) => void
  readonly: () => boolean
  selectedId: () => string | undefined
  sheetRef: Ref<HTMLElement | undefined>
}

export function useDesignerCanvasMenu(options: UseDesignerCanvasMenuOptions) {
  const nodeActionMenuId = useId()
  const nodeActionMenuNodeId = ref<string>()

  function nodeActionMenuElement(): HTMLElement | undefined {
    return options.sheetRef.value?.querySelector<HTMLElement>('[data-node-action-menu]') ?? undefined
  }

  function nodeActionMenuTriggerElement(): HTMLButtonElement | undefined {
    return options.sheetRef.value?.querySelector<HTMLButtonElement>('[data-node-action-menu-trigger]') ?? undefined
  }

  function closeNodeActionMenu(restoreFocus = false): void {
    if (!nodeActionMenuNodeId.value)
      return
    nodeActionMenuNodeId.value = undefined
    if (restoreFocus)
      void nextTick(() => nodeActionMenuTriggerElement()?.focus({ preventScroll: true }))
  }

  async function toggleNodeActionMenu(nodeId: string): Promise<void> {
    if (nodeActionMenuNodeId.value === nodeId) {
      closeNodeActionMenu(true)
      return
    }
    nodeActionMenuNodeId.value = nodeId
    await nextTick()
    nodeActionMenuElement()?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
  }

  function runNodeAction(...args: DesignerCanvasEmits['action']): void {
    closeNodeActionMenu()
    options.onAction(...args)
    void nextTick(() => nodeActionMenuTriggerElement()?.focus({ preventScroll: true }))
  }

  function moveMenuFocus(event: KeyboardEvent, container: HTMLElement, selector: string): boolean {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
      return false
    const items = [...container.querySelectorAll<HTMLButtonElement>(selector)]
    if (items.length === 0)
      return false
    event.preventDefault()
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : forward
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length
    items[next]?.focus({ preventScroll: true })
    return true
  }

  function handleNodeActionMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeNodeActionMenu(true)
      return
    }
    moveMenuFocus(event, event.currentTarget as HTMLElement, '[role="menuitem"]:not(:disabled)')
  }

  function handleNodeToolbarKeydown(event: KeyboardEvent): void {
    if (event.target instanceof Element && event.target.closest('[role="menu"]'))
      return
    moveMenuFocus(event, event.currentTarget as HTMLElement, '[data-node-toolbar-button]:not(:disabled)')
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    if (!nodeActionMenuNodeId.value || !(event.target instanceof Node))
      return
    if (nodeActionMenuElement()?.contains(event.target) || nodeActionMenuTriggerElement()?.contains(event.target))
      return
    closeNodeActionMenu()
  }

  watch(options.selectedId, () => closeNodeActionMenu())
  watch(options.readonly, (readonly) => {
    if (readonly)
      closeNodeActionMenu()
  })

  onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
  onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown))

  return {
    closeNodeActionMenu,
    handleNodeActionMenuKeydown,
    handleNodeToolbarKeydown,
    nodeActionMenuId,
    nodeActionMenuNodeId,
    runNodeAction,
    toggleNodeActionMenu,
  }
}
