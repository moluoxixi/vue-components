import type { ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import type {
  RuntimeHostActionCancelMessage,
  RuntimeHostActionRequestMessage,
  RuntimeHostActionResultMessage,
} from './protocol'

export interface RuntimeHostActionIdentity {
  hostId: string
  pageId: string
  projectId: string
  revision: string
}

export interface RuntimeHostActionProxyController {
  readonly pendingCount: () => number
  readonly registry: ConfigFormFlowActionRegistry
  acceptResult: (message: RuntimeHostActionResultMessage) => boolean
  cancelAll: (reason?: unknown, notifyHost?: boolean) => void
  dispose: () => void
}

export interface RuntimeHostActionExecutor {
  readonly pendingCount: () => number
  handleCancel: (message: RuntimeHostActionCancelMessage) => boolean
  handleRequest: (message: RuntimeHostActionRequestMessage) => boolean
  cancelAll: (reason?: unknown, notify?: boolean) => void
  dispose: () => void
}
