import type { ConfigFormDataSourceHttpRequestInput, ConfigFormDataSourceHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { RuntimeHostDataDiagnostic } from '../types/data-rpc'
import { isRuntimeHostJson } from './json'

const REQUEST_KEYS = new Set(['url', 'method', 'headers', 'query', 'body', 'responseType'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isRuntimeHostDataInput(value: unknown): value is ConfigFormDataSourceHttpRequestInput {
  if (!isRecord(value) || !isRuntimeHostJson(value) || !Object.keys(value).every(key => REQUEST_KEYS.has(key))
    || typeof value.url !== 'string' || !value.url.trim()) {
    return false
  }
  try {
    if (!['http:', 'https:'].includes(new URL(value.url, 'https://runtime.invalid/').protocol))
      return false
  }
  catch {
    return false
  }
  return (value.method === undefined || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(value.method)))
    && (value.responseType === undefined || value.responseType === 'json' || value.responseType === 'text')
    && (value.headers === undefined || (isRecord(value.headers) && Object.values(value.headers).every(item => typeof item === 'string')))
    && (value.query === undefined || (isRecord(value.query) && Object.values(value.query).every(item =>
      typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))))
}

export function isRuntimeHostDataOutput(value: unknown): value is ConfigFormDataSourceHttpRequestOutput {
  return isRecord(value) && isRuntimeHostJson(value)
    && Object.keys(value).every(key => ['status', 'ok', 'data'].includes(key))
    && Number.isSafeInteger(value.status) && Number(value.status) >= 0 && Number(value.status) <= 599
    && typeof value.ok === 'boolean' && Object.hasOwn(value, 'data')
}

export function isRuntimeHostDataDiagnostic(value: unknown): value is RuntimeHostDataDiagnostic {
  return isRecord(value) && isRuntimeHostJson(value)
    && Object.keys(value).every(key => ['code', 'message', 'path'].includes(key))
    && typeof value.code === 'string' && value.code.length > 0 && value.code.length <= 256
    && typeof value.message === 'string' && value.message.length > 0 && value.message.length <= 4096
    && (value.path === undefined || (typeof value.path === 'string' && value.path.length <= 2048))
}
