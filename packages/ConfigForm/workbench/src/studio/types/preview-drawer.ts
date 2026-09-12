import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormDataSourceHost,
  ConfigFormFlow,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowTraceEvent,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PreviewRuntimeComponentEvent,
  PreviewRuntimeFieldChangeEvent,
  PreviewRuntimeFlowDiagnosticEvent,
  PreviewRuntimeFlowProjectionEvent,
  PreviewRuntimeFlowResultEvent,
  PreviewRuntimeFlowTraceEvent,
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
  flowActions?: ConfigFormFlowActionRegistry
  flowDiagnostics?: readonly ConfigFormFlowDiagnostic[]
  flowTrace?: readonly ConfigFormFlowTraceEvent[]
  flows?: readonly ConfigFormFlow[]
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
  'flowError': [event: PreviewRuntimeFlowDiagnosticEvent]
  'flowProjection': [event: PreviewRuntimeFlowProjectionEvent]
  'flowResult': [event: PreviewRuntimeFlowResultEvent]
  'flowTrace': [event: PreviewRuntimeFlowTraceEvent]
  'message': [message: string]
  'ready': [event: PreviewRuntimeIdentity]
  'runtimeEvent': [payload: PreviewRuntimeComponentEvent]
  'runtimeMounted': [event: PreviewRuntimeIdentity]
  'runtimeState': [event: PreviewRuntimeStateEvent]
  'submit': [event: PreviewRuntimeSubmitEvent]
  'submitResult': [event: PreviewRuntimeSubmitResultEvent]
  'update:expanded': [expanded: boolean]
  'update:viewport': [viewport: PreviewViewport]
}
