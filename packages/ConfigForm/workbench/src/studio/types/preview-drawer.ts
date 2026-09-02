import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RuntimeHostRuntimeStatePayload } from '../../runtime-host'
import type {
  PagePreviewProjection,
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitResultEvent,
  PreviewSubmission,
} from '../../session'

export type PreviewViewport = 'desktop' | 'mobile' | 'tablet'

export interface PreviewDrawerProps {
  adapter?: WorkbenchAdapterId
  compilation?: PageCompilation
  configError?: string
  expanded?: boolean
  lastSubmission?: PreviewSubmission
  locale?: DesignerLocaleOptions
  namespace?: string
  open: boolean
  projection?: PagePreviewProjection
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  runtimeState: RuntimeHostRuntimeStatePayload
  state: { label: string, tone: 'error' | 'live' }
  viewport: PreviewViewport
}

export interface PreviewDrawerEmits {
  'clearSubmission': []
  'close': []
  'error': [error: unknown]
  'fieldChange': [payload: { field: string, values: Record<string, unknown> }]
  'message': [message: string]
  'ready': [event: PreviewRuntimeIdentity]
  'runtimeEvent': [payload: { event: string, nodeId: string }]
  'runtimeMounted': [event: PreviewRuntimeIdentity]
  'runtimeState': [event: PreviewRuntimeStateEvent]
  'submit': [values: Record<string, unknown>]
  'submitResult': [event: PreviewRuntimeSubmitResultEvent]
  'update:expanded': [expanded: boolean]
  'update:viewport': [viewport: PreviewViewport]
}
