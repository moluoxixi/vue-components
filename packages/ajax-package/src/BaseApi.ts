import type { AxiosResponse } from 'axios'
import type { BaseApiConfig, HttpResponseContract } from './types'
import BaseHttpClient from './BaseHttpClient'
import { HttpResponseError } from './errors'
import { getValueByPath } from './path'

function resolveResponseMessage(
  contract: HttpResponseContract,
  body: unknown,
  code: unknown,
): string {
  if (contract.messagePath) {
    const message = getValueByPath(body, contract.messagePath)
    return typeof message === 'string'
      ? message
      : String(message)
  }

  return `HTTP response contract rejected code: ${String(code)}`
}

export class BaseApi extends BaseHttpClient {
  private readonly responseContract: HttpResponseContract | undefined

  constructor(config: BaseApiConfig = {}) {
    const { responseContract, ...baseConfig } = config
    super(baseConfig)
    this.responseContract = responseContract
  }

  protected override async processResponseConfig<R = unknown>(response: AxiosResponse<R>): Promise<R> {
    const body = await super.processResponseConfig(response)

    if (!this.responseContract) {
      return body as R
    }

    const code = this.responseContract.codePath
      ? getValueByPath(body, this.responseContract.codePath)
      : undefined

    if (this.responseContract.isSuccess && !this.responseContract.isSuccess(code, body, response)) {
      throw new HttpResponseError(
        resolveResponseMessage(this.responseContract, body, code),
        { body, code, response },
      )
    }

    return getValueByPath(body, this.responseContract.dataPath) as R
  }
}

export default BaseApi
