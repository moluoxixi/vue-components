import type { ComputedRef } from 'vue'
import type { DatasetTableColumn } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

export function useDatasetColumnLayout(columns: ComputedRef<DatasetTableColumn[]>, scope: () => string) {
  const widths = ref<Record<string, number>>({})
  const hiddenPreferences = ref<string[]>([])
  const hidden = computed(() => columns.value.some(column => !hiddenPreferences.value.includes(column.key)) ? hiddenPreferences.value : [])
  const pinned = ref('')
  const storageKey = computed(() => `config-form.workbench.columns.${scope()}`)
  watch(storageKey, (key) => {
    widths.value = {}
    hiddenPreferences.value = []
    pinned.value = ''
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (saved.widths && typeof saved.widths === 'object') {
        widths.value = Object.fromEntries(Object.entries(saved.widths)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
          .map(([name, value]) => [name, Math.max(100, Math.min(800, value))]))
      }
      if (Array.isArray(saved.hidden))
        hiddenPreferences.value = saved.hidden.filter((value: unknown) => typeof value === 'string')
      if (typeof saved.pinned === 'string')
        pinned.value = saved.pinned
    }
    catch {
      // Column preferences never prevent access to the data.
    }
  }, { immediate: true })
  watch([widths, hiddenPreferences, pinned], () => {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify({ widths: widths.value, hidden: hiddenPreferences.value, pinned: pinned.value }))
    }
    catch {
      // Keep this session usable without persistent storage.
    }
  }, { deep: true })
  const displayed = computed(() => {
    const visible = columns.value.filter(column => !hidden.value.includes(column.key))
    // A stale preference must not hide every column in a changed dataset.
    const items = visible.length ? visible : columns.value
    return [...items].sort((a, b) => Number(b.key === pinned.value) - Number(a.key === pinned.value)).map(column => ({ ...column, width: widths.value[column.key] ?? column.width }))
  })
  function toggleVisible(key: string): void {
    if (hidden.value.includes(key))
      hiddenPreferences.value = hidden.value.filter(value => value !== key)
    else if (displayed.value.length > 1)
      hiddenPreferences.value = [...hidden.value, key]
  }
  function reset(): void {
    widths.value = {}
    hiddenPreferences.value = []
    pinned.value = ''
  }
  function fit(key?: string): void {
    if (key) {
      const next = { ...widths.value }
      delete next[key]
      widths.value = next
    }
    else {
      widths.value = {}
    }
  }
  function setWidth(key: string, width: number): void {
    widths.value = { ...widths.value, [key]: Math.max(100, Math.min(800, width)) }
  }
  let cleanup: (() => void) | undefined
  function resize(event: PointerEvent, column: DatasetTableColumn): void {
    if (event.button !== 0)
      return
    event.preventDefault()
    cleanup?.()
    const start = event.clientX
    const width = column.width
    const move = (next: PointerEvent) => setWidth(column.key, width + next.clientX - start)
    const cursor = document.body.style.cursor
    const selection = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const end = () => cleanup?.()
    cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      document.body.style.cursor = cursor
      document.body.style.userSelect = selection
      cleanup = undefined
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
  }
  function resizeWithKeyboard(event: KeyboardEvent, column: DatasetTableColumn): void {
    if (event.key === 'Home')
      fit(column.key)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      setWidth(column.key, column.width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 40 : 10))
    else
      return
    event.preventDefault()
  }
  onBeforeUnmount(() => cleanup?.())
  return { displayed, hidden, pinned, reset, fit, resize, resizeWithKeyboard, toggleVisible }
}
