import type { MaybeRefOrGetter, Ref } from 'vue'

export type HeadlessTableColumnWidthsState = Record<string, number>

export interface HeadlessTableColumnPreferences {
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnWidths: HeadlessTableColumnWidthsState
}

/** Synchronous storage contract; browser Storage implements this interface. */
export interface HeadlessTablePreferencesStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface HeadlessTablePersistence {
  /** Stable business table key. Include tenant/user identity when preferences are personal. */
  key: string
  /** Change the version when column identities or preference semantics change. Default: 1. */
  version?: number
  /** Default: local. Storage access is deferred until mounted during SSR. */
  storage?: 'local' | 'session' | HeadlessTablePreferencesStorage
}

export interface HeadlessTablePersistenceError {
  key: string
  operation: 'read' | 'write' | 'remove'
  error: Error
}

export interface HeadlessTableColumnPreferencesOptions {
  columnIds: MaybeRefOrGetter<readonly string[]>
  state: { [K in keyof HeadlessTableColumnPreferences]: Ref<HeadlessTableColumnPreferences[K]> }
  initialState?: Partial<HeadlessTableColumnPreferences>
  /** External state wins over storage, independently for each state slice. */
  controlled?: () => Partial<Record<keyof HeadlessTableColumnPreferences, boolean>>
  persistence?: MaybeRefOrGetter<HeadlessTablePersistence | false | undefined>
  onPersistenceError?: (event: HeadlessTablePersistenceError) => void
}
