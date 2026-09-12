import type {
  ConfigFormDataSourceHost,
  ConfigFormFlowHttpRequestInput,
  ConfigFormFlowHttpRequestOutput,
} from '@moluoxixi/config-form-core'
import type { RuntimeHostActionIdentity } from './action-rpc'
import type { RuntimeHostMessageBase } from './protocol'

export interface RuntimeHostDataDiagnostic {
  code: string
  message: string
  path?: string
}

export interface RuntimeHostDataRequestMessage extends RuntimeHostMessageBase {
  type: 'dataRequest'
  requestId: string
  input: ConfigFormFlowHttpRequestInput
}

export interface RuntimeHostDataCancelMessage extends RuntimeHostMessageBase {
  type: 'dataCancel'
  requestId: string
}

export type RuntimeHostDataResultMessage = RuntimeHostMessageBase & { type: 'dataResult', requestId: string } & (
  | { success: true, output: ConfigFormFlowHttpRequestOutput, diagnostic?: never }
  | { success: false, diagnostic: RuntimeHostDataDiagnostic, output?: never }
)

export type RuntimeHostDataPayload<T> = T extends RuntimeHostMessageBase ? Omit<T, keyof RuntimeHostMessageBase> : never

export interface RuntimeHostDataProxyOptions {
  getBase: () => RuntimeHostMessageBase
  isCurrent: (identity: RuntimeHostActionIdentity) => boolean
  postRequest: (message: RuntimeHostDataPayload<RuntimeHostDataRequestMessage>) => void
  postCancel: (message: RuntimeHostDataPayload<RuntimeHostDataCancelMessage>) => void
  maxPending?: number
  defaultDeadlineMs?: number
}

export interface RuntimeHostDataProxy {
  getDataSourceHost: () => ConfigFormDataSourceHost
  acceptResult: (message: RuntimeHostDataResultMessage) => boolean
  cancelAll: (reason?: unknown, notifyHost?: boolean) => void
  dispose: () => void
  pendingCount: () => number
}

export interface RuntimeHostDataExecutorOptions {
  getHost: () => ConfigFormDataSourceHost | undefined
  isCurrent: (identity: RuntimeHostActionIdentity) => boolean
  postResult: (message: RuntimeHostDataPayload<RuntimeHostDataResultMessage>) => void
  maxPending?: number
  defaultDeadlineMs?: number
}

export interface RuntimeHostDataExecutor {
  handleRequest: (message: RuntimeHostDataRequestMessage) => boolean
  handleCancel: (message: RuntimeHostDataCancelMessage) => boolean
  cancelAll: (reason?: unknown) => void
  dispose: () => void
  pendingCount: () => number
}
