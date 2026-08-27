import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ErrorResponse, TranslateSseEvent } from '../shared/protocol'
import type { ServerContext } from './context'
import { Buffer } from 'node:buffer'
import { ZodError } from 'zod'
import {
  applyRequestSchema,
  I18N_TOOL_API_PREFIX,
  I18N_TOOL_PRIVATE_HEADER,
  previewRequestSchema,
  translateRequestSchema,
} from '../shared/protocol'
import { asI18nToolError, I18nToolError } from './error'

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

function publicError(error: unknown): I18nToolError {
  if (error instanceof ZodError)
    return new I18nToolError('INVALID_REQUEST', 'The request payload is invalid.', 400)
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
    return new I18nToolError('CANCELLED', 'The request was cancelled.', 499)
  return asI18nToolError(error)
}

function sendError(response: ServerResponse, error: unknown): void {
  const resolved = publicError(error)
  const body: ErrorResponse = { error: resolved.code, message: resolved.message }
  sendJson(response, resolved.status, body)
}

function sameOrigin(request: IncomingMessage): boolean {
  const host = request.headers.host
  if (!host)
    return false
  const expectedOrigin = `http://${host}`
  const sourceHeaders = [request.headers.origin, request.headers.referer]
    .filter((value): value is string => typeof value === 'string')
  if (sourceHeaders.length === 0)
    return false
  for (const header of sourceHeaders) {
    if (!header)
      continue
    try {
      if (new URL(header).origin !== expectedOrigin)
        return false
    }
    catch {
      return false
    }
  }
  return true
}

function assertMutationRequest(request: IncomingMessage): void {
  if (request.headers[I18N_TOOL_PRIVATE_HEADER] !== '1')
    throw new I18nToolError('INVALID_REQUEST', 'The local request header is missing.', 403)
  if (!sameOrigin(request))
    throw new I18nToolError('INVALID_REQUEST', 'Cross-origin local mutations are not allowed.', 403)
  const mediaType = (request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/json')
    throw new I18nToolError('INVALID_REQUEST', 'Mutation requests must use application/json.', 415)
}

async function readJsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) {
      request.resume()
      throw new I18nToolError('PAYLOAD_TOO_LARGE', 'The request body exceeds the configured limit.', 413)
    }
    chunks.push(buffer)
  }
  if (chunks.length === 0)
    return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }
  catch {
    throw new I18nToolError('INVALID_REQUEST', 'The request body is not valid JSON.', 400)
  }
}

function writeSse(response: ServerResponse, event: TranslateSseEvent): void {
  response.write(`data: ${JSON.stringify(event)}\n\n`)
}

async function handleTranslate(
  context: ServerContext,
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
): Promise<void> {
  const payload = translateRequestSchema.parse(body)
  const controller = new AbortController()
  let closed = false
  const abort = () => {
    closed = true
    controller.abort()
  }
  request.once('aborted', abort)
  response.once('close', () => {
    if (!response.writableEnded)
      abort()
  })
  response.writeHead(200, {
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
    'content-type': 'text/event-stream; charset=utf-8',
  })
  try {
    for await (const event of context.translate(payload, controller.signal)) {
      if (closed)
        break
      writeSse(response, event)
    }
  }
  catch (error) {
    if (!closed) {
      const resolved = publicError(error)
      writeSse(response, { error: resolved.code, message: resolved.message, type: 'error' })
    }
  }
  finally {
    request.off('aborted', abort)
    if (!closed)
      response.end()
  }
}

export async function dispatch(
  context: ServerContext,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(I18N_TOOL_API_PREFIX))
    return false

  try {
    if (request.method === 'GET' && url.pathname === `${I18N_TOOL_API_PREFIX}/config`) {
      sendJson(response, 200, context.sanitizedConfig())
      return true
    }
    if (request.method !== 'POST')
      throw new I18nToolError('INVALID_REQUEST', 'The API route does not support this method.', 405)
    assertMutationRequest(request)
    const body = await readJsonBody(request, context.config.limits.bodyBytes)

    if (url.pathname === `${I18N_TOOL_API_PREFIX}/scan`) {
      sendJson(response, 200, await context.scan())
      return true
    }
    if (url.pathname === `${I18N_TOOL_API_PREFIX}/translate`) {
      await handleTranslate(context, request, response, body)
      return true
    }
    if (url.pathname === `${I18N_TOOL_API_PREFIX}/preview`) {
      sendJson(response, 200, await context.preview(previewRequestSchema.parse(body)))
      return true
    }
    if (url.pathname === `${I18N_TOOL_API_PREFIX}/apply`) {
      const payload = applyRequestSchema.parse(body)
      sendJson(response, 200, await context.apply(payload.previewToken))
      return true
    }
    throw new I18nToolError('RESOURCE_NOT_FOUND', 'The API route does not exist.', 404)
  }
  catch (error) {
    if (!response.headersSent)
      sendError(response, error)
    return true
  }
}
