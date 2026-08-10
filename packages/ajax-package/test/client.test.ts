import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { BaseApi, BaseHttpClient, createHttpService, HttpResponseError } from '../src/index'

function createAdapter(
  handler: (config: InternalAxiosRequestConfig) => unknown,
): AxiosAdapter {
  return async (config) => {
    const data = handler(config)
    const response = {
      config,
      data,
      headers: {},
      status: 200,
      statusText: 'OK',
    } satisfies AxiosResponse

    if (config.validateStatus && !config.validateStatus(response.status)) {
      throw new AxiosError('Request failed with status code 200', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }

    return response
  }
}

function createStatusAdapter(
  response: Omit<AxiosResponse, 'config'>,
): AxiosAdapter {
  return async (config) => {
    const resolvedResponse = {
      ...response,
      config,
    }

    if (config.validateStatus && !config.validateStatus(resolvedResponse.status)) {
      throw new AxiosError(
        `Request failed with status code ${resolvedResponse.status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        resolvedResponse,
      )
    }

    return resolvedResponse
  }
}

describe('baseHttpClient', () => {
  it('sends request params without injecting legacy business token headers', async () => {
    const client = new BaseHttpClient({
      adapter: createAdapter((config) => {
        const headers = AxiosHeaders.from(config.headers)
        expect(headers.has('Token')).toBe(false)
        expect(config.params).toEqual({ page: 1 })

        return { ok: true }
      }),
    })

    await expect(client.get('/users', { page: 1 })).resolves.toEqual({ ok: true })
  })

  it('uses explicit auth injection when callers provide the contract', async () => {
    const client = new BaseHttpClient({
      adapter: createAdapter((config) => {
        const headers = AxiosHeaders.from(config.headers)
        expect(headers.get('X-Auth')).toBe('Bearer token-a')

        return { ok: true }
      }),
      token: {
        formatToken: token => `Bearer ${token}`,
        getToken: () => 'token-a',
        headerName: 'X-Auth',
      },
    })

    await expect(client.post('/users', { name: 'Ada' })).resolves.toEqual({ ok: true })
  })

  it('runs error hooks and still rejects the original axios error', async () => {
    const onUnauthorized = vi.fn()
    const client = new BaseHttpClient({
      adapter: createStatusAdapter({
        data: { message: 'unauthorized' },
        headers: {},
        status: 401,
        statusText: 'Unauthorized',
      }),
      onUnauthorized,
      validateStatus: status => status < 400,
    })

    await expect(client.get('/private')).rejects.toMatchObject({
      response: {
        status: 401,
      },
    })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('runs timeout and response error hooks for failed requests', async () => {
    const onTimeout = vi.fn()
    const onResponseError = vi.fn()
    const client = new BaseHttpClient({
      adapter: async (config) => {
        throw new AxiosError('timeout', 'ECONNABORTED', config)
      },
      onResponseError,
      onTimeout,
    })

    await expect(client.get('/slow')).rejects.toMatchObject({
      code: 'ECONNABORTED',
    })
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(onResponseError).toHaveBeenCalledTimes(1)
  })

  it('supports request and response hooks without hiding returned data', async () => {
    const client = new BaseHttpClient({
      adapter: createAdapter((config) => {
        const headers = AxiosHeaders.from(config.headers)
        expect(headers.get('X-Request')).toBe('1')

        return { value: 1 }
      }),
      onRequest: (config) => {
        const headers = AxiosHeaders.from(config.headers)
        headers.set('X-Request', '1')
        config.headers = headers

        return config
      },
      onResponse: (response) => {
        return {
          ...response,
          data: {
            ...response.data,
            decorated: true,
          },
        }
      },
    })

    await expect(client.get('/hooked')).resolves.toEqual({
      decorated: true,
      value: 1,
    })
  })

  it('keeps shortcut methods and batch requests on the same request pipeline', async () => {
    const seenMethods: string[] = []
    const client = new BaseHttpClient({
      adapter: createAdapter((config) => {
        seenMethods.push(config.method ?? '')
        return { method: config.method, url: config.url }
      }),
    })

    await expect(client.put('/users/1', { name: 'Ada' })).resolves.toEqual({ method: 'put', url: '/users/1' })
    await expect(client.delete('/users/1')).resolves.toEqual({ method: 'delete', url: '/users/1' })
    await expect(client.all([
      { method: 'get', url: '/a' },
      Promise.resolve({ method: 'manual', url: '/b' }),
    ])).resolves.toEqual([
      { method: 'get', url: '/a' },
      { method: 'manual', url: '/b' },
    ])

    expect(seenMethods).toEqual(['put', 'delete', 'get'])
  })

  it('preserves tuple types for promise-only batch requests', async () => {
    const client = new BaseHttpClient()
    const result = await client.all([
      Promise.resolve({ ok: true }),
      Promise.resolve(2),
    ] as const)

    expectTypeOf(result).toEqualTypeOf<readonly [{ ok: boolean }, number]>()
    expect(result).toEqual([{ ok: true }, 2])
  })

  it('creates upload FormData and rejects downloads outside browser runtime', async () => {
    const client = new BaseHttpClient({
      adapter: createAdapter((config) => {
        expect(config.method).toBe('post')
        expect(config.data).toBeInstanceOf(FormData)
        expect(AxiosHeaders.from(config.headers).get('Content-Type')).not.toBe('multipart/form-data')
        return { uploaded: true }
      }),
    })

    await expect(client.uploadFile('/upload', new Blob(['file']))).resolves.toEqual({ uploaded: true })
    expect(() => client.downloadFile(new Blob(['file']), 'file.txt')).toThrow('[ajax-package] downloadFile requires a browser runtime')
  })

  it('cleans browser download resources when link click fails', () => {
    const createdUrls: string[] = []
    const revokedUrls: string[] = []
    const removedLinks: HTMLAnchorElement[] = []
    const body = {
      appendChild: vi.fn(),
    }
    const link = {
      click: vi.fn(() => {
        throw new Error('click failed')
      }),
      remove: vi.fn(() => {
        removedLinks.push(link as unknown as HTMLAnchorElement)
      }),
    } as unknown as HTMLAnchorElement
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        URL: {
          createObjectURL(blob: Blob) {
            const url = `blob:${blob.size}`
            createdUrls.push(url)
            return url
          },
          revokeObjectURL(url: string) {
            revokedUrls.push(url)
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body,
        createElement: vi.fn(() => link),
      },
    })

    try {
      const client = new BaseHttpClient()

      expect(() => client.downloadFile(new Blob(['file']), 'file.txt')).toThrow('click failed')
      expect(body.appendChild).toHaveBeenCalledWith(link)
      expect(removedLinks).toEqual([link])
      expect(revokedUrls).toEqual(createdUrls)
    }
    finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      })
    }
  })
})

describe('baseApi', () => {
  it('extracts response data through an explicit response contract', async () => {
    const api = createHttpService({
      adapter: createAdapter(() => ({
        code: 'ok',
        payload: {
          items: [1, 2, 3],
        },
      })),
      responseContract: {
        codePath: 'code',
        dataPath: 'payload.items',
        isSuccess: code => code === 'ok',
      },
    })

    await expect(api.get('/items')).resolves.toEqual([1, 2, 3])
  })

  it('throws visible errors when response contract rejects business code', async () => {
    const api = new BaseApi({
      adapter: createAdapter(() => ({
        code: 'failed',
        message: '业务失败',
      })),
      responseContract: {
        codePath: 'code',
        isSuccess: code => code === 'ok',
        messagePath: 'message',
      },
    })

    await expect(api.get('/items')).rejects.toBeInstanceOf(HttpResponseError)
    await expect(api.get('/items')).rejects.toThrow('业务失败')
  })

  it('throws when a declared response path is missing', async () => {
    const api = new BaseApi({
      adapter: createAdapter(() => ({ payload: {} })),
      responseContract: {
        dataPath: 'payload.items',
      },
    })

    await expect(api.get('/items')).rejects.toThrow('[ajax-package] response path not found: payload.items')
  })

  it('preserves raw body when only success contract is declared', async () => {
    const api = new BaseApi({
      adapter: createAdapter(() => ({
        code: 'ok',
        nested: {
          value: true,
        },
      })),
      responseContract: {
        codePath: 'code',
        isSuccess: code => code === 'ok',
      },
    })

    await expect(api.get('/raw')).resolves.toEqual({
      code: 'ok',
      nested: {
        value: true,
      },
    })
  })

  it('creates independent services through both factory aliases', () => {
    const one = createHttpService()
    const two = createHttpService()

    expect(one).toBeInstanceOf(BaseApi)
    expect(two).toBeInstanceOf(BaseApi)
    expect(one).not.toBe(two)
  })
})
