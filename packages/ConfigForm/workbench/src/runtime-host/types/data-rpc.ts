import type {
  ConfigFormDataSourceHost,
  ConfigFormDataSourceHttpRequestInput,
  ConfigFormDataSourceHttpRequestOutput,
} from '@moluoxixi/config-form-core'
import type { RuntimeHostIdentity, RuntimeHostMessageBase } from './protocol'

export interface RuntimeHostDataDiagnostic {
  code: string
  message: string
  path?: string
}

export interface RuntimeHostDataRequestMessage extends RuntimeHostMessageBase {
  type: 'dataRequest'
  requestId: string
  input: ConfigFormDataSourceHttpRequestInput
}

export interface RuntimeHostDataCancelMessage extends RuntimeHostMessageBase {
  type: 'dataCancel'
  requestId: string
}

export type RuntimeHostDataResultMessage = RuntimeHostMessageBase & { type: 'dataResult', requestId: string } & (
  | { success: true, output: ConfigFormDataSourceHttpRequestOutput, diagnostic?: never }
  | { success: false, diagnostic: RuntimeHostDataDiagnostic, output?: never }
)

export type RuntimeHostDataPayload<T> = T extends RuntimeHostMessageBase ? Omit<T, keyof RuntimeHostMessageBase> : never

export interface RuntimeHostDataProxyOptions {
  getBase: () => RuntimeHostMessageBase
  isCurrent: (identity: RuntimeHostIdentity) => boolean
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
  isCurrent: (identity: RuntimeHostIdentity) => boolean
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
