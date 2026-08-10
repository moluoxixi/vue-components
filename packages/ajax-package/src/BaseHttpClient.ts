import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import type { BaseHttpClientConfig, HttpClientInstance, TokenConfig } from './types'
import axios, { AxiosHeaders } from 'axios'

type AwaitedPromiseTuple<Requests extends readonly Promise<unknown>[]> = {
  readonly [Index in keyof Requests]: Awaited<Requests[Index]>
}

function isTimeoutError(error: AxiosError): boolean {
  return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
}

function setRequestHeader(config: InternalAxiosRequestConfig, name: string, value: string): void {
  const headers = AxiosHeaders.from(config.headers)
  headers.set(name, value)
  config.headers = headers
}

export class BaseHttpClient {
  readonly instance: HttpClientInstance

  private readonly token: TokenConfig | undefined
  private readonly onRequest: BaseHttpClientConfig['onRequest']
  private readonly onResponse: BaseHttpClientConfig['onResponse']
  private readonly onResponseError: BaseHttpClientConfig['onResponseError']
  private readonly onTimeout: BaseHttpClientConfig['onTimeout']
  private readonly onUnauthorized: BaseHttpClientConfig['onUnauthorized']

  constructor(config: BaseHttpClientConfig = {}) {
    const {
      token,
      onRequest,
      onResponse,
      onResponseError,
      onTimeout,
      onUnauthorized,
      ...axiosConfig
    } = config

    this.token = token
    this.onRequest = onRequest
    this.onResponse = onResponse
    this.onResponseError = onResponseError
    this.onTimeout = onTimeout
    this.onUnauthorized = onUnauthorized
    this.instance = axios.create(axiosConfig)

    this.setupInterceptors()
  }

  protected async processRequestConfig(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    if (!this.token) {
      return config
    }

    const token = await this.token.getToken()
    if (token == null || token === '') {
      return config
    }

    const headerName = this.token.headerName ?? 'Authorization'
    const headerValue = this.token.formatToken?.(token) ?? token
    setRequestHeader(config, headerName, headerValue)

    return config
  }

  protected async processResponseConfig<R>(response: AxiosResponse<R>): Promise<R> {
    const processedResponse = this.onResponse
      ? await this.onResponse(response)
      : response

    return processedResponse.data
  }

  protected async processResponseError(error: AxiosError): Promise<void> {
    if (error.response?.status === 401) {
      await this.onUnauthorized?.(error)
    }

    if (isTimeoutError(error)) {
      await this.onTimeout?.(error)
    }

    await this.onResponseError?.(error)
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      async (config) => {
        const processedConfig = await this.processRequestConfig(config)
        return this.onRequest
          ? await this.onRequest(processedConfig)
          : processedConfig
      },
      error => Promise.reject(error),
    )

    this.instance.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        await this.processResponseError(error)
        return Promise.reject(error)
      },
    )
  }

  /**
   * 所有快捷方法最终都走 request，便于子类在单点扩展请求语义。
   */
  public async request<R = unknown>(config: AxiosRequestConfig): Promise<R> {
    const response = await this.instance.request<R, AxiosResponse<R>>(config)
    return await this.processResponseConfig(response)
  }

  public async get<R = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return await this.request<R>({ ...config, method: 'get', params, url })
  }

  public async post<R = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    return await this.request<R>({ ...config, data, method: 'post', url })
  }

  public async put<R = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    return await this.request<R>({ ...config, data, method: 'put', url })
  }

  public async delete<R = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return await this.request<R>({ ...config, method: 'delete', params, url })
  }

  public async all<const Requests extends readonly Promise<unknown>[]>(
    requests: Requests,
  ): Promise<AwaitedPromiseTuple<Requests>>

  public async all<R = unknown>(
    requests: readonly AxiosRequestConfig[],
  ): Promise<R[]>

  public async all<R = unknown>(
    requests: readonly (AxiosRequestConfig | Promise<R>)[],
  ): Promise<R[]>

  public async all(
    requests: readonly (AxiosRequestConfig | Promise<unknown>)[],
  ): Promise<unknown[]> {
    const tasks = requests.map((request) => {
      return request instanceof Promise
        ? request
        : this.request(request)
    })

    return await Promise.all(tasks)
  }

  public async uploadFile<R = unknown>(
    url: string,
    file: Blob,
    config?: AxiosRequestConfig<FormData>,
  ): Promise<R> {
    const formData = new FormData()
    formData.append('file', file)

    return await this.post<R, FormData>(url, formData, config)
  }

  public downloadFile(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new TypeError('[ajax-package] downloadFile requires a browser runtime')
    }

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    try {
      link.click()
    }
    finally {
      link.remove()
      window.URL.revokeObjectURL(url)
    }
  }
}

export default BaseHttpClient
