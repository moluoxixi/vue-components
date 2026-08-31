const COORDINATION_PROTOCOL_VERSION = 1 as const
const COORDINATION_CHANNEL_NAME = 'moluoxixi-config-form-project-coordination-v1'

export interface ProjectCoordinationRevisionMessage {
  committedAt: string
  kind: 'revision'
  projectId: string
  protocolVersion: typeof COORDINATION_PROTOCOL_VERSION
  repositoryRevision: number
  sequence: number
  sourceSessionId: string
}

interface ProjectCoordinationPresenceQuery {
  kind: 'presence.query'
  projectId: string
  protocolVersion: typeof COORDINATION_PROTOCOL_VERSION
  queryId: string
  sourceSessionId: string
  targetSessionId: string
}

interface ProjectCoordinationPresenceReply {
  kind: 'presence.reply'
  projectId: string
  protocolVersion: typeof COORDINATION_PROTOCOL_VERSION
  queryId: string
  sourceSessionId: string
  targetSessionId: string
}

type ProjectCoordinationMessage
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMessage(input: unknown): ProjectCoordinationMessage | undefined {
  if (!isRecord(input)
    || input.protocolVersion !== COORDINATION_PROTOCOL_VERSION
    || typeof input.kind !== 'string'
    || typeof input.projectId !== 'string'
    || typeof input.sourceSessionId !== 'string') {
    return undefined
  }
  if (input.kind === 'revision') {
    if (!Number.isInteger(input.repositoryRevision)
      || Number(input.repositoryRevision) < 0
      || !Number.isInteger(input.sequence)
      || Number(input.sequence) < 1
      || typeof input.committedAt !== 'string') {
      return undefined
    }
    return input as unknown as ProjectCoordinationRevisionMessage
  }
  if (input.kind === 'presence.query' || input.kind === 'presence.reply') {
    if (typeof input.queryId !== 'string'
      || typeof input.targetSessionId !== 'string') {
      return undefined
    }
    return input as unknown as ProjectCoordinationPresenceQuery | ProjectCoordinationPresenceReply
  }
  return undefined
}

function browserPort(): ProjectCoordinationPort | undefined {
  if (typeof BroadcastChannel !== 'function')
    return undefined
  const channel = new BroadcastChannel(COORDINATION_CHANNEL_NAME)
  const listeners = new Set<(message: unknown) => void>()
  channel.addEventListener('message', event =>
    listeners.forEach(listener => listener(event.data)))
  return {
    close: () => channel.close(),
    post: message => channel.postMessage(message),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function defaultId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createProjectCoordinationChannel(
  options: ProjectCoordinationChannelOptions,
): ProjectCoordinationChannel {
  const port = options.port ?? browserPort()
  const projectId = options.projectId
  const sessionId = options.sessionId
  const createId = options.createId ?? defaultId
  const now = options.now ?? (() => new Date().toISOString())
  const revisionListeners = new Set<(message: ProjectCoordinationRevisionMessage) => void>()
  const presenceWaiters = new Map<string, (status: 'active') => void>()
  let sequence = 0
  let lastIncomingSequenceBySession = new Map<string, number>()
  let closed = false

  const unsubscribe = port?.subscribe((input) => {
    const message = parseMessage(input)
    if (!message
      || message.projectId !== projectId
      || message.sourceSessionId === sessionId) {
      return
    }
    if (message.kind === 'presence.query') {
      if (message.targetSessionId === sessionId) {
        port.post({
          kind: 'presence.reply',
          projectId,
          protocolVersion: COORDINATION_PROTOCOL_VERSION,
          queryId: message.queryId,
          sourceSessionId: sessionId,
          targetSessionId: message.sourceSessionId,
        } satisfies ProjectCoordinationPresenceReply)
      }
      return
    }
    if (message.kind === 'presence.reply') {
      if (message.targetSessionId === sessionId)
        presenceWaiters.get(message.queryId)?.('active')
      return
    }
    const lastSequence = lastIncomingSequenceBySession.get(message.sourceSessionId) ?? 0
    if (message.sequence <= lastSequence)
      return
    lastIncomingSequenceBySession.set(message.sourceSessionId, message.sequence)
    revisionListeners.forEach(listener => listener(message))
  })

  function close(): void {
    if (closed)
      return
    closed = true
    unsubscribe?.()
    revisionListeners.clear()
    presenceWaiters.clear()
    lastIncomingSequenceBySession = new Map()
    port?.close()
  }

  function publishRevision(repositoryRevision: number): void {
    if (closed || !port || !Number.isInteger(repositoryRevision) || repositoryRevision < 0)
      return
    port.post({
      committedAt: now(),
      kind: 'revision',
      projectId,
      protocolVersion: COORDINATION_PROTOCOL_VERSION,
      repositoryRevision,
      sequence: ++sequence,
      sourceSessionId: sessionId,
    } satisfies ProjectCoordinationRevisionMessage)
  }

  async function queryPresence(
    targetSessionId: string,
    timeoutMs = 250,
  ): Promise<'active' | 'inactive' | 'unknown'> {
    if (closed || !port || targetSessionId === sessionId)
      return targetSessionId === sessionId && !closed ? 'active' : 'unknown'
    const queryId = createId()
    return await new Promise<'active' | 'inactive'>((resolve) => {
      let settled = false
      const timer = globalThis.setTimeout(() => {
        if (settled)
          return
        settled = true
        presenceWaiters.delete(queryId)
        resolve('inactive')
      }, timeoutMs)
      presenceWaiters.set(queryId, () => {
        if (settled)
          return
        settled = true
        globalThis.clearTimeout(timer)
        presenceWaiters.delete(queryId)
        resolve('active')
      })
      port.post({
        kind: 'presence.query',
        projectId,
        protocolVersion: COORDINATION_PROTOCOL_VERSION,
        queryId,
        sourceSessionId: sessionId,
        targetSessionId,
      } satisfies ProjectCoordinationPresenceQuery)
    })
  }

  return {
    available: !!port,
    close,
    publishRevision,
    queryPresence,
    subscribeRevision(listener) {
      revisionListeners.add(listener)
      return () => revisionListeners.delete(listener)
    },
  }
}
