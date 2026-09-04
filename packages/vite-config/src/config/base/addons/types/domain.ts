import type { UserConfig } from 'vite'
import type { VitestAddonOptions } from '../../../../addons'
import type { AddonName } from '../../../../types'

export interface AddonContext {
  addonDeps: Record<string, string>
  root: string
  deps: Record<string, string>
  runtimeDeps: Record<string, string>
  hasAddonDep: (name: string) => boolean
  hasDep: (name: string) => boolean
  hasRuntimeDep: (name: string) => boolean
  hasAnyAddonDep: (names: string[]) => boolean
  hasAnyDep: (names: string[]) => boolean
  hasAnyRuntimeDep: (names: string[]) => boolean
  importRequired: <T = unknown>(owner: string, specifier: string) => Promise<T>
  requireDeps: (owner: string, deps: string[]) => void
  resolvePath: (...segments: string[]) => string
}

export interface AddonUserConfig extends UserConfig {
  test?: VitestAddonOptions
}

export interface ViteFeature<TOptions = unknown, TState = unknown> {
  name: AddonName
  dependsOn?: AddonName[]
  triggers: string[]
  requires?: string[]
  createState?: (ctx: AddonContext, options?: TOptions) => TState
  setup: (ctx: AddonContext, options: TOptions | undefined, state: TState) => AddonUserConfig | Promise<AddonUserConfig>
}

export type ViteFeatureEnableReason
  = | 'dependency-detected'
    | 'explicit-disabled'
    | 'explicit-enabled'
    | 'dependency-missing'

export interface ViteFeatureInspection {
  name: AddonName
  dependsOn: AddonName[]
  enabled: boolean
  reason: ViteFeatureEnableReason
  triggers: string[]
  matchedTriggers: string[]
  requires: string[]
  missingRequires: string[]
}

export interface ViteFeatureInspectionResult {
  root: string
  features: ViteFeatureInspection[]
}
