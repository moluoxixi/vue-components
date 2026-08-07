import type { App, VNodeChild } from 'vue'
import type {
  HeadlessTableCellScope,
  HeadlessTableHeaderScope,
  HeadlessTableRendererOptions,
  HeadlessTableRow,
} from './table'

export interface HeadlessTableRendererDefinition<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TProps extends Record<string, any> = Record<string, any>,
  TOptions = any,
> {
  renderDefault?: (
    renderOptions: HeadlessTableRendererOptions<TProps, TOptions>,
    params: HeadlessTableCellScope<TRow>,
  ) => VNodeChild
  renderHeader?: (
    renderOptions: HeadlessTableRendererOptions<TProps, TOptions>,
    params: HeadlessTableHeaderScope<TRow>,
  ) => VNodeChild
}

export type HeadlessTableRendererMap<TRow extends HeadlessTableRow = HeadlessTableRow>
  = Record<string, HeadlessTableRendererDefinition<TRow>>

export interface HeadlessTableRendererRegistry {
  add: <TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ) => this
  replace: <TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ) => this
  mixin: (renderers: HeadlessTableRendererMap<any>, options?: { replace?: boolean }) => this
  get: (name: string) => HeadlessTableRendererDefinition<any> | undefined
  has: (name: string) => boolean
  delete: (name: string) => boolean
  clear: () => void
}

export interface HeadlessTableRendererPluginOptions {
  /** Reuse an existing registry when several apps or adapters share one. */
  registry?: HeadlessTableRendererRegistry
  /** Register these renderers during plugin installation. */
  renderers?: HeadlessTableRendererMap<any>
  /** Replace existing names instead of throwing on duplicate registration. */
  replace?: boolean
}

export interface HeadlessTableRendererPlugin {
  registry: HeadlessTableRendererRegistry
  install: (app: App) => void
}
