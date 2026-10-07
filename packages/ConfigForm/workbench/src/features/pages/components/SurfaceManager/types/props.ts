import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ReadonlyProjectDocument } from '@moluoxixi/config-form-model'

export interface SurfaceManagerProps {
  busy?: boolean
  locale?: DesignerLocaleOptions
  project: ReadonlyProjectDocument
}
