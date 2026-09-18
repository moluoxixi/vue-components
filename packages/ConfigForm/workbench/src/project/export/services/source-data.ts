/** Explicit browser transport only; named-source execution stays in the shared renderer. */
export function createStandaloneDataSourceRequestSource(): string {
  return `import type { ConfigFormDataSourceHost } from '../runtime/core'

export function createSourceDataSourceRequest(
  fetchHost: typeof globalThis.fetch,
  readBaseUrl: () => string,
): NonNullable<ConfigFormDataSourceHost['request']> {
  return async (input, signal) => {
    signal.throwIfAborted()
    const url = new URL(input.url, readBaseUrl())
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new TypeError('Data sources require an HTTP or HTTPS URL.')
    Object.entries(input.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const headers = new Headers(input.headers)
    const method = input.method ?? 'GET'
    let body: string | undefined
    if (input.body !== undefined && method !== 'GET') {
      body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body)
      if (!headers.has('content-type') && typeof input.body !== 'string')
        headers.set('content-type', 'application/json')
    }
    const response = await fetchHost(url.href, { method, headers, body, signal })
    const data: unknown = input.responseType === 'text' ? await response.text() : await response.json()
    signal.throwIfAborted()
    return { status: response.status, ok: response.ok, data }
  }
}
`
}
