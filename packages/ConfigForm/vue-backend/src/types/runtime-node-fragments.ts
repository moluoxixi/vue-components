import type { ConfigFormRendererNode } from '@moluoxixi/config-form'
import type { VueRuntimeDiagnostic } from './runtime'

export interface RuntimeNodeFragmentCacheEntry {
  diagnostics: readonly VueRuntimeDiagnostic[]
  flowEventsKey: string
  node: ConfigFormRendererNode
}
