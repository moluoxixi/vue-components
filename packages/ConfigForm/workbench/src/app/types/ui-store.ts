import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { createWorkbenchUiStore } from '../state/ui-store'

export type MobileStudioView = 'canvas' | 'components' | 'inspector' | 'layers' | 'pages'

export interface WorkbenchUiStoreOptions {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchNotice {
  readonly id: number
  readonly message: string
  readonly tone: 'error' | 'info' | 'success'
  readonly action?: {
    readonly label: string
    readonly run: () => void
  }
}

export interface ShowWorkbenchNoticeOptions {
  action?: {
    label: string
    run: () => void
  }
  durationMs?: number
  message: string
  tone?: WorkbenchNotice['tone']
}

export type WorkbenchUiStore = ReturnType<typeof createWorkbenchUiStore>
