import type { IncomingMessage, ServerResponse } from 'node:http'
import type { OpenInEditorOptions } from '../types'
import { Buffer } from 'node:buffer'
import { ConfigFormDevtoolsHttpError } from '../errors'
import {
  OPEN_IN_EDITOR_REQUEST_HEADER,
  OPEN_IN_EDITOR_REQUEST_HEADER_VALUE,
} from '../protocol'
import { openInEditor } from './open-in-editor'

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))))
    req.on('error', rejectBody)
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
  })
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

function getRequestHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isSameServerOrigin(req: IncomingMessage, value: string): boolean {
  const host = getRequestHeader(req, 'host')
  try {
    const origin = new URL(value)
    return origin.host === host
  }
  catch {
    return false
  }
}

function assertOpenInEditorRequest(req: IncomingMessage): void {
  if (getRequestHeader(req, OPEN_IN_EDITOR_REQUEST_HEADER) !== OPEN_IN_EDITOR_REQUEST_HEADER_VALUE)
    throw new ConfigFormDevtoolsHttpError(403, 'Missing ConfigForm devtools request header')

  const origin = getRequestHeader(req, 'origin')
  if (origin && !isSameServerOrigin(req, origin))
    throw new ConfigFormDevtoolsHttpError(403, 'Open-in-editor request origin is not allowed')

  const referer = getRequestHeader(req, 'referer')
  if (referer && !isSameServerOrigin(req, referer))
    throw new ConfigFormDevtoolsHttpError(403, 'Open-in-editor request referer is not allowed')
}

export function createOpenInEditorMiddleware(options: OpenInEditorOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    try {
      assertOpenInEditorRequest(req)
      const rawBody = await readRequestBody(req)
      const payload = rawBody ? JSON.parse(rawBody) : {}
      await openInEditor(payload, options)
      sendJson(res, 200, { ok: true })
    }
    catch (error) {
      if (error instanceof ConfigFormDevtoolsHttpError) {
        sendJson(res, error.statusCode, { error: error.message })
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 500, { error: message })
    }
  }
}
