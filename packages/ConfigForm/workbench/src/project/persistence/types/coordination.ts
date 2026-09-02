export interface ProjectCoordinationRevisionMessage {
  committedAt: string
  kind: 'revision'
  projectId: string
  version: 1
  repositoryRevision: number
  sequence: number
  sourceSessionId: string
}

export interface ProjectCoordinationPresenceQuery {
  kind: 'presence.query'
  projectId: string
  version: 1
  queryId: string
  sourceSessionId: string
  targetSessionId: string
}

export interface ProjectCoordinationPresenceReply {
  kind: 'presence.reply'
  projectId: string
  version: 1
  queryId: string
  sourceSessionId: string
  targetSessionId: string
}

export type ProjectCoordinationMessage
  = | ProjectCoordinationPresenceQuery
    | ProjectCoordinationPresenceReply
    | ProjectCoordinationRevisionMessage

export interface ProjectCoordinationPort {
  close: () => void
  post: (message: unknown) => void
  subscribe: (listener: (message: unknown) => void) => () => void
}

export interface ProjectCoordinationChannelOptions {
  createId?: () => string
  now?: () => string
  port?: ProjectCoordinationPort
  projectId: string
  sessionId: string
}

export interface ProjectCoordinationChannel {
  readonly available: boolean
  close: () => void
  publishRevision: (repositoryRevision: number) => void
  queryPresence: (sessionId: string, timeoutMs?: number) => Promise<'active' | 'inactive' | 'unknown'>
  subscribeRevision: (
    listener: (message: ProjectCoordinationRevisionMessage) => void,
  ) => () => void
}
