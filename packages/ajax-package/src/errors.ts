import type { AxiosResponse } from 'axios'

export interface HttpResponseErrorOptions {
  body: unknown
  code: unknown
  response: AxiosResponse
}

export class HttpResponseError extends Error {
  readonly body: unknown
  readonly code: unknown
  readonly response: AxiosResponse

  constructor(message: string, options: HttpResponseErrorOptions) {
    super(message)
    this.name = 'HttpResponseError'
    this.body = options.body
    this.code = options.code
    this.response = options.response
  }
}
