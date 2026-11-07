import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { PrototypeSessionV1 } from '@moluoxixi/config-form-prototype-runtime/session'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  ExperienceRuntimeHostIdentityEvent,
  ExperienceRuntimeInstanceStateEvent,
  ExperienceRuntimeSessionEvent,
} from '../../runtime-host'
import type { PreviewInstanceStateMap } from '../../session/types/preview'

export type PreviewViewport = 'desktop' | 'mobile' | 'tablet'

export interface PreviewWorkspaceProps {
  adapter?: WorkbenchAdapterId
  compilation?: ProjectCompilation
  locale?: DesignerLocaleOptions
  namespace?: string
  open: boolean
  revision: string
  session?: PrototypeSessionV1
  sessionId: string
  state: { label: string, tone: 'error' | 'live' }
  viewport: PreviewViewport
  instanceStates?: PreviewInstanceStateMap
}

export interface PreviewWorkspaceEmits {
  'close': []
  'reset': []
  'error': [error: Error]
  'instanceState': [event: ExperienceRuntimeInstanceStateEvent]
  'mounted': [event: ExperienceRuntimeHostIdentityEvent]
  'ready': [event: ExperienceRuntimeHostIdentityEvent]
  'session': [event: ExperienceRuntimeSessionEvent]
  'update:viewport': [viewport: PreviewViewport]
}
