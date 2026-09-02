import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectRecoveryDraftSummary } from '../../project'
import type { createWorkbenchController } from '../services/controller'

export interface WorkbenchControllerProps {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchRecoveryNotice {
  action?: 'fork' | 'reload' | 'versions'
  actionLabel?: string
  message: string
  secondaryAction?: 'fork' | 'reload' | 'versions'
  secondaryActionLabel?: string
  tertiaryAction?: 'fork' | 'reload' | 'versions'
  tertiaryActionLabel?: string
  tone: 'error' | 'warning'
}

export interface WorkbenchRecoveryDraftSummary extends ProjectRecoveryDraftSummary {
  presence: 'active' | 'inactive' | 'unknown'
}

export type WorkbenchController = ReturnType<typeof createWorkbenchController>
