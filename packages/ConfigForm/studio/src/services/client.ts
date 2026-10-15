import type {
  PersistedProjectEnvelope,
  ProjectRepositoryErrorCode,
  ProjectSummary,
} from '@moluoxixi/config-form-model'
import type { HttpProjectRepository, RepositoryMethod, WorkspaceChange } from '../types'
import { ProjectRepositoryError } from '@moluoxixi/config-form-model'
import { WORKSPACE_API_PATH, WORKSPACE_REQUEST_HEADER } from '../constants'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}
function base64ToBytes(value: string): Uint8Array {
  if (typeof value !== 'string' || !/^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i.test(value))
    throw new TypeError('Resource bytes must be canonical base64.')
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}
/** Encode only repository byte fields, leaving user JSON values untouched. */
export function mapRepositoryArguments(method: RepositoryMethod, args: unknown[], direction: 'encode' | 'decode'): unknown[] {
  if (method !== 'create' && method !== 'commit')
    return args
  const [input] = args as [Record<string, unknown>]
  const key = method === 'create' ? 'embeddedContents' : 'embeddedWrites'
  if (!input || !Array.isArray(input[key]))
    return args
  return [{
    ...input,
    [key]: input[key].map((item: Record<string, unknown>) => ({ ...item, bytes: direction === 'encode' ? bytesToBase64(item.bytes as Uint8Array) : base64ToBytes(item.bytes as string) })),
  }]
}
export function mapRepositoryResult(method: RepositoryMethod, result: unknown, direction: 'encode' | 'decode'): unknown {
  if (method !== 'readEmbedded' || result == null)
    return result
  return direction === 'encode' ? bytesToBase64(result as Uint8Array) : base64ToBytes(result as string)
}
export async function workspaceRequest<T>(url: string, input: unknown, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [WORKSPACE_REQUEST_HEADER]: '1' },
    body: JSON.stringify(input),
  })
  const body = await response.json() as { data?: T, error?: { code: string, message: string, diagnostics?: unknown[] } }
  if (!response.ok || body.error) {
    const error = body.error ?? { code: 'WORKSPACE_HTTP_ERROR', message: `Workspace request failed: ${response.status}` }
    if (error.code.startsWith('PROJECT_'))
      throw new ProjectRepositoryError(error.code as ProjectRepositoryErrorCode, error.message)
    throw Object.assign(new Error(error.message), error)
  }
  return body.data as T
}
export async function openHttpProjectRepository(options: {
  url: string
  fetch?: typeof fetch
  eventSource?: typeof EventSource
}): Promise<HttpProjectRepository> {
  const base = options.url.replace(/\/$/, '')
  const clientId = globalThis.crypto.randomUUID()
  const fetcher = options.fetch ?? fetch
  const health = await workspaceRequest<{ workspaceName: string, workspaceId: string, protocol: 1 }>(`${base}${WORKSPACE_API_PATH}/health`, {}, fetcher)
  if (health.protocol !== 1)
    throw new Error('Unsupported workspace service protocol.')
  const changes = new Set<(change: WorkspaceChange) => void>()
  const connection = new Set<(connected: boolean) => void>()
  const EventSourceClass = options.eventSource ?? globalThis.EventSource
  const stream = typeof EventSourceClass === 'function' ? new EventSourceClass(`${base}${WORKSPACE_API_PATH}/events`) : undefined
  let connected = true
  let closed = false
  if (stream) {
    stream.onopen = () => {
      connected = true
      connection.forEach(listener => listener(true))
      changes.forEach(listener => listener({ kind: 'reset' }))
    }
    stream.onerror = () => {
      connected = false
      connection.forEach(listener => listener(false))
    }
    stream.onmessage = (event) => {
      const change = JSON.parse(event.data) as WorkspaceChange
      if (change.clientId !== clientId)
        changes.forEach(listener => listener(change))
    }
  }
  async function rpc<T>(method: RepositoryMethod, ...args: unknown[]): Promise<T> {
    if (closed)
      throw new Error('Workspace repository is closed.')
    const result = await workspaceRequest<unknown>(`${base}${WORKSPACE_API_PATH}/repository`, { method, clientId, args: mapRepositoryArguments(method, args, 'encode') }, fetcher)
    return mapRepositoryResult(method, result, 'decode') as T
  }
  return {
    persistence: 'durable',
    workspaceName: health.workspaceName,
    workspaceId: health.workspaceId,
    create: input => rpc('create', input),
    commit: input => rpc('commit', input),
    delete: id => rpc('delete', id),
    get: id => rpc<PersistedProjectEnvelope | undefined>('get', id),
    list: () => rpc<ProjectSummary[]>('list'),
    getVersion: (id, revision) => rpc('getVersion', id, revision),
    listVersions: id => rpc('listVersions', id),
    pruneVersions: (id, policy) => rpc('pruneVersions', id, policy ?? {}),
    setVersionLabel: input => rpc('setVersionLabel', input),
    readEmbedded: input => rpc('readEmbedded', input),
    close() {
      closed = true
      stream?.close()
      changes.clear()
      connection.clear()
    },
    subscribeChanges(listener) {
      changes.add(listener)
      return () => changes.delete(listener)
    },
    subscribeConnection(listener) {
      connection.add(listener)
      listener(connected)
      return () => connection.delete(listener)
    },
  }
}
