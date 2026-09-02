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

export type ElementPlusDesignerOption = DesignerOption
export type ElementPlusOptionSource = DesignerOptionSource
export type ElementPlusOptionStatus = DesignerOptionStatus
export type ElementPlusResolvedOptionState = DesignerResolvedOptionState
export type ElementPlusOptionProviderContext = DesignerOptionProviderContext
export type ElementPlusOptionProvider = DesignerOptionProvider
export type ElementPlusOptionResolverConfig = DesignerOptionResolverConfig

export interface ElementPlusOptionResolverContext {
  dictionaries: Readonly<Record<string, readonly ElementPlusDesignerOption[]>>
  providers: Readonly<Record<string, ElementPlusOptionProvider>>
  dictionaryKeys: string[]
  providerKeys: string[]
  revision: Readonly<Ref<number>>
  readState: (source: ElementPlusOptionSource) => ElementPlusResolvedOptionState | undefined
  writeState: (source: ElementPlusOptionSource, state: ElementPlusResolvedOptionState) => void
}
