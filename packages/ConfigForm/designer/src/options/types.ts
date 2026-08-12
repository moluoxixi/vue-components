import type { DesignerJsonObject } from '../document'

export interface DesignerOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
}

export type DesignerOptionSource
  = | { kind: 'static' }
    | { kind: 'dictionary', key: string }
    | { kind: 'provider', key: string, params?: DesignerJsonObject }

export type DesignerOptionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DesignerResolvedOptionState {
  status: DesignerOptionStatus
  options: DesignerOption[]
  error?: string
}

export interface DesignerOptionProviderContext {
  key: string
  params?: DesignerJsonObject
  signal: AbortSignal
}

export type DesignerOptionProvider = (
  context: DesignerOptionProviderContext,
) => DesignerOption[] | Promise<DesignerOption[]>

export interface DesignerOptionResolverConfig {
  dictionaries?: Record<string, DesignerOption[]>
  providers?: Record<string, DesignerOptionProvider>
}
