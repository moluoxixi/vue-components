import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormDataSourceHost,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PreviewRuntimeFieldChangeEvent,
  RuntimeHostRuntimeStatePayload,
} from '../../runtime-host'
import type {
  PagePreviewProjection,
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitEvent,
  PreviewRuntimeSubmitResultEvent,
  PreviewSubmission,
} from '../../session'

export type PreviewViewport = 'desktop' | 'mobile' | 'tablet'

export interface PreviewDrawerProps {
  adapter?: WorkbenchAdapterId
  compilation?: PageCompilation
  configError?: string
  dataSourceHost?: ConfigFormDataSourceHost
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
  'fieldChange': [payload: PreviewRuntimeFieldChangeEvent]
  'message': [message: string]
  'ready': [event: PreviewRuntimeIdentity]
  'runtimeMounted': [event: PreviewRuntimeIdentity]
  'runtimeState': [event: PreviewRuntimeStateEvent]
  'submit': [event: PreviewRuntimeSubmitEvent]
  'submitResult': [event: PreviewRuntimeSubmitResultEvent]
  'update:expanded': [expanded: boolean]
  'update:viewport': [viewport: PreviewViewport]
}
