import type {
  HeadlessTableColumnPreferences,
  HeadlessTableColumnPreferencesOptions,
  HeadlessTablePersistence,
  HeadlessTablePersistenceError,
  HeadlessTablePreferencesStorage,
} from '../types'
import { getCurrentInstance, onBeforeUnmount, onMounted, toValue, watch } from 'vue'

const stateKeys = ['columnOrder', 'columnVisibility', 'columnWidths'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Only persist known identities and JSON-safe values, never column definitions or row data. */
export function normalizeHeadlessTableColumnPreferences(value: unknown, ids: readonly string[]): HeadlessTableColumnPreferences {
  const source = isRecord(value) ? value : {}
  const known = new Set(ids)
  const visibility = isRecord(source.columnVisibility) ? source.columnVisibility : {}
  const widths = isRecord(source.columnWidths) ? source.columnWidths : {}
  return {
    columnOrder: Array.isArray(source.columnOrder)
      ? [...new Set(source.columnOrder.filter((id): id is string => typeof id === 'string' && known.has(id)))]
      : [],
    columnVisibility: Object.fromEntries(Object.entries(visibility).filter(([id, visible]) => known.has(id) && typeof visible === 'boolean')) as Record<string, boolean>,
    columnWidths: Object.fromEntries(Object.entries(widths).filter(([id, width]) => known.has(id) && typeof width === 'number' && Number.isFinite(width) && width > 0)) as Record<string, number>,
  }
}

/** Shared by the headless state hook and the ConfigTable adapter. */
export function useHeadlessTableColumnPreferences(options: HeadlessTableColumnPreferencesOptions) {
  const defaults: HeadlessTableColumnPreferences = {
    columnOrder: [...(options.initialState?.columnOrder ?? [])],
    columnVisibility: { ...options.initialState?.columnVisibility },
    columnWidths: { ...options.initialState?.columnWidths },
  }
  let ready = !getCurrentInstance()
  let loaded = false
  let lastSnapshot = ''
  let activeConfig: HeadlessTablePersistence | undefined

  function snapshot(): HeadlessTableColumnPreferences {
    return normalizeHeadlessTableColumnPreferences({
      columnOrder: options.state.columnOrder.value,
      columnVisibility: options.state.columnVisibility.value,
      columnWidths: options.state.columnWidths.value,
    }, toValue(options.columnIds))
  }

  function config() {
    const persistence = toValue(options.persistence)
    return persistence && persistence.key.trim() ? persistence : undefined
  }

  function storage(): HeadlessTablePreferencesStorage | undefined {
    const selected = activeConfig?.storage ?? 'local'
    if (typeof selected === 'object')
      return selected
    if (typeof window === 'undefined')
      return undefined
    return selected === 'session' ? window.sessionStorage : window.localStorage
  }

  function storageKey(): string {
    return `mx-table:${activeConfig?.key ?? ''}`
  }

  function report(operation: HeadlessTablePersistenceError['operation'], error: unknown): void {
    options.onPersistenceError?.({
      key: activeConfig?.key ?? '',
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
    })
  }

  function assign(value: HeadlessTableColumnPreferences, respectControlled = false): void {
    const controlled = respectControlled ? options.controlled?.() : undefined
    if (!controlled?.columnOrder)
      options.state.columnOrder.value = [...value.columnOrder]
    if (!controlled?.columnVisibility)
      options.state.columnVisibility.value = { ...value.columnVisibility }
    if (!controlled?.columnWidths)
      options.state.columnWidths.value = { ...value.columnWidths }
    lastSnapshot = JSON.stringify(snapshot())
  }

  function restore(): void {
    if (!ready)
      return
    // Flush the previous scope before switching accounts, even within the same Vue tick.
    save()
    const nextConfig = config()
    activeConfig = nextConfig ? { ...nextConfig } : undefined
    const ids = toValue(options.columnIds)
    // Async schemas must not erase preferences while their columns are still loading.
    loaded = ids.length > 0
    if (!loaded)
      return
    let restored: unknown = defaults
    if (activeConfig) {
      try {
        const raw = storage()?.getItem(storageKey())
        if (raw) {
          const saved: unknown = JSON.parse(raw)
          if (isRecord(saved) && saved.version === (activeConfig.version ?? 1) && isRecord(saved.state)) {
            const normalized = normalizeHeadlessTableColumnPreferences(saved.state, ids)
            restored = {
              columnOrder: Array.isArray(saved.state.columnOrder) ? normalized.columnOrder : defaults.columnOrder,
              columnVisibility: { ...defaults.columnVisibility, ...normalized.columnVisibility },
              columnWidths: { ...defaults.columnWidths, ...normalized.columnWidths },
            }
          }
        }
      }
      catch (error) {
        report('read', error)
      }
    }
    assign(normalizeHeadlessTableColumnPreferences(restored, ids), true)
  }

  function save(): void {
    if (!ready || !loaded || !activeConfig || toValue(options.columnIds).length === 0)
      return
    const state = snapshot()
    const serialized = JSON.stringify(state)
    if (serialized === lastSnapshot)
      return
    try {
      storage()?.setItem(storageKey(), JSON.stringify({ version: activeConfig.version ?? 1, state }))
      lastSnapshot = serialized
    }
    catch (error) {
      report('write', error)
    }
  }

  function resetColumnSettings(): void {
    assign(normalizeHeadlessTableColumnPreferences(defaults, toValue(options.columnIds)))
    if (ready && activeConfig) {
      try {
        storage()?.removeItem(storageKey())
      }
      catch (error) {
        report('remove', error)
      }
    }
  }

  watch(() => [config()?.key, config()?.version, config()?.storage], restore, { immediate: true, flush: 'sync' })
  watch(() => [...toValue(options.columnIds)], () => {
    if (!loaded) {
      restore()
    }
    else if (ready && toValue(options.columnIds).length > 0) {
      // Removed identities are pruned; newly added columns retain their source defaults.
      const previous = lastSnapshot
      assign(snapshot())
      lastSnapshot = previous
      save()
    }
  })
  watch(stateKeys.map(key => options.state[key]), save, { deep: true, flush: 'post' })
  if (!ready) {
    onBeforeUnmount(save)
    onMounted(() => {
      ready = true
      restore()
    })
  }
  return { resetColumnSettings }
}
