import { computed, onBeforeUnmount, ref } from 'vue'

type Panel = 'palette' | 'properties'
const storageKey = 'config-form.designer.panel-sizes.v1'
const defaults = { palette: 272, properties: 332 }

export function useDesignPanelSizes() {
  const widths = ref({ ...defaults })
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    for (const key of ['palette', 'properties'] as const) {
      if (Number.isFinite(saved[key]))
        widths.value[key] = Math.max(220, Math.min(480, saved[key]))
    }
  }
  catch {
    /* Layout preferences are optional in restricted storage contexts. */
  }
  let cleanup: (() => void) | undefined
  function save(): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths.value))
    }
    catch {
      /* The current session remains usable without storage. */
    }
  }
  function setWidth(panel: Panel, value: number): void {
    widths.value = { ...widths.value, [panel]: Math.max(220, Math.min(480, value)) }
  }
  function startResize(event: PointerEvent, panel: Panel): void {
    if (event.button !== 0)
      return
    event.preventDefault()
    cleanup?.()
    const start = event.clientX
    const width = widths.value[panel]
    const move = (next: PointerEvent) =>
      setWidth(panel, width + (next.clientX - start) * (panel === 'palette' ? 1 : -1))
    const end = () => {
      cleanup?.()
      save()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
    const cursor = document.body.style.cursor
    const selection = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      document.body.style.cursor = cursor
      document.body.style.userSelect = selection
      cleanup = undefined
    }
  }
  function resizeWithKeyboard(event: KeyboardEvent, panel: Panel): void {
    if (event.key === 'Home') {
      setWidth(panel, defaults[panel])
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      setWidth(
        panel,
        widths.value[panel]
        + (event.key === 'ArrowRight' ? 1 : -1) * (panel === 'palette' ? 1 : -1) * (event.shiftKey ? 40 : 10),
      )
    }
    else {
      return
    }
    event.preventDefault()
    save()
  }
  onBeforeUnmount(() => cleanup?.())
  return {
    widths,
    startResize,
    resizeWithKeyboard,
    panelStyle: computed(() => ({
      '--designer-palette-width': `${widths.value.palette}px`,
      '--designer-inspector-width': `${widths.value.properties}px`,
    })),
  }
}
