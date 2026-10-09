import type { WorkbenchAdapterId } from '../../../adapters'

export interface TemplateDetails {
  name: string
  description: string
  adapter: WorkbenchAdapterId
  kind: 'page' | 'dialog' | 'drawer'
}
