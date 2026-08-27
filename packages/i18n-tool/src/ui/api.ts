import type {
  ApplyResponse,
  PreviewRequest,
  PreviewResponse,
  SanitizedConfigResponse,
  ScanResponse,
  TranslateRequest,
  TranslateSseEvent,
} from '../shared/protocol'
import {
  decodeApplyResponse,
  decodeConfigResponse,
  decodeErrorResponse,
  decodePreviewResponse,
  decodeScanResponse,
  decodeTranslateSseEvent,
  I18N_TOOL_API_PREFIX,
  I18N_TOOL_PRIVATE_HEADER,
} from '../shared/protocol'

export class ApiError extends Error {
  readonly code?: string
  readonly status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function responseError(response: Response): Promise<ApiError> {
  try {
    const body = decodeErrorResponse(await response.json())
    return new ApiError(body.message, response.status, body.error)
  }
  catch {
    return new ApiError(`Request failed with status ${response.status}.`, response.status)
  }
}

async function getJson<T>(path: string, decode: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${I18N_TOOL_API_PREFIX}${path}`)
  if (!response.ok)
    throw await responseError(response)
  return decode(await response.json())
}

async function postJson<T>(path: string, body: unknown, decode: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${I18N_TOOL_API_PREFIX}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      [I18N_TOOL_PRIVATE_HEADER]: '1',
    },
    method: 'POST',
  })
  if (!response.ok)
    throw await responseError(response)
  return decode(await response.json())
}

export function getConfig(): Promise<SanitizedConfigResponse> {
  return getJson('/config', decodeConfigResponse)
}

export function scanWorkspace(): Promise<ScanResponse> {
  return postJson('/scan', {}, decodeScanResponse)
}

export function createPreview(request: PreviewRequest): Promise<PreviewResponse> {
  return postJson('/preview', request, decodePreviewResponse)
}

export function applyPreview(previewToken: string): Promise<ApplyResponse> {
  return postJson('/apply', { previewToken }, decodeApplyResponse)
}

function decodeSseFrame(frame: string): TranslateSseEvent | undefined {
  const data = frame
    .split(/\r\n|\r|\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).replace(/^ /, ''))
    .join('\n')
  return data ? decodeTranslateSseEvent(JSON.parse(data)) : undefined
}

export async function streamTranslation(
  request: TranslateRequest,
  onEvent: (event: TranslateSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${I18N_TOOL_API_PREFIX}/translate`, {
    body: JSON.stringify(request),
    headers: {
      'content-type': 'application/json',
      [I18N_TOOL_PRIVATE_HEADER]: '1',
    },
    method: 'POST',
    signal,
  })
  if (!response.ok)
    throw await responseError(response)
  if (!response.body)
    throw new ApiError('Translation response has no stream body.', response.status)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminal = false
  let completed = false
  const consume = (frame: string) => {
    const event = decodeSseFrame(frame)
    if (!event)
      return
    if (terminal)
      throw new ApiError('Translation stream emitted an event after its terminal event.', response.status)
    onEvent(event)
    if (event.type === 'done' || event.type === 'error')
      terminal = true
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r\n\r\n|\r\r|\n\n/)
      buffer = frames.pop() ?? ''
      for (const frame of frames)
        consume(frame)
    }
    buffer += decoder.decode()
    if (buffer.trim())
      consume(buffer)
    if (!terminal)
      throw new ApiError('Translation stream ended without a terminal event.', response.status)
    completed = true
  }
  finally {
    if (!completed)
      await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
