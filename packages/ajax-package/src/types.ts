import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

export interface TokenConfig {
  /**
   * 每次请求前按需读取 token；未返回 token 时不会写入任何认证头。
   */
  getToken: () => Promise<string | null | undefined> | string | null | undefined
  /**
   * 认证头名称默认使用通用的 Authorization，不保留旧包的业务 Token 头约定。
   */
  headerName?: string
  /**
   * 调用方负责决定 Bearer、Token 或其他格式，工具包不猜测业务协议。
   */
  formatToken?: (token: string) => string
}

export interface BaseHttpClientConfig extends AxiosRequestConfig {
  token?: TokenConfig
  onRequest?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
  onResponse?: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>
  onResponseError?: (error: AxiosError) => void | Promise<void>
  onTimeout?: (error: AxiosError) => void | Promise<void>
  onUnauthorized?: (error: AxiosError) => void | Promise<void>
}

export interface HttpResponseContract {
  /**
   * 业务状态码路径；未配置时不做业务成功/失败判断。
   */
  codePath?: string
  /**
   * 错误消息路径；只有业务失败时才会读取。
   */
  messagePath?: string
  /**
   * 数据路径；配置后路径缺失会直接抛错，避免返回伪成功的 undefined。
   */
  dataPath?: string
  /**
   * 判断业务响应是否成功；不提供时只做数据路径提取，不判断 code。
   */
  isSuccess?: (code: unknown, body: unknown, response: AxiosResponse) => boolean
}

export interface BaseApiConfig extends BaseHttpClientConfig {
  responseContract?: HttpResponseContract
}

export type HttpRequestConfig = AxiosRequestConfig

export type HttpClientInstance = AxiosInstance
