import type {
  DesignerOption,
  DesignerOptionProvider,
  DesignerOptionProviderContext,
  DesignerOptionResolverConfig,
  DesignerOptionSource,
  DesignerOptionStatus,
  DesignerResolvedOptionState,
} from '@moluoxixi/config-form-designer'
import type { Ref } from 'vue'

export type AntdVueDesignerOption = DesignerOption
export type AntdVueOptionSource = DesignerOptionSource
export type AntdVueOptionStatus = DesignerOptionStatus
export type AntdVueResolvedOptionState = DesignerResolvedOptionState
export type AntdVueOptionProviderContext = DesignerOptionProviderContext
export type AntdVueOptionProvider = DesignerOptionProvider
export type AntdVueOptionResolverConfig = DesignerOptionResolverConfig

export interface AntdVueOptionResolverContext {
  dictionaries: Readonly<Record<string, readonly AntdVueDesignerOption[]>>
  providers: Readonly<Record<string, AntdVueOptionProvider>>
  dictionaryKeys: string[]
  providerKeys: string[]
  revision: Readonly<Ref<number>>
  readState: (source: AntdVueOptionSource) => AntdVueResolvedOptionState | undefined
  writeState: (source: AntdVueOptionSource, state: AntdVueResolvedOptionState) => void
}
