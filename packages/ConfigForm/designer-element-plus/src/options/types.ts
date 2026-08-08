import type { DesignerJsonObject } from '@moluoxixi/config-form-designer'

export interface ElementPlusDesignerOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
}

export type ElementPlusOptionSource
  = | { kind: 'static' }
    | { kind: 'dictionary', key: string }
    | { kind: 'provider', key: string, params?: DesignerJsonObject }

export type ElementPlusOptionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ElementPlusResolvedOptionState {
  status: ElementPlusOptionStatus
  options: ElementPlusDesignerOption[]
  error?: string
}

export interface ElementPlusOptionProviderContext {
  key: string
  params?: DesignerJsonObject
  signal: AbortSignal
}

export type ElementPlusOptionProvider = (
  context: ElementPlusOptionProviderContext,
) => ElementPlusDesignerOption[] | Promise<ElementPlusDesignerOption[]>

export interface ElementPlusOptionResolverConfig {
  dictionaries?: Record<string, ElementPlusDesignerOption[]>
  providers?: Record<string, ElementPlusOptionProvider>
}
