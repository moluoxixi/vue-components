import type { DesignerJsonObject } from '@moluoxixi/config-form-designer'

export interface AntdVueDesignerOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
}

export type AntdVueOptionSource
  = | { kind: 'static' }
    | { kind: 'dictionary', key: string }
    | { kind: 'provider', key: string, params?: DesignerJsonObject }

export type AntdVueOptionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AntdVueResolvedOptionState {
  status: AntdVueOptionStatus
  options: AntdVueDesignerOption[]
  error?: string
}

export interface AntdVueOptionProviderContext {
  key: string
  params?: DesignerJsonObject
  signal: AbortSignal
}

export type AntdVueOptionProvider = (
  context: AntdVueOptionProviderContext,
) => AntdVueDesignerOption[] | Promise<AntdVueDesignerOption[]>

export interface AntdVueOptionResolverConfig {
  dictionaries?: Record<string, AntdVueDesignerOption[]>
  providers?: Record<string, AntdVueOptionProvider>
}
