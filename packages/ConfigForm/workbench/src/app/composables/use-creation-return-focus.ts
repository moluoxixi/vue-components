import { nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkbenchUiStore } from './context'

/**
 * Returns focus to the trigger that opened the routed creation workspace.
 *
 * The creation screen replaces the workspace, so the trigger is unmounted while
 * it is open. Each workspace view calls this on mount: when the route matches
 * the recorded origin, focus moves back to the stable `data-create-trigger`
 * element instead of being dropped on the document body.
 */
export function useCreationReturnFocus(): void {
  const ui = useWorkbenchUiStore()
  const route = useRoute()

  onMounted(async () => {
    const origin = ui.creationOrigin.value
    if (!origin?.focusKey)
      return
    if (origin.path !== route.fullPath) {
      ui.clearCreationOrigin()
      return
    }
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    document.querySelector<HTMLElement>(`[data-create-trigger="${origin.focusKey}"]`)?.focus()
    ui.clearCreationOrigin()
  })
}
