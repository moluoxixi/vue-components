import type { DesignerRuntimeSlotScope } from '@moluoxixi/config-form-designer'
import type { ProjectSurface } from '@moluoxixi/config-form-model'
import type { DesignRuntimeHostFrameProps } from '../../runtime-host'

export interface StudioDesignRuntimeProps {
  surface?: ProjectSurface
  scope: DesignerRuntimeSlotScope
  adapter: DesignRuntimeHostFrameProps['adapter']
  locale: string
  namespace?: string
  resolveCompilation: DesignRuntimeHostFrameProps['resolveCompilation']
  title: string
}
