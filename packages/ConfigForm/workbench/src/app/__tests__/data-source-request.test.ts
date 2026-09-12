import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchDataSourceRequest } from '../services/data-source-request'

const baseUrl = () => 'https://example.test/studio/'

describe('explicit Workbench data-source request capability', () => {
  it('does not request during construction and preserves structured query, body, response, and AbortSignal', async () => {
    const fetchHost = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{ label: 'One', value: 1 }]), { status: 200 }))
    const request = createWorkbenchDataSourceRequest(fetchHost, baseUrl)
    expect(fetchHost).not.toHaveBeenCalled()
    const signal = new AbortController().signal
    const result = await request({
      url: '/options?existing=1',
      method: 'POST',
      headers: { 'x-test': 'yes' },
      query: { city: 'A B', active: false },
      body: { ids: [1, 2] },
    }, signal)
    const [url, init] = fetchHost.mock.calls[0]!
    expect(url).toBe('https://example.test/options?existing=1&city=A+B&active=false')
    expect(init?.signal).toBe(signal)
    expect(init?.body).toBe('{"ids":[1,2]}')
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
    expect(new Headers(init?.headers).get('x-test')).toBe('yes')
    expect(result).toEqual({ status: 200, ok: true, data: [{ label: 'One', value: 1 }] })
  })

  it('preserves non-success HTTP results for the shared data-source runtime', async () => {
    const fetchHost = vi.fn<typeof fetch>().mockResolvedValue(new Response('Unavailable', { status: 503 }))
    const request = createWorkbenchDataSourceRequest(fetchHost, baseUrl)
    await expect(request({ url: '/options', responseType: 'text' }, new AbortController().signal))
      .resolves.toEqual({ status: 503, ok: false, data: 'Unavailable' })
  })

  it('rejects cancelled and non-HTTP requests without invoking the host', async () => {
    const fetchHost = vi.fn<typeof fetch>()
    const request = createWorkbenchDataSourceRequest(fetchHost, baseUrl)
    const cancelled = new AbortController()
    cancelled.abort(new Error('cancelled'))
    await expect(request({ url: '/options' }, cancelled.signal)).rejects.toThrow('cancelled')
    await expect(request({ url: 'javascript:alert(1)' }, new AbortController().signal)).rejects.toThrow('HTTP or HTTPS')
    expect(fetchHost).not.toHaveBeenCalled()
  })
})
