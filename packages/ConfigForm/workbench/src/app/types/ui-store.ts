import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { createWorkbenchUiStore } from '../state/ui-store'

export type MobileStudioView = 'canvas' | 'components' | 'inspector' | 'layers' | 'pages' | 'theme'

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

/**
 * Where a creation route was entered from.
 *
 * The creation workspace is a routed screen, so cancelling or finishing it must
 * return to the workspace the user came from and hand focus back to the stable
 * trigger that started it. The trigger is never a valid focus target on return,
 * which is why the key is recorded here instead of read from the DOM at close
 * time.
 */
export interface WorkbenchCreationOrigin {
  readonly focusKey?: string
  readonly path: string
}
