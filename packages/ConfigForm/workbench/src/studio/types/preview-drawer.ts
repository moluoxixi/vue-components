import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { PrototypeSessionV1 } from '@moluoxixi/config-form-prototype-runtime/session'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  ExperienceRuntimeHostIdentityEvent,
  ExperienceRuntimeInstanceStateEvent,
  ExperienceRuntimeSessionEvent,
} from '../../runtime-host'

export type PreviewViewport = 'desktop' | 'mobile' | 'tablet'

export interface PreviewDrawerProps {
  adapter?: WorkbenchAdapterId
  compilation?: ProjectCompilation
  expanded?: boolean
  locale?: DesignerLocaleOptions
  namespace?: string
  open: boolean
  revision: string
  session?: PrototypeSessionV1
  sessionId: string
  state: { label: string, tone: 'error' | 'live' }
  viewport: PreviewViewport
}

export interface PreviewDrawerEmits {
  'close': []
  'error': [error: Error]
  'instanceState': [event: ExperienceRuntimeInstanceStateEvent]
  'mounted': [event: ExperienceRuntimeHostIdentityEvent]
  'ready': [event: ExperienceRuntimeHostIdentityEvent]
  'session': [event: ExperienceRuntimeSessionEvent]
  'update:expanded': [expanded: boolean]
  'update:viewport': [viewport: PreviewViewport]
}
